//! The 16 KB ceiling holds for any data: one huge text, note, chapter, title
//! or publisher is shortened and flagged, never allowed to break the page.

mod common;

use common::{hl, kobo_book, no_cover, no_progress, snapshot, KOBO_A};
use khi_lib::library::read::{
    open_read_only, GetBook, ListBooks, NewHighlights, NewMode, ReadLibrary, SearchParams,
};
use khi_lib::models::{KoboBook, KoboHighlight};
use tempfile::TempDir;

const CEILING: usize = 16 * 1024;

fn size(value: &impl serde::Serialize) -> usize {
    serde_json::to_vec(value).unwrap().len()
}

fn kobo_hl(id: &str, text: &str, progress: f64) -> KoboHighlight {
    KoboHighlight { chapter_progress: Some(progress), ..hl(id, text) }
}

/// "Giant": normal highlights with a 30 000-char text, a 40 000-char note and
/// a 30 000-char chapter in between. "Alpha": normal. "Zed": a 30 000-char title.
/// "Pub": a 30 000-char publisher. The second sync makes them all new.
fn library() -> (TempDir, ReadLibrary) {
    let (dir, mut app, _) = common::setup();
    let seed = kobo_book("file:///mnt/onboard/seed.epub", "Seed", "S", vec![hl("seed", "old")]);
    app.sync(KOBO_A, &snapshot(vec![seed.clone()]), &no_cover, no_progress).unwrap();

    let normal = |prefix: &str, from: usize, to: usize, base: f64| -> Vec<KoboHighlight> {
        (from..=to)
            .map(|i| kobo_hl(&format!("{prefix}{i:02}"), &format!("needle {prefix} {i}"), base + i as f64 / 1000.0))
            .collect()
    };
    let mut giant = normal("n", 1, 5, 0.0);
    giant.push(kobo_hl("huge-text", &format!("needle {}", "x".repeat(30_000)), 0.10));
    giant.extend(normal("n", 6, 8, 0.2));
    giant.push(KoboHighlight { annotation: Some("y".repeat(40_000)), ..kobo_hl("huge-note", "needle", 0.5) });
    giant.extend(normal("n", 9, 10, 0.6));
    giant.push(KoboHighlight { chapter_title: Some("c".repeat(30_000)), ..kobo_hl("huge-chapter", "needle", 0.8) });
    giant.extend(normal("n", 11, 11, 0.9));

    let alpha = kobo_book("file:///mnt/onboard/a.epub", "Alpha", "A", normal("a", 1, 5, 0.0));
    let giant = kobo_book("file:///mnt/onboard/g.epub", "Giant", "G", giant);
    let zed = kobo_book(
        "file:///mnt/onboard/z.epub",
        &format!("Zed {}", "t".repeat(30_000)),
        "Z",
        normal("z", 1, 3, 0.0),
    );
    let publisher = KoboBook {
        publisher: Some("p".repeat(30_000)),
        ..kobo_book("file:///mnt/onboard/p.epub", "Pub", "P", normal("p", 1, 3, 0.0))
    };
    app.sync(KOBO_A, &snapshot(vec![seed, alpha, giant, zed, publisher]), &no_cover, no_progress).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    (dir, lib)
}

fn book_id(lib: &ReadLibrary, title: &str) -> u32 {
    lib.list_books(&ListBooks { query: Some(title.into()), ..Default::default() }).unwrap().books[0].id
}

