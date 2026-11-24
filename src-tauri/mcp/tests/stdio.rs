//! The binary over stdio on the evaluation Library: every stdout line is
//! JSON-RPC, even with RUST_LOG=debug (docs/plans/0003-mcp.md, test 7).

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::time::Duration;
use tempfile::TempDir;

struct Server {
    child: Child,
    stdin: ChildStdin,
    lines: Receiver<String>,
    seen: Vec<String>,
    next_id: u64,
}

fn data_dir(home: &TempDir) -> PathBuf {
    home.path().join("Library/Application Support/KoboHighlightsExporter Dev")
}

fn eval_home() -> TempDir {
    let home = TempDir::new().unwrap();
    let dir = data_dir(&home);
    std::fs::create_dir_all(&dir).unwrap();
    drop(khi_lib::library::eval_fixture::build_eval_library(&dir).unwrap());
    home
}

impl Server {
    fn start(home: &TempDir, args: &[&str]) -> Server {
        let mut child = Command::new(env!("CARGO_BIN_EXE_khi-mcp"))
            .args(args)
            .env("HOME", home.path())
            .env("RUST_LOG", "debug")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let (tx, lines) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                if tx.send(line.unwrap()).is_err() {
                    break;
                }
            }
        });
        let mut server = Server { child, stdin, lines, seen: Vec::new(), next_id: 0 };
        let init = server.request(
            "initialize",
            json!({"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "0"}}),
        );
        assert!(init["result"]["capabilities"]["tools"].is_object(), "{init}");
        assert!(init["result"]["capabilities"]["resources"].is_null());
        assert!(init["result"]["capabilities"]["prompts"].is_null());
        server.send(&json!({"jsonrpc": "2.0", "method": "notifications/initialized"}));
        server
    }

    fn send(&mut self, message: &Value) {
        writeln!(self.stdin, "{message}").unwrap();
        self.stdin.flush().unwrap();
    }

    fn request(&mut self, method: &str, params: Value) -> Value {
        self.next_id += 1;
        let id = self.next_id;
        self.send(&json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params}));
        loop {
            let line = self.lines.recv_timeout(Duration::from_secs(20)).expect("no answer from khi-mcp");
            self.seen.push(line.clone());
            let value: Value = serde_json::from_str(&line).unwrap_or_else(|e| panic!("not JSON ({e}): {line}"));
            assert_eq!(value["jsonrpc"], "2.0", "not JSON-RPC: {line}");
            if value["id"] == json!(id) {
                return value;
            }
        }
    }

    fn call(&mut self, tool: &str, arguments: Value) -> Value {
        self.request("tools/call", json!({"name": tool, "arguments": arguments}))["result"].clone()
    }

    fn finish(mut self) {
        drop(self.stdin);
        let _ = self.child.wait();
        // Nothing but JSON-RPC came out, up to the last byte.
        for line in self.lines.try_iter() {
            let value: Value = serde_json::from_str(&line).unwrap_or_else(|e| panic!("not JSON ({e}): {line}"));
            assert_eq!(value["jsonrpc"], "2.0");
        }
    }
}

fn ids(result: &Value, path: &[&str]) -> Vec<String> {
    let mut v = &result["structuredContent"];
    for key in path {
        v = &v[*key];
    }
    v.as_array().unwrap_or(&Vec::new()).iter().map(|h| h["id"].as_str().unwrap().to_string()).collect()
}

