# Biblioteca persistente: plano de implementação

> **Para quem executa:** usar `superpowers:executing-plans` (ou `superpowers:subagent-driven-development`) e seguir task a task. Os passos usam checkboxes (`- [ ]`).

**Objetivo:** a Biblioteca de cada Leitor passa a viver numa SQLite gerida pelo Rust, sincronizada a partir do Kobo, visível e exportável sem Kobo ligado.

**Arquitetura:** um módulo Rust `library` é o único dono dos dados: lê um `KoboSnapshot` (tirado da BD do Kobo em modo só de leitura) e funde-o numa transação. Os commands e eventos tauri-specta (já em `specta_builder()`) são a única interface com o frontend. O frontend deixa de guardar livros em memória e passa a pedi-los ao Rust.

**Tech stack:** Rust (rusqlite 0.31 bundled, chrono, tauri 2.12, tauri-specta rc.28), Svelte 5 runes, Vitest.

**Spec:** [docs/specs/0001-biblioteca-persistente.md](../specs/0001-biblioteca-persistente.md) (as regras são citadas como R1…R24). Ver também o [GLOSSARY.md](../../GLOSSARY.md) e os ADR 0001 e 0002.

## Restrições globais

- Branch `v2`. Um commit por task, mensagem convencional e o trailer `Co-Authored-By` do projeto.
- BD da Biblioteca: `~/Library/Application Support/KoboHighlightsExporter/library.sqlite`. Capas: `covers/` na mesma pasta.
- O esquema tem versão (`PRAGMA user_version`) e migrações numeradas desde a v1.
- A BD do Kobo abre-se sempre com `OpenFlags::SQLITE_OPEN_READ_ONLY` (R15). O Khi nunca escreve no Kobo.
- Nenhum teste escreve fora de um `TempDir`. Isto inclui o `settings.json` real e o `library.sqlite` real.
- Ids que cruzam o IPC são `u32`, porque o specta proíbe `i64` e `usize` (BigInt). As datas são strings RFC 3339 (`chrono::Utc::now().to_rfc3339()`).
- Cada command e evento novo leva `#[specta::specta]` ou `derive(specta::Type, Event)` e entra no `specta_builder()`. Depois regenera-se com `UPDATE_BINDINGS=1 cargo test bindings_are_up_to_date`.
- Os testes de integração da Biblioteca ficam em `src-tauri/tests/`, com fixtures geradas no próprio teste. O `KoboReader.sqlite` pessoal nunca entra no repositório.
- No fim de cada task tem de passar tudo isto: `cargo test` (em `src-tauri/`), `npx vitest run` e `npm run check`.

## Review Focus

Casos que a spec não cobre e que mais provavelmente afetam quem usa o Khi. O teste de cada um está na task indicada.

1. **O mesmo `BookmarkID` vindo de dois Kobos do mesmo Leitor** (sincronização pela conta Kobo). A origem não muda e só o Kobo de origem marca ou limpa «removido». *Task 5.*
2. **Livros sem título nem autor no Kobo** («Unknown Title» / «Unknown Author»). A regra do título e autor normalizados (R10.3) não os junta num só Livro. *Task 4.*
3. **ISBN com hífens ou espaços** (`978-972-…` e `978972…`). Contam como o mesmo ISBN. *Task 4.*
4. **Highlight cujo texto ficou vazio no Kobo.** Conta como desaparecido e é marcado como removido, não fica com o texto vazio. *Task 5.*
5. **Nome de Leitor com `/` ou `:`.** A pasta de export por defeito é criada com um nome seguro e não abre subpastas. *Task 8.*

## Decisões deste plano

Revisão: o plano foi aprovado pelo advisor a 2026-11-15, depois de 4 correções (commits, thread principal, `cfg(test)` e âmbito da Task 11). O utilizador autorizou um commit no fim de cada task.

