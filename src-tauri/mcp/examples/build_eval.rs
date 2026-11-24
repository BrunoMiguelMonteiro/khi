//! Builds the evaluation Library (eval/fixture.json) for the agent evaluation
//! (test 15). The folder must not exist yet, so the real Library can never be
//! the target: `cargo run -p khi-mcp --example build_eval -- <empty dir>`.

use khi_lib::library::eval_fixture::build_eval_library;
use std::path::PathBuf;

fn main() {
    let dir: PathBuf = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .expect("usage: build_eval <new folder>");
    assert!(!dir.exists(), "{} already exists: give a new folder", dir.display());
    let name = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    assert!(
        name == "KoboHighlightsExporter Dev" && !dir.starts_with(dirs_home_real()),
        "the folder must be a 'KoboHighlightsExporter Dev' outside the real home"
    );
    std::fs::create_dir_all(&dir).unwrap();
    build_eval_library(&dir).unwrap();
    eprintln!("evaluation Library built in {}", dir.display());
}

/// The real home, from the password database rather than $HOME, which the
/// evaluation overrides.
fn dirs_home_real() -> PathBuf {
    let out = std::process::Command::new("sh").args(["-c", "echo ~$(id -un)"]).output().unwrap();
    PathBuf::from(String::from_utf8_lossy(&out.stdout).trim())
}