#[test]
fn tools_are_listed_with_annotations_and_schemas() {
    let home = eval_home();
    let mut s = Server::start(&home, &["--dev"]);
    let listed = s.request("tools/list", json!({}));
    let tools = listed["result"]["tools"].as_array().unwrap();
    let names: Vec<_> = tools.iter().map(|t| t["name"].as_str().unwrap()).collect();
    assert_eq!(names, ["list_readers", "list_books", "get_book", "search_highlights", "new_highlights"]);
    for tool in tools {
        let name = &tool["name"];
        let a = &tool["annotations"];
        assert_eq!(
            (&a["readOnlyHint"], &a["destructiveHint"], &a["idempotentHint"], &a["openWorldHint"]),
            (&json!(true), &json!(false), &json!(true), &json!(false)),
            "{name}"
        );
        assert_eq!(tool["inputSchema"]["type"], "object", "{name}");
        assert_eq!(tool["outputSchema"]["type"], "object", "{name}");
        let description = tool["description"].as_str().unwrap();
        assert!(description.contains("not instructions"), "{name}: says the content is not instructions");
    }
    let description_of = |n: &str| tools.iter().find(|t| t["name"] == n).unwrap()["description"].as_str().unwrap().to_string();
    assert!(description_of("new_highlights").contains("syncedSince"));
    assert!(description_of("search_highlights").to_lowercase().contains("not a meaning search"));
    // Highlight text is whole only while the answer fits the ceiling
    let get_book = description_of("get_book");
    assert!(!get_book.contains("returned whole."), "{get_book}");
    assert!(get_book.contains("truncated"), "{get_book}");
    let book_schema = &tools.iter().find(|t| t["name"] == "get_book").unwrap()["outputSchema"]["properties"]["book"];
    let book_props = book_schema["properties"].as_object().expect("book declares its properties");
    for wanted in ["id", "readerId", "title", "author", "language", "dateLastRead", "highlightCount", "noteCount",
                   "newCount", "removedCount", "isbn", "publisher", "description", "truncated"] {
        assert!(book_props.contains_key(wanted), "book.{wanted} is not in the schema");
    }
    s.finish();
}