- **D1. Removidos no export.** Os Highlights removidos do Kobo também são exportados, porque a Biblioteca guarda-os (ADR-0002). A marca não aparece no Markdown. *Confirmado pelo utilizador.*
- **D2. Kobo ligado.** O `DeviceDetectedEvent` não muda. O frontend pergunta `readerForKobo(serial)` quando o recebe. Assim o monitor não precisa de conhecer a Biblioteca.
- **D3. Velocidade da leitura do Kobo.** O `LEFT JOIN … LIKE b.ContentID || '%'` (que demora cerca de 15 s com 91 highlights) passa a uma subquery por highlight sobre o índice de `ContentID`. Entra na Task 1, porque a Sincronização vai correr em cada ligação.
- **D4. Transição.** O `import_highlights` e o `extract_books_with_highlights` continuam a funcionar até à Task 15, para a app nunca ficar partida entre tasks.

## Estrutura de ficheiros

| Ficheiro | Responsabilidade |
|---|---|
| `src-tauri/src/db/kobo.rs` | Ler a BD do Kobo só em leitura e devolver um `KoboSnapshot` |
| `src-tauri/src/device/mod.rs` | Ler o número de série a partir do primeiro campo de `.kobo/version` |
| `src-tauri/src/library/mod.rs` | `Library` (interface pública), tipos e `LibraryError` |
| `src-tauri/src/library/schema.rs` | Migrações numeradas |
| `src-tauri/src/library/identity.rs` | Normalização e chaves de identidade do Livro |
| `src-tauri/src/library/sync.rs` | Fundir um `KoboSnapshot` numa transação |
| `src-tauri/src/commands/library.rs` | Commands da Biblioteca e eventos de Sincronização |
| `src-tauri/tests/common/mod.rs` | Fixtures: `kobo_db(dir)` e `snapshot(...)` |
| `src-tauri/tests/library_*.rs` | Testes de comportamento por regra |
| `src/lib/stores/library.svelte.ts` | Store fino sobre os commands; deixa de guardar livros importados |
| `src/lib/components/ReaderPicker.svelte`, `UnknownKoboDialog.svelte` | UI de Leitores |

---

### Task 1: Kobo só em leitura, número de série e snapshot

**Regras:** R2, R11 (descrição), R15, D3.

**Ficheiros:** alterar `src-tauri/src/db/kobo.rs`, `src-tauri/src/device/mod.rs` e `src-tauri/src/models/mod.rs`. Criar `src-tauri/tests/common/mod.rs` e `src-tauri/tests/kobo_snapshot.rs`.

**Interfaces que produz:**
- `pub struct KoboSnapshot { pub books: Vec<KoboBook> }`
- `pub struct KoboBook { volume_id, title, author: String, isbn, publisher, language, description, date_last_read: Option<String>, highlights: Vec<KoboHighlight> }`
- `pub struct KoboHighlight { bookmark_id, text, date_created: String, annotation, chapter_title, container_path, date_modified: Option<String>, chapter_progress: Option<f64> }`
- `KoboDatabase::open_read_only(path: &Path) -> rusqlite::Result<Self>` e `KoboDatabase::read_snapshot(&self) -> rusqlite::Result<KoboSnapshot>`. Ficam em `models` (o `KoboSnapshot`) e em `db::kobo`.
- `tests/common::kobo_db(dir: &Path) -> PathBuf`: cria um `KoboReader.sqlite` com as tabelas `content` e `Bookmark` e 2 livros (um com ISBN e descrição), 3 highlights e 1 bookmark com `Text` vazio.

- [ ] **Passo 1: testes que falham** (`tests/kobo_snapshot.rs`)
  - `snapshot_groups_highlights_by_volume`: 2 livros, `highlights.len()` 2 e 1, e o bookmark vazio fica de fora.
  - `snapshot_reads_description_and_date_modified`: `description == Some("Uma descrição")` e `date_modified` preenchido.
  - `opening_is_read_only`: teste unitário em `src/db/kobo.rs`, porque os testes de `tests/` não veem código `#[cfg(test)]`. Depois de `open_read_only`, um `self.conn.execute("DELETE FROM Bookmark")` falha com `SQLITE_READONLY`.
  - `serial_is_first_field_of_version_file` (em `device/mod.rs`): `"N4181B5025147,4.1.15,4.38.23697"` dá `Some("N4181B5025147")`.
