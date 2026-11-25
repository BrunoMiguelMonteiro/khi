//! Accent-insensitive search over the highlights (docs/plans/0003-mcp.md, test 9).

mod common;

use common::{hl, kobo_book, no_cover, no_progress, snapshot, KOBO_A};
use khi_lib::library::eval_fixture::build_eval_library;
use khi_lib::library::read::{
    open_read_only, ListBooks, MatchedIn, ReadError, ReadLibrary, SearchIn, SearchPage, SearchParams,
};
use serde_json::Value;
use tempfile::TempDir;

const CEILING: usize = 16 * 1024;

fn eval() -> (TempDir, khi_lib::library::Library, ReadLibrary) {
    let dir = TempDir::new().unwrap();
    let app = build_eval_library(dir.path()).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    (dir, app, lib)
}

fn find(query: &str) -> SearchParams {
    SearchParams { query: query.into(), ..Default::default() }
}

fn ids(page: &SearchPage) -> Vec<&str> {
    page.results.iter().map(|r| r.highlight.id.as_str()).collect()
}

fn sorted(mut v: Vec<&str>) -> Vec<&str> {
    v.sort();
    v
}

fn keys(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => map.iter().for_each(|(k, v)| {
            out.push(k.clone());
            keys(v, out);
        }),
        Value::Array(items) => items.iter().for_each(|v| keys(v, out)),
        _ => {}
    }
}

#[test]
fn accents_and_case_do_not_matter() {
    let (_dir, _app, lib) = eval();
    let page = lib.search_highlights(&find("coracao")).unwrap();
    assert_eq!(ids(&page), ["conf-03"]);
    assert_eq!(page.results[0].matched_in, MatchedIn::Text);
    assert_eq!(ids(&lib.search_highlights(&find("CORAÇÃO")).unwrap()), ["conf-03"]);
}

#[test]
fn in_note_does_not_find_the_text() {
    let (_dir, _app, lib) = eval();
    let note = SearchParams { search_in: SearchIn::Note, ..find("rever") };
    let page = lib.search_highlights(&note).unwrap();
    assert_eq!(sorted(ids(&page)), ["conf-02", "duly-02"]);
    assert!(page.results.iter().all(|r| r.matched_in == MatchedIn::Note));

    let text = SearchParams { search_in: SearchIn::Text, ..find("rever") };
    assert_eq!(ids(&lib.search_highlights(&text).unwrap()), ["sap-01"]);

    let both = lib.search_highlights(&find("rever")).unwrap();
    assert_eq!(sorted(ids(&both)), ["conf-02", "duly-02", "sap-01"]);
}

#[test]
fn two_words_in_any_order() {
    let (_dir, _app, lib) = eval();
    assert_eq!(ids(&lib.search_highlights(&find("liberdade responsabilidade")).unwrap()), ["sap-03"]);
    assert_eq!(ids(&lib.search_highlights(&find("responsabilidade liberdade")).unwrap()), ["sap-03"]);
    assert!(lib.search_highlights(&find("liberdade fortuna")).unwrap().results.is_empty());
}

#[test]
fn reader_and_book_filter() {
    let (_dir, _app, lib) = eval();
    let both = lib.search_highlights(&find("fortuna")).unwrap();
    assert_eq!(sorted(ids(&both)), ["ana-conf-01", "conf-03"]);

    let ana = lib.search_highlights(&SearchParams { reader_id: Some(2), ..find("fortuna") }).unwrap();
    assert_eq!(ids(&ana), ["ana-conf-01"]);

    let book = lib
        .list_books(&ListBooks { reader_id: Some(1), query: Some("confianca".into()), ..Default::default() })
        .unwrap()
        .books[0]
        .id;
    let one = lib.search_highlights(&SearchParams { book_id: Some(book), ..find("fortuna") }).unwrap();
    assert_eq!(ids(&one), ["conf-03"]);
    assert_eq!((one.results[0].book.id, one.results[0].book.title.as_str()), (book, "Confiança"));
    assert_eq!(one.results[0].book.author, "Hernán Díaz");
}

#[test]
fn include_removed() {
    let (_dir, _app, lib) = eval();
    let with = lib.search_highlights(&find("dinheiro")).unwrap();
    assert_eq!(sorted(ids(&with)), ["conf-02", "sap-05"]);
    assert!(with.results.iter().any(|r| r.highlight.removed));
    let without = lib
        .search_highlights(&SearchParams { include_removed: false, ..find("dinheiro") })
        .unwrap();
    assert_eq!(ids(&without), ["conf-02"]);
}