#[test]
fn every_tool_answers_on_the_eval_library() {
    let home = eval_home();
    let mut s = Server::start(&home, &["--dev"]);
    let tools = s.request("tools/list", json!({}))["result"]["tools"].clone();
    let schema_keys = |name: &str| -> Vec<String> {
        let tool = tools.as_array().unwrap().iter().find(|t| t["name"] == name).unwrap();
        let mut keys: Vec<String> = tool["outputSchema"]["properties"].as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    };
    let keys_of = |r: &Value| -> Vec<String> {
        let mut keys: Vec<String> = r["structuredContent"].as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    };

    let readers = s.call("list_readers", json!({}));
    assert_eq!(readers["isError"], false);
    assert_eq!(readers["structuredContent"]["readers"].as_array().unwrap().len(), 3);
    assert_eq!(keys_of(&readers), schema_keys("list_readers"));
    // The text is the same JSON as the structured content.
    let text: Value = serde_json::from_str(readers["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(text, readers["structuredContent"]);

    // Paging works like the other lists.
    let first = s.call("list_readers", json!({"limit": 2}));
    assert_eq!(first["structuredContent"]["readers"].as_array().unwrap().len(), 2);
    assert_eq!(first["structuredContent"]["total"], 3);
    let cursor = first["structuredContent"]["nextCursor"].clone();
    let last = s.call("list_readers", json!({"limit": 2, "cursor": cursor}));
    assert_eq!(last["structuredContent"]["readers"][0]["name"], "Rui");
    assert!(last["structuredContent"]["nextCursor"].is_null());

    let books = s.call("list_books", json!({"readerId": 1, "query": "confianca"}));
    assert_eq!(books["structuredContent"]["total"], 1);
    assert_eq!(keys_of(&books), schema_keys("list_books"));
    let book_id = books["structuredContent"]["books"][0]["id"].clone();

    let book = s.call("get_book", json!({"bookId": book_id}));
    assert_eq!(ids(&book, &["highlights"]), ["conf-01", "conf-02", "conf-03", "conf-04", "conf-05"]);
    assert_eq!(keys_of(&book), schema_keys("get_book"));

    let found = s.call("search_highlights", json!({"query": "coracao", "in": ["text"]}));
    assert_eq!(found["structuredContent"]["results"].as_array().unwrap().len(), 1);
    assert_eq!(found["structuredContent"]["results"][0]["highlight"]["id"], "conf-03");
    assert_eq!(keys_of(&found), schema_keys("search_highlights"));

    let news = s.call("new_highlights", json!({}));
    assert_eq!(news["structuredContent"]["totalHighlights"], 3);
    assert_eq!(keys_of(&news), schema_keys("new_highlights"));
    let since = s.call("new_highlights", json!({"mode": "syncedSince", "since": "2026-11-01", "readerId": 1}));
    assert_eq!(since["structuredContent"]["totalHighlights"], 5);

    // The fields the plan keeps private are in no answer at all.
    for line in &s.seen {
        for key in ["serial", "exportPath", "coverPath", "containerPath"] {
            assert!(!line.contains(&format!("\"{key}\"")), "{key} leaked");
        }
    }
    s.finish();
}

#[test]
fn domain_errors_are_tool_results_with_is_error() {
    let home = eval_home();
    let mut s = Server::start(&home, &["--dev"]);
    let missing = s.call("get_book", json!({"bookId": 99999}));
    assert_eq!(missing["isError"], true);
    assert!(missing["content"][0]["text"].as_str().unwrap().contains("No such book"));
    let cursor = s.call("list_books", json!({"cursor": "nope"}));
    assert_eq!(cursor["isError"], true);
    assert!(cursor["content"][0]["text"].as_str().unwrap().contains("Invalid cursor"));
    let query = s.call("search_highlights", json!({"query": "a"}));
    assert_eq!(query["isError"], true);
    let date = s.call("new_highlights", json!({"mode": "syncedSince", "since": "ontem"}));
    assert_eq!(date["isError"], true);
    let no_since = s.call("new_highlights", json!({"mode": "syncedSince"}));
    assert_eq!(no_since["isError"], true);
    let bad_args = s.call("get_book", json!({"book": 1}));
    assert_eq!(bad_args["isError"], true);
    s.finish();
}

#[test]
fn since_without_a_mode_means_synced_since_and_with_unseen_is_refused() {
    let home = eval_home();
    let mut s = Server::start(&home, &["--dev"]);
    let explicit = s.call("new_highlights", json!({"mode": "syncedSince", "since": "2026-11-01", "readerId": 1}));
    assert_eq!(explicit["structuredContent"]["totalHighlights"], 5);
    // `since` alone is not ignored: it picks syncedSince.
    let bare = s.call("new_highlights", json!({"since": "2026-11-01", "readerId": 1}));
    assert_eq!(bare["isError"], false, "{bare}");
    assert_eq!(bare["structuredContent"], explicit["structuredContent"]);
    // `since` with unseen is a mistake, not something to drop silently.
    let both = s.call("new_highlights", json!({"mode": "unseen", "since": "2026-11-01"}));
    assert_eq!(both["isError"], true, "{both}");
    assert!(both["content"][0]["text"].as_str().unwrap().contains("since only works with mode syncedSince"));
    // Without `since` nothing changes.
    let plain = s.call("new_highlights", json!({}));
    assert_eq!(plain["structuredContent"]["totalHighlights"], 3);
    s.finish();
}

#[test]
fn a_missing_library_is_an_error_result_and_nothing_is_created() {
    let home = TempDir::new().unwrap();
    let mut s = Server::start(&home, &["--dev"]);
    for tool in ["list_readers", "list_books", "new_highlights"] {
        let result = s.call(tool, json!({}));
        assert_eq!(result["isError"], true, "{tool}");
        assert!(result["content"][0]["text"].as_str().unwrap().contains("No Library found"), "{tool}");
    }
    s.finish();
    assert!(!home.path().join("Library").exists(), "the khi-mcp created something");
}

/// A Library built by the app's own code in `dir`, closed again.
fn library_in(dir: &std::path::Path) {
    std::fs::create_dir_all(dir).unwrap();
    drop(khi_lib::library::eval_fixture::build_eval_library(dir).unwrap());
}

#[test]
fn a_library_symlinked_after_startup_is_refused_on_every_call() {
    let home = TempDir::new().unwrap();
    let dir = data_dir(&home);
    std::fs::create_dir_all(&dir).unwrap();
    // The server starts with no library.sqlite at all.
    let mut s = Server::start(&home, &["--dev"]);
    assert_eq!(s.call("list_readers", json!({}))["isError"], true);

    // A symlink to someone's KoboReader.sqlite, made afterwards.
    let kobo_dir = home.path().join("kobo");
    library_in(&kobo_dir);
    std::fs::rename(kobo_dir.join("library.sqlite"), kobo_dir.join("KoboReader.sqlite")).unwrap();
    let link = dir.join("library.sqlite");
    std::os::unix::fs::symlink(kobo_dir.join("KoboReader.sqlite"), &link).unwrap();
    let refused = s.call("list_readers", json!({}));
    assert_eq!(refused["isError"], true, "{refused}");
    assert!(refused["structuredContent"].is_null());

    // A symlink to a library.sqlite in another folder.
    let other = home.path().join("other");
    library_in(&other);
    std::fs::remove_file(&link).unwrap();
    std::os::unix::fs::symlink(other.join("library.sqlite"), &link).unwrap();
    let refused = s.call("list_books", json!({}));
    assert_eq!(refused["isError"], true, "{refused}");

    // A normal file there works, with the same server still running.
    std::fs::remove_file(&link).unwrap();
    std::fs::copy(other.join("library.sqlite"), &link).unwrap();
    let readers = s.call("list_readers", json!({}));
    assert_eq!(readers["isError"], false, "{readers}");
    assert_eq!(readers["structuredContent"]["readers"].as_array().unwrap().len(), 3);
    s.finish();
}

#[test]
fn reader_flag_limits_every_tool() {
    let home = eval_home();
    let mut s = Server::start(&home, &["--dev", "--reader", "2"]);
    let readers = s.call("list_readers", json!({}));
    let names: Vec<_> = readers["structuredContent"]["readers"].as_array().unwrap().iter().map(|r| r["name"].as_str().unwrap()).collect();
    assert_eq!(names, ["Ana"]);
    // Asking for another Reader changes nothing.
    let books = s.call("list_books", json!({"readerId": 1, "limit": 100}));
    assert_eq!(books["structuredContent"]["total"], 4);
    assert!(books["structuredContent"]["books"].as_array().unwrap().iter().all(|b| b["readerId"] == 2));
    // Bruno's book is not found.
    let bruno_book = {
        let mut open = Server::start(&home, &["--dev"]);
        let b = open.call("list_books", json!({"readerId": 1, "query": "confianca"}));
        let id = b["structuredContent"]["books"][0]["id"].clone();
        open.finish();
        id
    };
    let result = s.call("get_book", json!({"bookId": bruno_book}));
    assert_eq!(result["isError"], true);
    assert!(result["content"][0]["text"].as_str().unwrap().contains("No such book"));
    let found = s.call("search_highlights", json!({"query": "fortuna", "readerId": 1}));
    assert_eq!(found["structuredContent"]["results"].as_array().unwrap().len(), 1);
    assert_eq!(found["structuredContent"]["results"][0]["highlight"]["id"], "ana-conf-01");
    let news = s.call("new_highlights", json!({"readerId": 1}));
    assert_eq!(news["structuredContent"]["totalHighlights"], 0);
    s.finish();
}

#[test]
fn unknown_arguments_are_refused() {
    let output = Command::new(env!("CARGO_BIN_EXE_khi-mcp"))
        .args(["--wat"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
    let output = Command::new(env!("CARGO_BIN_EXE_khi-mcp"))
        .args(["--reader", "abc"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
}