- [ ] **Passo 2:** `cargo test --test kobo_snapshot` falha por faltarem símbolos.
- [ ] **Passo 3:** implementar o `read_snapshot`, com a mesma seleção de colunas da query atual mais `c_book.Description` e `b.DateModified`. O título do capítulo TOC passa a uma subquery `(SELECT Title FROM content WHERE ContentType = 899 AND ContentID >= b.ContentID AND ContentID < b.ContentID || '~' LIMIT 1)`, que usa o índice em vez do `LIKE` (D3). O `read_serial_number` passa a devolver o texto antes da primeira vírgula. O `validate_sqlite` também abre só em leitura.
- [ ] **Passo 4:** passam o `cargo test` e os testes antigos de `db::kobo`.
- [ ] **Passo 5:** o `import_highlights` passa a usar o `read_snapshot` e regista no log quanto tempo demorou. Com o Kobo real ligado, o valor tem de ficar abaixo de 2 s (hoje são cerca de 15 s).
- [ ] **Passo 6:** commit `feat(kobo): read-only snapshot with serial, description and fast TOC lookup`.

### Task 2: armazenamento e migrações

**Regras:** secção «Armazenamento».

**Ficheiros:** criar `src-tauri/src/library/{mod.rs,schema.rs}` e `src-tauri/tests/library_storage.rs`. Alterar `src-tauri/src/lib.rs` (`pub mod library;`).

**Interfaces que produz:**
- `pub struct Library { conn: rusqlite::Connection, covers_dir: PathBuf }`
- `Library::open(data_dir: &Path) -> Result<Library, LibraryError>`: cria `library.sqlite` e `covers/`, ativa `foreign_keys` e aplica as migrações em falta.
- `pub enum LibraryError { Db(rusqlite::Error), Io(std::io::Error), NotFound, BookHasLiveHighlights }`, com `Display`.
- `schema::MIGRATIONS: &[&str]`. A v1 cria as tabelas seguintes:
  - `readers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, export_path TEXT)`
  - `kobos(serial TEXT PRIMARY KEY, reader_id INTEGER NOT NULL REFERENCES readers, last_sync_at TEXT)`
  - `books(id INTEGER PRIMARY KEY, reader_id INTEGER NOT NULL REFERENCES readers, title, author, isbn, isbn_key, title_key, publisher, language, description, date_last_read, cover_file)`
  - `book_sources(reader_id, volume_id, book_id REFERENCES books ON DELETE CASCADE, PRIMARY KEY(reader_id, volume_id))`
  - `highlights(reader_id, bookmark_id, book_id REFERENCES books ON DELETE CASCADE, kobo_serial, text, annotation, chapter_title, chapter_progress REAL, container_path, date_created, date_modified, removed_at, PRIMARY KEY(reader_id, bookmark_id))`
  - `meta(key TEXT PRIMARY KEY, value TEXT)`

- [ ] **Passo 1: testes**
  - `open_creates_db_and_covers_dir`
  - `user_version_equals_migration_count`
  - `reopen_does_not_rerun_migrations`: abrir duas vezes mantém o `user_version` e não dá erro de «table already exists».
- [ ] **Passo 2:** falham.
- [ ] **Passo 3:** implementar. As migrações correm por ordem, cada uma numa transação que no fim atualiza o `user_version`.
- [ ] **Passo 4:** passam.
- [ ] **Passo 5:** commit `feat(library): sqlite storage with numbered migrations`.

### Task 3: Leitores e Kobos

**Regras:** R1 (persistência da associação), R3, R5 (último Leitor) e R24 (última Sincronização por Kobo).

**Ficheiros:** alterar `src-tauri/src/library/mod.rs`. Criar `src-tauri/tests/library_readers.rs`.

**Interfaces que produz** (`#[derive(Serialize, Deserialize, specta::Type)]`, camelCase):
- `pub struct Reader { id: u32, name: String, export_path: Option<String> }`
- `pub struct KoboInfo { serial: String, reader_id: u32, last_sync_at: Option<String> }`
- Métodos de `Library`:
  - `create_reader(&self, name: &str) -> Result<Reader>`
  - `rename_reader(&self, id: u32, name: &str) -> Result<()>`
  - `list_readers(&self) -> Result<Vec<Reader>>`
  - `associate_kobo(&self, serial: &str, reader_id: u32) -> Result<()>`
  - `kobo(&self, serial: &str) -> Result<Option<KoboInfo>>`
  - `last_reader(&self) -> Result<Option<u32>>`
  - `set_last_reader(&self, id: u32) -> Result<()>`
  - `set_reader_export_path(&self, id: u32, path: Option<&str>) -> Result<()>`

