//! The khi-mcp never touches a Kobo, never exports, and has no network
//! dependency (docs/plans/0003-mcp.md, «Segurança», tests 12 and the tree).

use std::path::{Path, PathBuf};
use std::process::Command;

const FORBIDDEN: [&str; 6] = ["KoboDatabase", "db::kobo", "device::", "sync_kobo", "export(", "MarkdownExporter"];

fn rust_files(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            rust_files(&path, out);
        } else if path.extension().is_some_and(|e| e == "rs") {
            out.push(path);
        }
    }
}

#[test]
fn sources_do_not_touch_kobos_or_exports() {
    let mut files = Vec::new();
    rust_files(&Path::new(env!("CARGO_MANIFEST_DIR")).join("src"), &mut files);
    assert!(files.len() >= 3, "{files:?}");
    for file in files {
        let text = std::fs::read_to_string(&file).unwrap();
        for word in FORBIDDEN {
            assert!(!text.contains(word), "{} contains {word}", file.display());
        }
    }
}

/// `cargo tree` resolves per package, so this is the tree of
/// `cargo build -p khi-mcp`, whatever features other workspace members use.
#[test]
fn dependency_tree_has_no_network_crates() {
    let output = Command::new(env!("CARGO"))
        .args(["tree", "-p", "khi-mcp", "-e", "normal", "--prefix", "none"])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let tree = String::from_utf8(output.stdout).unwrap();
    assert!(tree.lines().any(|l| l.starts_with("khi-mcp ")), "unexpected tree output");
    for line in tree.lines() {
        let name = line.split(' ').next().unwrap();
        for banned in ["reqwest", "hyper", "hyper-util", "hyper-rustls", "tauri-plugin-updater"] {
            assert_ne!(name, banned, "khi-mcp depends on {banned}");
        }
    }
}