#[test]
fn query_length_is_checked() {
    let (_dir, _app, lib) = eval();
    for bad in ["", "a", " b ", "!!", &"x".repeat(201)] {
        let result = lib.search_highlights(&find(bad));
        assert!(matches!(result, Err(ReadError::InvalidQuery)), "{bad:?}: {result:?}");
    }
    assert!(lib.search_highlights(&find("ab")).is_ok());
    assert!(lib.search_highlights(&find(&"x".repeat(200))).is_ok());
}

/// A Library with one highlight per text, ids `h000000`, `h000001`, ...
fn with_texts(texts: &[&str]) -> (TempDir, ReadLibrary) {
    many(texts.len(), |i| texts[i].to_string())
}

#[test]
fn a_term_matches_the_start_of_a_word_not_the_middle() {
    let (_dir, lib) = with_texts(&["we start here", "a arte de rever", "Art of war", "smart move"]);
    assert_eq!(sorted(ids(&lib.search_highlights(&find("art")).unwrap())), ["h000001", "h000002"]);
    // A word start, any later word of the text counts
    assert_eq!(ids(&lib.search_highlights(&find("rever")).unwrap()), ["h000001"]);
    // Every term still has to match, in any order
    assert_eq!(ids(&lib.search_highlights(&find("war art")).unwrap()), ["h000002"]);
}

#[test]
fn a_term_is_a_prefix_of_the_word() {
    let (_dir, lib) = with_texts(&["as liberdades do corpo", "a liberdade", "libertar"]);
    assert_eq!(sorted(ids(&lib.search_highlights(&find("liberdade")).unwrap())), ["h000000", "h000001"]);
    assert_eq!(ids(&lib.search_highlights(&find("liberdades")).unwrap()), ["h000000"]);
}

#[test]
fn letters_that_nfd_keeps_are_folded_on_both_sides() {
    let (_dir, lib) = with_texts(&["Visita a Łódź", "Straße 5 em Berlim", "Ørsted and Æther", "Œuvre de Đorđe", "Þor e ı", "other"]);
    let find_ids = |q: &str| ids(&lib.search_highlights(&find(q)).unwrap()).iter().map(|s| s.to_string()).collect::<Vec<_>>();
    assert_eq!(find_ids("lodz"), ["h000000"]);
    assert_eq!(find_ids("ŁÓDŹ"), ["h000000"]);
    assert_eq!(find_ids("strasse"), ["h000001"]);
    assert_eq!(find_ids("Straße"), ["h000001"]);
    assert_eq!(find_ids("orsted"), ["h000002"]);
    assert_eq!(find_ids("aether"), ["h000002"]);
    assert_eq!(find_ids("oeuvre"), ["h000003"]);
    assert_eq!(find_ids("dorde"), ["h000003"]);
    assert_eq!(find_ids("thor"), ["h000004"]);
    assert_eq!(find_ids("ii"), Vec::<String>::new());
}

#[test]
fn a_query_needs_one_word_of_two_characters() {
    let (_dir, lib) = with_texts(&["a b c d", "alpha beta"]);
    for bad in ["a.", "%%", "a%", "a %", "  ."] {
        let result = lib.search_highlights(&find(bad));
        assert!(matches!(result, Err(ReadError::InvalidQuery)), "{bad:?}: {result:?}");
    }
    assert_eq!(ids(&lib.search_highlights(&find("al be")).unwrap()), ["h000001"]);
    // The 1-character terms are dropped, not matched
    assert_eq!(ids(&lib.search_highlights(&find("alpha b")).unwrap()), ["h000001"]);
    assert_eq!(ids(&lib.search_highlights(&find("a alpha")).unwrap()), ["h000001"]);
    let message = ReadError::InvalidQuery.to_string();
    assert!(message.contains("2 or more letters or digits"), "{message}");
}

#[test]
fn queries_with_short_words_still_find_the_long_ones() {
    let (_dir, lib) = with_texts(&[
        "Guerra e Paz é um romance",
        "defendo a liberdade de todos",
        "don't panic, I think so",
        "a gota d'água do copo",
        "nothing here",
    ]);
    let find_ids = |q: &str| ids(&lib.search_highlights(&find(q)).unwrap()).iter().map(|s| s.to_string()).collect::<Vec<_>>();
    assert_eq!(find_ids("Guerra e Paz"), ["h000000"]);
    assert_eq!(find_ids("a liberdade"), ["h000001"]);
    assert_eq!(find_ids("don't"), ["h000002"]);
    assert_eq!(find_ids("I think"), ["h000002"]);
    assert_eq!(find_ids("d'água"), ["h000003"]);
}