- [ ] **Passo 1: testes**
  - `associated_kobo_is_remembered_after_reopen`
  - `rename_reader_keeps_id`
  - `rename_unknown_reader_is_not_found`
  - `last_reader_round_trip`
  - A API não tem `delete_reader` (R3). Isso não se testa: verifica-se na revisão.
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(library): readers and kobo association`.

### Task 4: identidade do Livro

**Regras:** R10. Review Focus 2 e 3.

**Ficheiros:** criar `src-tauri/src/library/identity.rs`. Testes unitários no próprio ficheiro e em `tests/library_sync.rs` (Task 5). Acrescentar `unicode-normalization = "0.1"` ao `Cargo.toml`.

**Interfaces que produz:**
- `pub fn title_key(title: &str, author: &str) -> Option<String>`: minúsculas, NFD sem marcas combinantes, sem pontuação, espaços colapsados e `"{title}|{author}"`. Devolve `None` quando o título é vazio ou `"Unknown Title"`.
- `pub fn isbn_key(isbn: &str) -> Option<String>`: só dígitos e `X`. Devolve `None` com menos de 10 caracteres.
- `pub(crate) fn resolve_book(tx: &Transaction, reader_id: u32, book: &KoboBook) -> Result<Option<u32>>`: procura pelo caminho em `book_sources`, depois pelo `isbn_key` e por fim pelo `title_key`, sempre dentro do Leitor.

- [ ] **Passo 1: testes**

```rust
assert_eq!(title_key("Confiança", "Hernán Díaz"), title_key("CONFIANCA!", "hernan  diaz"));
assert_eq!(title_key("Unknown Title", "Unknown Author"), None);
assert_eq!(isbn_key("978-972-0-04567-8"), isbn_key("9789720045678"));
```

- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(library): book identity keys`.

### Task 5: Sincronização dos Highlights e metadados

**Regras:** R6 a R11, R13 e R14. Review Focus 1 e 4.

**Ficheiros:** criar `src-tauri/src/library/sync.rs` e `src-tauri/tests/library_sync.rs`.

**Interfaces:**
- **Consome:** `KoboSnapshot` (Task 1), `resolve_book` (Task 4) e `Library` (Tasks 2 e 3).
- **Produz:**
  - `pub struct SyncReport { added: u32, updated: u32, removed: u32, restored: u32, books: u32 }` (specta, camelCase).
  - `Library::sync(&mut self, serial: &str, snapshot: &KoboSnapshot, progress: impl FnMut(u32, u32)) -> Result<SyncReport>`. A Task 6 acrescenta o parâmetro `cover_source` antes de `progress`. Falha com `NotFound` quando o Kobo não está associado (R7). Corre numa só `Transaction`: insere e atualiza Livros e Highlights, regista a origem em `book_sources`, marca `removed_at` só nos highlights do mesmo `serial` que não vieram no snapshot e grava `kobos.last_sync_at`. Chama `progress(livros_processados, total)` uma vez por Livro.

