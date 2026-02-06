import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Update Cargo.toml
const cargoPath = join(__dirname, '../src-tauri/Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`✅ Cargo.toml version synced to ${version}`);