#[test]
fn the_cursor_follows_the_terms_matched_not_the_short_words() {
    let (_dir, lib) = many(5, |i| format!("liberdade {i}"));
    let first = lib.search_highlights(&SearchParams { limit: Some(2), ..find("a liberdade") }).unwrap();
    let cursor = first.next_cursor.clone().expect("more pages");
    // The same terms matched, spelled with another short word, take the cursor
    let next = lib
        .search_highlights(&SearchParams { limit: Some(2), cursor: Some(cursor.clone()), ..find("e liberdade") })
        .unwrap();
    assert_eq!(ids(&next), ["h000002", "h000003"]);
    // Other terms do not
    let other = lib.search_highlights(&SearchParams { cursor: Some(cursor), ..find("a liberdades") });
    assert!(matches!(other, Err(ReadError::InvalidCursor)));
}

#[test]
fn no_private_keys_and_the_documented_shape() {
    let (_dir, _app, lib) = eval();
    let page = lib.search_highlights(&find("fortuna")).unwrap();
    let mut found = Vec::new();
    keys(&serde_json::to_value(&page).unwrap(), &mut found);
    for wanted in ["results", "highlight", "book", "matchedIn", "nextCursor", "title", "author"] {
        assert!(found.iter().any(|k| k == wanted), "missing {wanted}");
    }
    for key in ["serial", "exportPath", "coverPath", "containerPath", "koboSerial"] {
        assert!(!found.iter().any(|k| k == key), "{key} leaked");
    }
    let value = serde_json::to_value(&page).unwrap();
    assert_eq!(value["results"][0]["matchedIn"], "text");
}

/// A Library with `count` highlights that all contain "needle".
fn many(count: usize, text: impl Fn(usize) -> String) -> (TempDir, ReadLibrary) {
    let (dir, mut app, _) = common::setup();
    let books = (0..count.div_ceil(1000).max(1))
        .map(|b| {
            let range = b * 1000..count.min((b + 1) * 1000);
            kobo_book(
                &format!("file:///mnt/onboard/{b}.epub"),
                &format!("Book {b:03}"),
                "Author",
                range.map(|i| hl(&format!("h{i:06}"), &text(i))).collect(),
            )
        })
        .collect();
    app.sync(KOBO_A, &snapshot(books), &no_cover, no_progress).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    (dir, lib)
}

#[test]
fn pages_cut_long_text_and_reach_the_end() {
    let (_dir, lib) = many(30, |i| if i == 7 { format!("needle {}", "y".repeat(5000)) } else { format!("a needle {i}") });
    let first = lib.search_highlights(&SearchParams { limit: Some(10), ..find("needle") }).unwrap();
    assert_eq!(first.results.len(), 10);
    assert!(first.next_cursor.is_some());

    let mut cursor = None;
    let mut all = Vec::new();
    loop {
        let page = lib
            .search_highlights(&SearchParams { limit: Some(100), cursor: cursor.clone(), ..find("needle") })
            .unwrap();
        assert!(serde_json::to_vec(&page).unwrap().len() <= CEILING);
        all.extend(page.results);
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert_eq!(all.len(), 30);
    let long = all.iter().find(|r| r.highlight.id == "h000007").unwrap();
    assert!(long.highlight.truncated);
    assert_eq!(long.highlight.text.chars().count(), 2000);
}

#[test]
fn bad_cursor() {
    let (_dir, _app, lib) = eval();
    let result = lib.search_highlights(&SearchParams { cursor: Some("nope".into()), ..find("fortuna") });
    assert!(matches!(result, Err(ReadError::InvalidCursor)));
}

/// Plan, B7 step 5: a search over 20 000 highlights, to run in release with
/// `cargo test --release -- --ignored --nocapture`. The target is under 50 ms.
#[test]
#[ignore]
fn search_20000_highlights_is_fast() {
    let words = ["confiança", "memória", "história", "liberdade", "cooperação", "árvore", "silêncio", "fortuna"];
    let (_dir, lib) = many(20_000, |i| {
        format!(
            "{} {} {} {} número {i}, com mais algum texto para ter um tamanho de destaque realista.",
            words[i % 8],
            words[(i / 8) % 8],
            words[(i / 64) % 8],
            words[(i / 512) % 8]
        )
    });
    let query = find("silencio fortuna");
    lib.search_highlights(&query).unwrap(); // warm up the page cache
    let mut best = std::time::Duration::MAX;
    for _ in 0..5 {
        let started = std::time::Instant::now();
        let page = lib.search_highlights(&SearchParams { limit: Some(100), ..query.clone() }).unwrap();
        best = best.min(started.elapsed());
        assert!(!page.results.is_empty());
    }
    // The worst case is a query that matches nothing: the whole Library is scanned.
    let started = std::time::Instant::now();
    let none = lib.search_highlights(&find("palavra inexistente")).unwrap();
    let full_scan = started.elapsed();
    assert!(none.results.is_empty());
    println!("SEARCH_MS best_hit={:.1} full_scan={:.1}", best.as_secs_f64() * 1000.0, full_scan.as_secs_f64() * 1000.0);
    assert!(full_scan.as_millis() < 50, "full scan took {full_scan:?}");
}