- [ ] **Passo 1: testes**, cada um sobre `Library::open(tempdir)` e um `snapshot(...)` construído em `tests/common`
  - `new_highlight_is_inserted_with_origin` (R8)
  - `kobo_wins_on_text_note_chapter_progress` (R8)
  - `removed_then_back_clears_mark` (R8)
  - `missing_highlight_is_marked_removed_with_date` (R9)
  - `other_kobo_highlights_are_untouched` (R9 e critério 4)
  - `same_bookmark_from_second_kobo_keeps_origin` (Review Focus 1): o Kobo B traz o mesmo `BookmarkID` com outro texto. O texto atualiza, mas `kobo_serial` continua A e, se B deixar de o ter, não é marcado.
  - `empty_text_counts_as_missing` (Review Focus 4)
  - `same_book_by_other_path_joins_existing` (R10 e critério 5)
  - `unknown_titles_do_not_merge` (Review Focus 2)
  - `metadata_refreshes_each_sync` (R11)
  - `book_without_highlights_stays` (R13)
  - `failed_sync_changes_nothing` (R14): um `progress` que entra em pânico a meio, apanhado com `catch_unwind`, deixa o `books(reader)` igual ao de antes.
  - `unknown_kobo_is_rejected` (R7)
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(library): atomic sync from kobo snapshot`.

### Task 6: capas duráveis

**Regras:** R12.

**Ficheiros:** alterar `src-tauri/src/library/sync.rs`, `src-tauri/src/library/mod.rs`, `src-tauri/tauri.conf.json` e `src-tauri/tests/library_sync.rs`.

**Interfaces:**
- `Library::sync` ganha o parâmetro `cover_source: &dyn Fn(&KoboBook) -> Option<PathBuf>`.
- Depois do commit da transação, copia a capa para `covers/{book_id}.jpg`, só se ainda não existir. A falha de uma capa fica registada no log e não falha a Sincronização.
- Os placeholders gerados pelo `CoverExtractor` (EPUB sem capa) não são guardados. Se o fossem, a regra «copia uma vez» impediria para sempre uma capa real de os substituir. Teste: `placeholder_is_not_persisted`.
- O `assetProtocol.scope` ganha `"$HOME/Library/Application Support/KoboHighlightsExporter/covers/**"`.

- [ ] **Passo 1: testes**
  - `cover_is_copied_once`: a segunda sincronização com outra imagem não substitui a primeira.
  - `cover_survives_cache_clear`: o `CoverExtractor::clear_cache` sobre a cache não apaga `covers/`.
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(library): durable covers`.

### Task 7: ler a Biblioteca e apagar Livros

**Regras:** R17 (leitura sem Kobo) e R19.

**Ficheiros:** alterar `src-tauri/src/library/mod.rs`. Criar `src-tauri/tests/library_books.rs`.

**Interfaces que produz:**
- `pub struct LibraryBook { id: u32, title, author: String, isbn, publisher, language, description, date_last_read, cover_path: Option<String>, highlights: Vec<LibraryHighlight> }`. O `cover_path` é o caminho absoluto em `covers/`.
- `pub struct LibraryHighlight { id: String, text, date_created: String, annotation, chapter_title, container_path, removed_at: Option<String>, chapter_progress: Option<f64> }`
- Métodos de `Library`:
  - `books(&self, reader_id: u32) -> Result<Vec<LibraryBook>>`: ordena por título, e os highlights por `chapter_progress` e depois por `date_created`.
  - `books_by_ids(&self, reader_id: u32, ids: &[u32]) -> Result<Vec<LibraryBook>>`
  - `delete_book(&mut self, reader_id: u32, book_id: u32) -> Result<()>`: devolve `BookHasLiveHighlights` se algum highlight tiver `removed_at IS NULL`. Apaga também a capa.

- [ ] **Passo 1: testes**
  - `library_readable_without_kobo`: sincroniza, reabre `Library` e obtém os mesmos Livros (critério 1).
  - `two_readers_same_book_are_separate` (critério 6)
  - `delete_refused_with_live_highlights`
  - `delete_allowed_when_all_removed_and_cover_gone`
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(library): read books and delete fully removed ones`.

### Task 8: Exportação por ids e pasta por Leitor

**Regras:** R20, R21, R22, D1 e Review Focus 5.

**Ficheiros:** alterar `src-tauri/src/library/mod.rs` e `src-tauri/src/export/mod.rs`. Criar `src-tauri/tests/library_export.rs`.

**Interfaces que produz:**
- `impl From<&LibraryBook> for models::Book`, para o `MarkdownExporter` não mudar.
- `Library::export_dir(&self, reader_id: u32, base: &str) -> Result<PathBuf>`: devolve o `export_path` do Leitor ou `base/<nome seguro do Leitor>`.
- `pub fn safe_dir_name(name: &str) -> String`, que troca `/ : \0` por `-` e faz trim.
- `Library::export(&self, reader_id: u32, ids: &[u32], config: &ExportConfig) -> Result<Vec<PathBuf>>`

- [ ] **Passo 1: testes**
  - `export_uses_reader_folder_by_default`
  - `export_uses_custom_reader_folder`
  - `reader_name_with_slash_is_one_folder`
  - `export_includes_removed_highlights` (D1)
  - `same_ids_same_config_same_bytes` (R22 e critério 8)
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(library): export by ids into per-reader folder`.

