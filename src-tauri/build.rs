use std::{env, fs, path::{Path, PathBuf}};

fn main() {
    if env::var_os("CARGO_FEATURE_UPDATER").is_some() {
        tauri_build::build();
        return;
    }
    // Without the updater plugin its permission does not exist, and Tauri
    // refuses a capability that names it: build from copies without it.
    let source = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("capabilities");
    let target = PathBuf::from(env::var("OUT_DIR").unwrap()).join("capabilities");
    // A copy left by an earlier build must not outlive its source.
    let _ = fs::remove_dir_all(&target);
    copy_capabilities(&source, &target);
    println!("cargo:rerun-if-changed={}", source.display());
    let pattern: &'static str = Box::leak(format!("{}/**/*", target.display()).into_boxed_str());
    tauri_build::try_build(tauri_build::Attributes::new().capabilities_path_pattern(pattern))
        .expect("failed to run tauri-build");
}

/// Copies `source` into `target` with the same folders: `.json` capabilities
/// without their updater permissions, `.toml` ones as they are, nothing else
/// (a `.DS_Store` is not a capability).
fn copy_capabilities(source: &Path, target: &Path) {
    fs::create_dir_all(target).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let path = entry.unwrap().path();
        let to = target.join(path.file_name().unwrap());
        if path.is_dir() {
            copy_capabilities(&path, &to);
            continue;
        }
        match path.extension().and_then(|e| e.to_str()) {
            Some("json") => {
                let mut capability: serde_json::Value =
                    serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
                if let Some(permissions) = capability["permissions"].as_array_mut() {
                    // A permission is a string or an object with an `identifier`
                    permissions.retain(|p| {
                        let id = p.as_str().or_else(|| p["identifier"].as_str()).unwrap_or_default();
                        !id.starts_with("updater:")
                    });
                }
                fs::write(to, capability.to_string()).unwrap();
            }
            Some("toml") => {
                fs::copy(&path, to).unwrap();
            }
            _ => {}
        }
    }
}
