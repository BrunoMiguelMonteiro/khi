//! Builds the evaluation Library described by `mcp/eval/fixture.json`
//! (docs/plans/0003-mcp.md, test 15): the steps run through the app's own
//! `sync` and `mark_book_opened`, one at a time, in a temp dir. Behind the
//! `eval-fixture` feature, so it is not in the app build.

use super::Library;
use crate::models::{KoboBook, KoboHighlight, KoboSnapshot};
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const FIXTURE: &str = include_str!("../../../mcp/eval/fixture.json");

/// Every highlight in the fixture was underlined on this date.
const DATE_CREATED: &str = "2026-10-01T10:00:00Z";

/// The evaluation Library, built inside `data_dir`.
pub fn build_eval_library(data_dir: &Path) -> Result<Library, String> {
    build_from_json(data_dir, FIXTURE)
}

pub fn build_from_json(data_dir: &Path, json: &str) -> Result<Library, String> {
    let fixture: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let mut lib = Library::open(data_dir).map_err(|e| e.to_string())?;

    // reader key -> (Reader id, Kobo serial)
    let mut readers: HashMap<String, (u32, String)> = HashMap::new();
    for r in array(&fixture, "readers")? {
        let key = string(r, "key")?;
        let reader = lib.create_reader(&string(r, "name")?).map_err(|e| e.to_string())?;
        let serial = string(r, "kobo")?;
        lib.associate_kobo(&serial, reader.id).map_err(|e| e.to_string())?;
        readers.insert(key, (reader.id, serial));
    }

    let books = expand_books(array(&fixture, "books")?)?;

    for step in array(&fixture, "steps")? {
        if let Some(key) = step.get("sync").and_then(Value::as_str) {
            let (_, serial) = readers.get(key).ok_or(format!("unknown reader {key}"))?;
            let round = step.get("round").and_then(Value::as_u64).ok_or("sync needs a round")? as u32;
            let at: DateTime<Utc> = string(step, "at")?.parse().map_err(|e| format!("{e}"))?;
            let snapshot = KoboSnapshot {
                books: books
                    .iter()
                    .filter(|b| b.reader == key)
                    .map(|b| b.snapshot(round))
                    .collect(),
            };
            lib = lib.with_clock(move || at);
            lib.sync(serial, &snapshot, &|_: &KoboBook| -> Option<PathBuf> { None }, |_, _| {})
                .map_err(|e| e.to_string())?;
        } else if let Some(key) = step.get("open").and_then(Value::as_str) {
            let (reader_id, _) = readers.get(key).ok_or(format!("unknown reader {key}"))?;
            let volume_id = string(step, "book")?;
            let (book_id, max_seq): (u32, Option<u32>) = lib
                .conn
                .query_row(
                    "SELECT s.book_id, (SELECT MAX(synced_seq) FROM highlights WHERE book_id = s.book_id)
                     FROM book_sources s WHERE s.reader_id = ?1 AND s.volume_id = ?2",
                    rusqlite::params![reader_id, volume_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(|e| e.to_string())?;
            let seen = match step.get("seenSeq") {
                Some(Value::String(s)) if s == "max" => max_seq.unwrap_or(0),
                Some(v) => v.as_u64().ok_or("bad seenSeq")? as u32,
                None => return Err("open needs seenSeq".into()),
            };
            lib.mark_book_opened(*reader_id, book_id, seen).map_err(|e| e.to_string())?;
        } else {
            return Err(format!("unknown step {step}"));
        }
    }
    Ok(lib)
}

struct EvalHighlight {
    id: String,
    since: u32,
    removed_in: Option<u32>,
    text: String,
    note: Option<String>,
    chapter: Option<String>,
    progress: Option<f64>,
}

struct EvalBook {
    reader: String,
    volume_id: String,
    title: String,
    author: String,
    language: Option<String>,
    highlights: Vec<EvalHighlight>,
}

impl EvalBook {
    /// What the Kobo holds in sync round `round`: what arrived by then and
    /// was not yet removed.
    fn snapshot(&self, round: u32) -> KoboBook {
        KoboBook {
            volume_id: self.volume_id.clone(),
            title: self.title.clone(),
            author: self.author.clone(),
            language: self.language.clone(),
            highlights: self
                .highlights
                .iter()
                .filter(|h| h.since <= round && h.removed_in.map_or(true, |r| round < r))
                .map(|h| KoboHighlight {
                    bookmark_id: h.id.clone(),
                    text: h.text.clone(),
                    annotation: h.note.clone(),
                    chapter_title: h.chapter.clone(),
                    chapter_progress: h.progress,
                    date_created: DATE_CREATED.to_string(),
                    ..Default::default()
                })
                .collect(),
            ..Default::default()
        }
    }
}

fn expand_books(specs: &[Value]) -> Result<Vec<EvalBook>, String> {
    let mut out = Vec::new();
    for spec in specs {
        if let Some(g) = spec.get("generatedBooks") {
            let count = number(g, "count")?;
            let groups: Vec<String> = array(g, "groups")?
                .iter()
                .map(|v| v.as_str().map(str::to_string).ok_or("bad group".to_string()))
                .collect::<Result<_, _>>()?;
            for i in 0..count {
                let b = format!("{:02}", i + 1);
                let group = &groups[i as usize % groups.len()];
                let fill = |s: &str| s.replace("{b}", &b).replace("{group}", group);
                out.push(EvalBook {
                    reader: string(spec, "reader")?,
                    volume_id: fill(&string(g, "volumeId")?),
                    title: fill(&string(g, "title")?),
                    author: fill(&string(g, "author")?),
                    language: g.get("language").and_then(Value::as_str).map(str::to_string),
                    highlights: generated(g.get("highlights").ok_or("no highlights")?, &b)?,
                });
            }
        } else {
            let mut highlights = match spec.get("generated") {
                Some(g) => generated(g, "")?,
                None => Vec::new(),
            };
            for h in array(spec, "highlights")? {
                highlights.push(explicit(h)?);
            }
            out.push(EvalBook {
                reader: string(spec, "reader")?,
                volume_id: string(spec, "volumeId")?,
                title: string(spec, "title")?,
                author: string(spec, "author")?,
                language: spec.get("language").and_then(Value::as_str).map(str::to_string),
                highlights,
            });
        }
    }
    Ok(out)
}

fn explicit(h: &Value) -> Result<EvalHighlight, String> {
    let text = match h.get("textRepeat") {
        Some(r) => string(r, "unit")?.repeat(number(r, "times")? as usize),
        None => string(h, "text")?,
    };
    Ok(EvalHighlight {
        id: string(h, "id")?,
        since: number(h, "since")? as u32,
        removed_in: h.get("removedIn").and_then(Value::as_u64).map(|n| n as u32),
        text,
        note: h.get("note").and_then(Value::as_str).map(str::to_string),
        chapter: h.get("chapter").and_then(Value::as_str).map(str::to_string),
        progress: h.get("progress").and_then(Value::as_f64),
    })
}

/// `count` highlights numbered 1..=count; `{n}` is the number and `{b}` the
/// book's two-digit number (empty outside `generatedBooks`).
fn generated(g: &Value, b: &str) -> Result<Vec<EvalHighlight>, String> {
    let digits = number(g, "idDigits")? as usize;
    let prefix = string(g, "idPrefix")?.replace("{b}", b);
    let text = string(g, "text")?;
    let progress = g.get("progress").and_then(Value::as_str);
    let mut out = Vec::new();
    for n in 1..=number(g, "count")? {
        let progress = match progress {
            Some(p) => {
                let denominator: f64 = p
                    .strip_prefix("{n}/")
                    .and_then(|d| d.parse().ok())
                    .ok_or(format!("bad progress {p}"))?;
                Some(n as f64 / denominator)
            }
            None => None,
        };
        out.push(EvalHighlight {
            id: format!("{prefix}{n:0digits$}"),
            since: number(g, "since")? as u32,
            removed_in: None,
            text: text.replace("{n}", &n.to_string()).replace("{b}", b),
            note: None,
            chapter: None,
            progress,
        });
    }
    Ok(out)
}

fn array<'a>(v: &'a Value, key: &str) -> Result<&'a [Value], String> {
    v.get(key).and_then(Value::as_array).map(Vec::as_slice).ok_or(format!("missing array {key}"))
}

fn string(v: &Value, key: &str) -> Result<String, String> {
    v.get(key).and_then(Value::as_str).map(str::to_string).ok_or(format!("missing string {key}"))
}

fn number(v: &Value, key: &str) -> Result<u64, String> {
    v.get(key).and_then(Value::as_u64).ok_or(format!("missing number {key}"))
}