### Task 9: Definições

**Regras:** R23 e R24.

**Ficheiros:** alterar `src-tauri/src/settings/mod.rs`, `src-tauri/src/commands/mod.rs`, `src/lib/stores/settings.svelte.ts`, `src/lib/components/SettingsPanel.svelte` e os testes correspondentes.

**Interfaces:**
- `UiPreferences.auto_import_on_connect` passa a `sync_on_connect`, com `#[serde(default = "default_true", alias = "autoImportOnConnect", alias = "auto_import_on_connect")]`.
- Saem o `AppSettings.last_import`, o `LastImportRecord`, o command `update_last_import` e o `settings.setLastImport` e `clearLastImport`. Um `settings.json` antigo com `lastImport` continua a ser lido, porque o serde ignora campos desconhecidos (confirmar que não há `deny_unknown_fields`).

- [ ] **Passo 1: testes**
  - `old_file_auto_import_false_maps_to_sync_on_connect_false`
  - `old_file_with_last_import_still_loads`
  - Teste de Vitest: «Sincronizar ao ligar» desligado é enviado em `saveSettings` como `syncOnConnect: false` (critério 7).
- [ ] **Passos 2 a 4:** falham, implementar, regenerar os bindings e passam.
- [ ] **Passo 5:** commit `feat(settings): syncOnConnect replaces autoImport and lastImport`.

### Task 10: commands, estado e eventos

**Regras:** R16 e a secção «Interface».

**Ficheiros:** criar `src-tauri/src/commands/library.rs`. Alterar `src-tauri/src/lib.rs` e `src-tauri/src/settings/mod.rs` (`pub fn data_dir() -> Result<PathBuf, SettingsError>`, extraído de `get_config_dir`).

**Interfaces que produz:**
- **Estado:** `app.manage(Mutex<Library>)` no `setup`, com `Library::open(&data_dir()?)`.
- **Commands:**
  - `list_readers`
  - `create_reader(name)`
  - `rename_reader(id, name)`
  - `associate_kobo(serial, reader_id)`
  - `reader_for_kobo(serial) -> Option<u32>`
  - `last_reader() -> Option<u32>`
  - `get_library(reader_id) -> Vec<LibraryBook>` (grava também o `last_reader`)
  - `delete_book(reader_id, book_id)`
  - `export_library_books(reader_id, book_ids) -> Vec<String>`: lê o `ExportConfig` das Definições (R22).
  - `set_reader_export_path(reader_id, path: Option<String>)`
  - `async sync_kobo(device: KoboDevice) -> SyncReport`: corre em `tauri::async_runtime::spawn_blocking`. Lê o snapshot antes de pegar no `Mutex` e emite progresso.
- **Nada bloqueia a thread principal.** O Tauri corre os commands não-`async` na thread principal. Por isso, todos os commands da Biblioteca são `async` e pegam no `Mutex` dentro de `spawn_blocking`. A Sincronização usa a sua própria `Connection` (`Library::open` noutra instância) e a BD está em `journal_mode=WAL`, para as leituras não esperarem pelo fim da Sincronização.
- **Eventos:**
  - `SyncProgress { done: u32, total: u32 }` (nome `sync-progress`)
  - `SyncFinished { reader_id: u32, report: SyncReport }` (nome `sync-finished`)
- Os erros chegam ao frontend como `String`, como nos commands atuais.

- [ ] **Passo 1:** o teste `bindings_are_up_to_date` falha depois de acrescentar os commands, e passa com `UPDATE_BINDINGS=1`.
- [ ] **Passo 2: testes em `tests/library_commands.rs`.** Os helpers `pub fn *_with(data_dir: &Path, …)` de `commands/library.rs` são `pub` para os testes de integração os poderem chamar.
  - `sync_kobo_with` sobre um `kobo_db` de fixture devolve `added == 3`.
  - `reads_do_not_wait_for_sync`: uma Sincronização numa thread fica parada num `progress` que espera por um `Barrier`. Entretanto, o `get_library_with` noutra thread devolve resultado em menos de 1 s.
