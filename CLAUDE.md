# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

**Khi** - Aplicação nativa macOS para extrair highlights de dispositivos Kobo Libra II e exportá-los para ficheiros Markdown.

## Tech Stack

- **Frontend**: Tauri 2.x + Svelte 5 (runes) + TypeScript + Tailwind CSS
- **Backend**: Rust
- **Database**: SQLite (leitura da base de dados Kobo)
- **Testing**: Vitest (frontend) + Rust test framework (backend)
- **Build**: Vite + SvelteKit com adapter-static (modo SPA)

## Comandos Essenciais

### Desenvolvimento
```bash
# Modo desenvolvimento com hot-reload
npm run tauri dev

# Apenas frontend (Vite)
npm run dev

# Build frontend apenas
npm run build
```

### Testes
```bash
# Testes frontend (Vitest)
npm test

# Testes com UI
npm test:ui

# Testes com coverage
npm test -- --coverage

# Testes backend (Rust)
cd src-tauri && cargo test

# Teste específico (frontend)
npm test -- <filename>
```

### Build e Produção
```bash
# Build completo (frontend + backend + bundle)
npm run tauri build

# Artefactos gerados em: src-tauri/target/release/bundle/macos/
```

### Code Quality
```bash
# Type checking (Svelte)
npm run check

# Type checking com watch
npm run check:watch
```

## Arquitetura de Alto Nível

### Frontend (Svelte 5 Runes)

A aplicação usa **Svelte 5 com runes** (`$state`, `$derived`, `$effect`) para gestão de estado reativo. **Não usar stores writable** - toda a gestão de estado é feita com runes em módulos `.svelte.ts`.

#### Stores Principais (`src/lib/stores/`)

1. **`library.svelte.ts`** - Estado da biblioteca de livros
   - Lista de livros importados
   - Seleção de livros
   - Estado de importação (scanning, importing)
   - UI state machine ('no-device' | 'importing' | 'library' | 'book-details')
   - Wrappers para comandos Tauri (scanForDevice, importHighlights, exportBooks)

2. **`settings.svelte.ts`** - Configurações da aplicação
   - Export config (path, metadata, dateFormat)
   - UI preferences (theme, viewMode, sort, windowSize)
   - Last import record
   - Persistência via comandos Tauri (loadSettings, saveSettings)
   - Theme management (aplica 'dark' class ao documentElement)

#### Componentes Principais (`src/lib/components/`)

- **AppLayout.svelte** - Layout principal da aplicação
- **EmptyStateNoDevice.svelte** - Ecrã quando não há Kobo conectado
- **ImportingState.svelte** - Ecrã de importação em progresso
- **LibraryView.svelte** - Vista da biblioteca (grid/list de livros)
- **BookCard.svelte** - Card individual de livro na biblioteca
- **BookDetailsView.svelte** - Vista de detalhes de um livro com highlights
- **HighlightItem.svelte** - Item individual de highlight
- **SettingsPanel.svelte** - Painel de configurações (modal)
- **Modal.svelte** - Component modal reutilizável
- **CustomCheckbox.svelte** - Checkbox customizado
- **CustomRadio.svelte** - Radio button customizado
- **KoboIcon.svelte** - Ícone SVG do dispositivo Kobo

### Backend (Rust)

#### Estrutura de Módulos (`src-tauri/src/`)

- **`commands/`** - Comandos Tauri IPC expostos ao frontend
- **`db/kobo.rs`** - Leitura da base de dados SQLite do Kobo
- **`device/`** - Deteção de dispositivos Kobo conectados (/Volumes no macOS)
- **`export/`** - Exportação para Markdown
- **`covers/`** - Extração de capas EPUB
- **`models/`** - Structs partilhadas (Book, Highlight, ExportConfig, etc.)
- **`settings/`** - Gestão de settings persistidas em disco
- **`utils/logger.rs`** - Sistema de logging

#### Comandos Tauri Disponíveis (`commands/mod.rs`)

Todos os comandos estão registados em `src-tauri/src/lib.rs`:

```rust
scan_for_device() -> Option<KoboDevice>
import_highlights(device: KoboDevice) -> Vec<Book>
export_books(books: Vec<Book>, config: ExportConfig) -> Vec<String>
get_export_preview(book: Book, config: ExportConfig) -> String
get_default_export_path() -> String
validate_export_path(path: String) -> bool
load_settings() -> AppSettings
save_settings(settings: AppSettings) -> ()
update_last_import(record: LastImportRecord) -> ()
reset_settings() -> AppSettings
pick_export_folder(app_handle, default_path: Option<String>) -> Option<String>
```

