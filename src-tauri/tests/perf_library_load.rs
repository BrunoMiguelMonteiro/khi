//! Medição, não regressão: quanto custa carregar a Biblioteca para a grelha.
//! Corre à mão (`--ignored --nocapture`, de preferência com `--release`).
//! Biblioteca sintética em pasta temporária; nunca toca na Biblioteca real.

mod common;

use common::no_cover;
use khi_lib::commands::library::get_library_with;
use khi_lib::library::read::{open_read_only, BookSort, GetBook, ListBooks};
use khi_lib::library::Library;
use khi_lib::models::{KoboBook, KoboHighlight, KoboSnapshot};
use std::time::Instant;
use tempfile::TempDir;

const PHRASE: &str = "A memória é uma construção que o presente refaz a cada vez que a visita, e por isso o que lembramos nunca é exatamente o que aconteceu. ";

fn build(books: usize, per_book: usize) -> (TempDir, Library, u32) {
    let dir = TempDir::new().unwrap();
    let lib = Library::open(dir.path()).unwrap();
    let reader = lib.create_reader("Medição").unwrap();
    lib.associate_kobo("PERF", reader.id).unwrap();
    let snapshot = KoboSnapshot {
        books: (0..books)
            .map(|b| KoboBook {
                volume_id: format!("file:///mnt/onboard/perf-{b}.epub"),
                title: format!("Livro sintético número {b:03}"),
                author: format!("Autor {}", b % 120),
                language: Some("pt".into()),
                description: Some("Descrição curta do livro sintético.".into()),
                highlights: (0..per_book)
                    .map(|n| KoboHighlight {
                        bookmark_id: format!("b{b}-h{n}"),
                        // 80 a ~500 caracteres, média perto de 270
                        text: PHRASE.repeat(1 + (b + n) % 3).chars().take(80 + (n * 37) % 420).collect(),
                        annotation: (n % 7 == 0).then(|| "Nota minha sobre esta passagem.".to_string()),
                        chapter_title: Some(format!("Capítulo {}", n / 4 + 1)),
                        chapter_progress: Some(n as f64 / per_book as f64),
                        date_created: "2026-10-01T10:00:00Z".to_string(),
                        ..Default::default()
                    })
                    .collect(),
                ..Default::default()
            })
            .collect(),
    };
    let mut lib = lib;
    lib.sync("PERF", &snapshot, &no_cover, |_, _| {}).unwrap();
    (dir, lib, reader.id)
}

fn median_ms(mut runs: Vec<f64>) -> f64 {
    runs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    runs[runs.len() / 2]
}

fn time<T>(n: usize, mut f: impl FnMut() -> T) -> (f64, T) {
    let mut runs = Vec::new();
    let mut last = None;
    for _ in 0..n {
        let t = Instant::now();
        last = Some(f());
        runs.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    (median_ms(runs), last.unwrap())
}

#[test]
#[ignore]
fn measure_library_load() {
    for (books, per_book) in [(30, 21), (500, 40)] {
        let (dir, lib, reader) = build(books, per_book);
        println!("\n== {books} livros, {} destaques ==", books * per_book);

        let (load_ms, loaded) = time(7, || get_library_with(&lib, reader).unwrap());
        let (ser_ms, json) = time(7, || serde_json::to_string(&loaded).unwrap());
        println!("get_library_with (SQLite -> Vec): {load_ms:.1} ms");
        println!("serde_json::to_string:            {ser_ms:.1} ms");
        println!("JSON do IPC:                      {:.2} MB", json.len() as f64 / 1_048_576.0);
        std::fs::write(std::env::temp_dir().join(format!("khi-perf-{books}.json")), &json).unwrap();

        let read = open_read_only(dir.path()).unwrap();
        let (sum_ms, page) = time(7, || {
            read.list_books(&ListBooks {
                reader_id: Some(reader),
                sort: BookSort::Title,
                limit: Some(100),
                ..Default::default()
            })
            .unwrap()
        });
        let sum_json = serde_json::to_string(&page).unwrap();
        println!("list_books (100 resumos):         {sum_ms:.1} ms, {:.1} KB", sum_json.len() as f64 / 1024.0);
        let id = loaded[0].id;
        let (book_ms, bp) = time(7, || read.get_book(&GetBook { book_id: id, ..Default::default() }).unwrap());
        let book_json = serde_json::to_string(&bp).unwrap();
        println!("get_book (1 livro, 1 página):     {book_ms:.1} ms, {:.1} KB", book_json.len() as f64 / 1024.0);
    }
}