- [ ] **Passo 3:** passam o `cargo test` e o `npm run check`.
- [ ] **Passo 4:** commit `feat(library): tauri commands and sync events`.

### Task 11: frontend com a Biblioteca sempre visível

**Regras:** R5 e R17. Secção «Testes» (substitui o teste do `addBooks`).

**Ficheiros:** alterar `src/lib/stores/library.svelte.ts`, `src/lib/stores/library.svelte.test.ts`, `src/routes/+page.svelte` e `src/lib/types.ts` (`Book = LibraryBook`, `Highlight = LibraryHighlight`). Alterar também `LibraryView.svelte`, `BookCard.svelte`, `BookListItem.svelte`, `BookDetailsView.svelte` e os respetivos testes, além de `src/lib/test-fixtures.ts`.

**Mudança de tipo que atravessa a UI:** `book.contentId: string` passa a `book.id: number`, e `selectedBookIds: string[]` passa a `number[]`. Fazer `rg contentId src` antes de começar e trocar todas as ocorrências.

**Interfaces que produz (store):**
- Estado: `activeReaderId = $state<number | null>(null)` e `readers = $state<Reader[]>([])`.
- Métodos:
  - `loadReaders()`
  - `openReader(id)`: chama `commands.getLibrary` e preenche `books`.
  - `initialReader(connectedSerial?: string)`: devolve o Leitor do Kobo ligado, se existir, senão `lastReader()` (R5).
- O `uiState` deixa de ir para `'no-device'` quando o Kobo é desligado. O que muda é `connectedDevice`, que alimenta um indicador na barra (R17). O `'no-device'` passa a ser usado só quando não existe nenhum Leitor.

- [ ] **Passo 1: testes (Vitest)**
  - «opens the reader of the connected kobo»
  - «falls back to last reader»
  - «disconnect keeps books visible»
  - Remover «should add books without duplicates».
- [ ] **Passos 2 a 4:** falham, implementar e passam. A seguir corre o `npm run check`.
- [ ] **Passo 5:** commit `feat(ui): library loaded from rust and visible without kobo`.

### Task 12: Kobo desconhecido, seletor e nome do Leitor

**Regras:** R1, R3, R4 e R7.

**Ficheiros:** criar `src/lib/components/UnknownKoboDialog.svelte`, `src/lib/components/ReaderPicker.svelte` e os respetivos `.svelte.test.ts`. Alterar `src/routes/+page.svelte`, `src/lib/components/SettingsPanel.svelte` e `src/lib/i18n/*` (textos em PT e EN).

**Comportamento:**
- **`UnknownKoboDialog`:**
  - Props `{ device, readers, onChoose(readerId), onCreate(name) }`.
  - O nome por defeito de um Leitor novo é `device.name` (R1).
  - É mostrado quando `readerForKobo(serial)` devolve `null`, e só depois de responder corre a Sincronização (R7).
- **`ReaderPicker`:** só é renderizado com `readers.length > 1` (R4).
- **`SettingsPanel`:** tem um campo para mudar o nome do Leitor ativo e não tem ação de apagar (R3).

- [ ] **Passo 1: testes**
  - «picker hidden with one reader»
  - «dialog defaults new name to device name»
  - «choosing a reader associates the kobo»
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(ui): reader association and picker`.

### Task 13: Sincronizar ao ligar e a pedido

**Regras:** R6 e R16.

**Ficheiros:** alterar `src/routes/+page.svelte`, `src/lib/stores/library.svelte.ts`, `src/lib/components/LibraryToolbar.svelte` e os testes.

**Comportamento:**
- O `events.deviceDetected` resolve o Leitor do Kobo. Se o Kobo for conhecido e `syncOnConnect` estiver ativo, chama `library.sync(device)`.
- Desaparecem o `hasImportedInSession`, o `shouldAutoImport` e o `markImportComplete` (R6: acaba a regra de uma vez por sessão).
- Botão «Sincronizar» na barra, ativo só com o Kobo do Leitor ativo ligado.
- O `ImportingState` mostra «N de M livros» a partir de `events.syncProgress` (R16). O `events.syncFinished` recarrega `openReader`.

- [ ] **Passo 1: testes**
  - «known kobo syncs on connect when enabled»
  - «does not sync when syncOnConnect is off»
  - «sync button disabled without the reader's kobo»
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(ui): sync on connect and on demand with progress`.