### Tipos TypeScript (`src/lib/types.ts`)

Os tipos TypeScript **espelham** as structs Rust para comunicação IPC. Conversão automática via Tauri serialization:
- Rust: `snake_case` structs/fields
- TypeScript: `camelCase` interfaces/properties
- Enums: strings em snake_case (ex: `'dd_month_yyyy'`)

## Convenções de Código

### Svelte 5 Runes

**Obrigatório**: Usar runes em vez de stores writables:
```typescript
// ✅ CORRETO
let count = $state(0);
let doubled = $derived(count * 2);

// ❌ ERRADO (não usar)
import { writable } from 'svelte/store';
const count = writable(0);
```

**Stores em módulos separados** (`*.svelte.ts`):
- Estado reativo com `$state`
- Export de getters/setters como funções
- Import como módulo normal (não como $store)

### Tauri IPC

**Frontend chama backend**:
```typescript
import { invoke } from '@tauri-apps/api/core';

const books = await invoke<Book[]>('import_highlights', { device });
```

**Type Safety**:
- TypeScript types devem corresponder às structs Rust
- Usar `camelCase` no TS, Tauri converte automaticamente para `snake_case`

### Styling

**Tailwind CSS** é usado para todo o styling:
- Tema dark mode: `dark:` prefix
- Classe `dark` aplicada ao `<html>` via settings store
- Design system: neutral grayscale
- Responsive: mobile-first com breakpoints `sm:`, `md:`, `lg:`, `xl:`

## Device Monitoring

A aplicação **monitoriza automaticamente** a conexão de dispositivos Kobo:
- `DeviceMonitor` (Rust) inicia em `setup()` no `lib.rs`
- Emite eventos para o frontend quando dispositivo é conectado/desconectado
- Estado gerido pela state machine em `library.svelte.ts`

## Testing

### Frontend (Vitest + Testing Library)

- Testes em ficheiros `*.test.ts` ou `*.svelte.test.ts`
- Usar `@testing-library/svelte` para componentes
- Mocks em `__mocks__/` (ex: i18n)
- Setup global em `vitest-setup.ts`

### Backend (Rust)

- Testes em módulos `#[cfg(test)] mod tests`
- Usar `tempfile::TempDir` para testes de filesystem
- Coverage 100% no backend

## Build Notes

### SvelteKit Adapter Static

O projeto usa `@sveltejs/adapter-static` com `fallback: "index.html"` porque:
- Tauri **não** tem servidor Node.js para SSR
- App funciona em modo SPA (Single Page Application)
- Build output vai para `build/` que é usado pelo Tauri

### Tauri Config (`src-tauri/tauri.conf.json`)

- `beforeBuildCommand`: `npm run build` (compila Svelte)
- `frontendDist`: `../build` (onde Vite coloca output)
- Bundle targets: `["dmg", "app"]` para macOS

## Estrutura de Dados

### Book
```typescript
interface Book {
  contentId: string;      // ID único do Kobo
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  language?: string;
  dateLastRead?: string;
  description?: string;
  coverPath?: string;     // Base64 data URL da capa
  highlights: Highlight[];
  isSelected: boolean;    // UI state
}
```

### Highlight
```typescript
interface Highlight {
  id: string;
  text: string;
  annotation?: string;     // Nota pessoal
  chapterTitle?: string;
  chapterProgress?: number;
  containerPath?: string;
  dateCreated: string;
  color?: string;
}
```

### ExportConfig
```typescript
interface ExportConfig {
  exportPath: string;
  metadata: {
    author: boolean;
    isbn: boolean;
    publisher: boolean;
    dateLastRead: boolean;
    language: boolean;
    description: boolean;
  };
  dateFormat: 'dd_mm_yyyy' | 'dd_month_yyyy' | 'iso8601';
}
```

## Debugging

### Frontend Logs
```typescript
console.log('[COMPONENT]', data);  // Visível no DevTools do Tauri
```

### Backend Logs
```rust
log::info!("Message");    // Usa env_logger
log::error!("Error");
```

Ver logs backend: procurar por `[EXPORT RUST]` ou similar nos logs do Tauri.

## Estado do Projeto

Branch atual: `feature/ui-redesign`
- Redesign completo da UI com Tailwind CSS
- Migração de CSS customizado para design system grayscale
- Novos componentes: Modal, CustomCheckbox, CustomRadio, KoboIcon