#[test]
fn get_book_shortens_one_huge_item_and_keeps_the_pages_around_it() {
    let (_dir, lib) = library();
    let id = book_id(&lib, "giant");
    let mut pages = Vec::new();
    let mut cursor = None;
    loop {
        let page = lib.get_book(&GetBook { book_id: id, cursor: cursor.clone(), ..Default::default() }).unwrap();
        assert!(size(&page) <= CEILING, "{} bytes", size(&page));
        pages.push(page.clone());
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    let layout: Vec<Vec<&str>> =
        pages.iter().map(|p| p.highlights.iter().map(|h| h.id.as_str()).collect()).collect();
    // The normal highlights before a huge one stay together; a huge one is alone.
    assert_eq!(layout[0], ["n01", "n02", "n03", "n04", "n05"]);
    assert_eq!(layout[1], ["huge-text"]);
    assert_eq!(layout.iter().map(Vec::len).sum::<usize>(), 11 + 3);

    let all: Vec<_> = pages.iter().flat_map(|p| p.highlights.iter()).collect();
    let find = |id: &str| all.iter().find(|h| h.id == id).unwrap();
    let text = find("huge-text");
    assert!(text.truncated && text.text.len() < 30_000 && text.text.starts_with("needle xxx"));
    let note = find("huge-note");
    assert!(note.truncated && note.note.as_ref().unwrap().len() < 40_000 && note.text == "needle");
    let chapter = find("huge-chapter");
    assert!(chapter.truncated && chapter.chapter.as_ref().unwrap().len() < 30_000);
    assert!(all.iter().filter(|h| h.id.starts_with('n')).all(|h| !h.truncated), "normal text stays whole");
}

#[test]
fn get_book_shortens_a_huge_title_or_publisher() {
    let (_dir, lib) = library();
    for title in ["zed", "pub"] {
        let id = book_id(&lib, title);
        let mut cursor = None;
        let mut seen = 0;
        loop {
            let page = lib.get_book(&GetBook { book_id: id, cursor: cursor.clone(), ..Default::default() }).unwrap();
            assert!(size(&page) <= CEILING, "{title}: {} bytes", size(&page));
            assert!(page.book.summary.truncated, "{title}");
            seen += page.highlights.len();
            match page.next_cursor {
                Some(c) => cursor = Some(c),
                None => break,
            }
        }
        assert_eq!(seen, 3, "{title}");
    }
}

#[test]
fn list_books_shortens_a_huge_title_alone_on_its_page() {
    let (_dir, lib) = library();
    let mut cursor = None;
    let mut pages = Vec::new();
    loop {
        let page = lib.list_books(&ListBooks { limit: Some(100), cursor: cursor.clone(), ..Default::default() }).unwrap();
        assert!(size(&page) <= CEILING, "{} bytes", size(&page));
        pages.push(page.clone());
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert_eq!(pages.len(), 2);
    let titles: Vec<&str> = pages[0].books.iter().map(|b| b.title.as_str()).collect();
    assert_eq!(titles, ["Alpha", "Giant", "Pub", "Seed"]);
    assert!(pages[0].books.iter().all(|b| !b.truncated));
    assert_eq!(pages[1].books.len(), 1);
    assert!(pages[1].books[0].truncated && pages[1].books[0].title.starts_with("Zed ttt"));
}

#[test]
fn search_keeps_every_page_under_the_ceiling() {
    let (_dir, lib) = library();
    let mut cursor = None;
    let (mut seen, mut widest) = (Vec::new(), 0);
    loop {
        let page = lib
            .search_highlights(&SearchParams {
                query: "needle".into(),
                limit: Some(100),
                cursor: cursor.clone(),
                ..Default::default()
            })
            .unwrap();
        assert!(size(&page) <= CEILING, "{} bytes", size(&page));
        widest = widest.max(page.results.len());
        seen.extend(page.results.iter().cloned());
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert_eq!(seen.len(), 5 + 14 + 3 + 3);
    assert!(widest >= 5, "a normal page still carries several hits");
    let flagged = |id: &str| seen.iter().find(|r| r.highlight.id == id).unwrap();
    assert!(flagged("huge-text").highlight.truncated);
    assert!(flagged("huge-note").highlight.truncated);
    assert!(flagged("huge-chapter").highlight.truncated);
    assert!(seen.iter().filter(|r| r.book.title.starts_with("Zed")).all(|r| r.book.truncated));
}

#[test]
fn new_highlights_keeps_every_page_under_the_ceiling() {
    let (_dir, lib) = library();
    let mut cursor = None;
    let (mut seen, mut widest) = (Vec::new(), 0);
    loop {
        let page = lib
            .new_highlights(&NewHighlights {
                mode: NewMode::SyncedSince("2000-01-01".into()),
                limit: Some(100),
                cursor: cursor.clone(),
                ..Default::default()
            })
            .unwrap();
        assert!(size(&page) <= CEILING, "{} bytes", size(&page));
        widest = widest.max(page.groups.iter().map(|g| g.highlights.len()).sum());
        for g in &page.groups {
            seen.extend(g.highlights.iter().map(|h| (h.id.clone(), h.truncated, g.book.truncated)));
        }
        match page.next_cursor {
            Some(c) => cursor = Some(c),
            None => break,
        }
    }
    assert_eq!(seen.len(), 5 + 14 + 3 + 3);
    assert!(widest >= 5, "a normal page still carries several highlights");
    let flagged = |id: &str| seen.iter().find(|s| s.0 == id).unwrap();
    assert!(flagged("huge-text").1 && flagged("huge-note").1 && flagged("huge-chapter").1);
    assert!(["z01", "z02", "z03"].iter().all(|id| flagged(id).2), "the huge title is flagged on its book");
}

#[test]
fn list_readers_shortens_a_huge_name() {
    let (dir, app, _) = common::setup();
    app.create_reader(&"r".repeat(30_000)).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    let readers = lib.list_readers().unwrap();
    assert!(size(&serde_json::json!({ "readers": readers })) <= CEILING);
    assert!(readers.iter().any(|r| r.truncated));
}

#[test]
fn escaped_and_multibyte_characters_are_cut_whole() {
    let (dir, mut app, _) = common::setup();
    let one = KoboHighlight { annotation: Some("\"é\n".repeat(9000)), ..hl("e", &"ü€".repeat(9000)) };
    let book = kobo_book("file:///mnt/onboard/e.epub", "Esc", "E", vec![one]);
    app.sync(KOBO_A, &snapshot(vec![book]), &no_cover, no_progress).unwrap();
    let lib = open_read_only(dir.path()).unwrap();
    let page = lib.get_book(&GetBook { book_id: book_id(&lib, "esc"), ..Default::default() }).unwrap();
    assert!(size(&page) <= CEILING, "{} bytes", size(&page));
    assert!(page.highlights[0].truncated);
}
