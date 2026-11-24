use std::{env, fs, path::PathBuf};

fn main() {
    if env::var_os("CARGO_FEATURE_UPDATER").is_some() {
        tauri_build::build();
        return;
    }
    // Without the updater plugin its permission does not exist, and Tauri
    // refuses a capability that names it: build from copies without that line.
    let source = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("capabilities");
    let target = PathBuf::from(env::var("OUT_DIR").unwrap()).join("capabilities");
    fs::create_dir_all(&target).unwrap();
    for entry in fs::read_dir(&source).unwrap() {
        let path = entry.unwrap().path();
        let text = fs::read_to_string(&path).unwrap();
        let kept: Vec<&str> = text.lines().filter(|line| !line.contains("updater:")).collect();
        fs::write(target.join(path.file_name().unwrap()), kept.join("\n")).unwrap();
    }
    println!("cargo:rerun-if-changed={}", source.display());
    let pattern: &'static str = Box::leak(format!("{}/**/*", target.display()).into_boxed_str());
    tauri_build::try_build(tauri_build::Attributes::new().capabilities_path_pattern(pattern))
        .expect("failed to run tauri-build");
}