### Task 14: Highlights removidos, apagar Livro e export unificado

**Regras:** R18, R19, R20, R21 e R22 (UI).

**Ficheiros:** alterar `HighlightItem.svelte`, `BookDetailsView.svelte`, `LibraryToolbar.svelte`, `SettingsPanel.svelte`, `library.svelte.ts` e os testes.

**Comportamento:**
- **Highlights removidos:** um highlight com `removedAt` mostra a marca «Removido do Kobo». O filtro «Mostrar removidos» vem ativo por defeito (R18).
- **Apagar Livro:** o `BookDetailsView` mostra «Apagar livro» só quando todos os highlights têm `removedAt`, com confirmação no `Modal` (R19).
- **Export unificado:**
  - Os dois botões chamam `commands.exportLibraryBooks(activeReaderId, ids)`.
  - Desaparece o `exportBooks` com config fixa (`library.svelte.ts:116-132`) e o `BookDetailsView` deixa de montar config própria (R22).
- **Definições:** mostram a pasta de export do Leitor ativo, editável. As outras opções continuam globais (R21).

- [ ] **Passo 1: testes**
  - «removed highlight shows mark»
  - «filter hides removed»
  - «delete hidden while a highlight is live»
  - «toolbar and details export call the same command with the same ids»
- [ ] **Passos 2 a 4:** falham, implementar e passam.
- [ ] **Passo 5:** commit `feat(ui): removed highlights, delete book, unified export`.

### Task 15: limpeza e aceitação

**Ficheiros:**
- Remover o command `import_highlights`, o `export_books(books, config)`, o `get_export_preview` (código morto) e o `KoboDatabase::extract_books_with_highlights`, juntamente com os testes respetivos.
- Remover os `create_test_book` e `create_test_config` mortos em `commands/mod.rs`.
- Atualizar o `CLAUDE.md` nas secções Stores e Comandos.

- [ ] **Passo 1:** `rg "import_highlights|importHighlights|addBooks|hasImportedInSession" src src-tauri/src` não devolve nada.
- [ ] **Passo 2:** regenerar os bindings e depois correr o `cargo test`, o `npx vitest run` e o `npm run check`.
- [ ] **Passo 3: critérios de aceitação da spec com o Kobo real**, registados no PR
  1. Sincronizar, desligar e reabrir mostra os mesmos Livros com capas.
  2. Uma nota editada no Kobo atualiza depois de sincronizar.
  3. Um highlight apagado no Kobo aparece marcado.
  4. Sincronizar um segundo Kobo não marca nada do primeiro (pode ser simulado com a fixture, se não houver segundo Kobo).
  5. Um caminho diferente para o mesmo livro junta-se ao Livro existente (coberto pelo teste da Task 5).
  6. Dois Leitores ficam separados (coberto pelo teste da Task 7).
  7. «Sincronizar ao ligar» desligado sobrevive a reabrir a app.
  8. Os dois botões de export produzem ficheiros idênticos.
  9. Testes verdes, com o mtime do `settings.json` real igual antes e depois.
- [ ] **Passo 4:** commit `chore: remove v1 import path`.

---

## Cobertura da spec

| Regra | Task | Regra | Task |
|---|---|---|---|
| R1 | 3, 12 | R13 | 5 |
| R2 | 1 | R14 | 5 |
| R3 | 3, 12 | R15 | 1 |
| R4 | 12 | R16 | 10, 13 |
| R5 | 3, 11 | R17 | 7, 11 |
| R6 | 5, 13 | R18 | 14 |
| R7 | 5, 12 | R19 | 7, 14 |
| R8, R9 | 5 | R20 | 8, 14 |
| R10 | 4, 5 | R21 | 8, 14 |
| R11 | 1, 5 | R22 | 8, 14 |
| R12 | 6 | R23, R24 | 9, 3 |
