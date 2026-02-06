# Khi

Native macOS application to extract highlights from Kobo Libra II and export them to Markdown files.

## Preview

<img src="khi_light_theme.png" alt="Khi Application - Light Theme" width="800">

## Features

- **Automatic Detection**: Automatically detects when Kobo is connected via USB
- **Auto-Import**: Automatically imports highlights when Kobo is connected (configurable)
- **Preview**: View all books and highlights before exporting
- **Smart Library Management**: Grid/List view toggle with multiple sort options
- **Progress Tracking**: Real-time progress bar during import showing current book
- **Cover Extraction**: Intelligent EPUB cover extraction with caching
- **Markdown Export**: Generates clean, well-structured Markdown files
- **Customizable Settings**: Choose which metadata to include and date format
- **Modern Design**: Native macOS interface with dark mode support

## Tech Stack

- **Frontend**: Tauri 2.x + Svelte 5 + TypeScript + Tailwind CSS
- **Framework**: SvelteKit with adapter-static (SPA mode)
- **Build Tool**: Vite 6.x
- **Backend**: Rust
- **Database**: SQLite (reading from Kobo)
- **Testing**: Vitest (frontend) + Rust test framework (backend)

## System Requirements

- macOS 11.0 (Big Sur) or later
- Kobo Libra II (or other compatible Kobo eReader)
- USB cable to connect Kobo to Mac

## Installation

### Download

1. Download the latest version of the application in the [Releases](../../releases) section
2. Open the downloaded `.dmg` file
3. Drag the "Khi" application to the Applications folder

### First Launch

Since the application is not signed by Apple (yet), you may see a security warning on first launch:

1. Right-click on the application and select "Open"
2. In the security window, click "Open"
3. Alternatively, go to `System Preferences > Security & Privacy` and click "Open Anyway"

## Usage

### 1. Connect the Kobo

1. Connect your Kobo to your Mac via USB cable
2. The application automatically detects the device
3. Click "Import" to load the highlights

### 2. Select Books

- Use Ctrl/Cmd+click to select multiple books
- Use Shift+click to select ranges
- Click "Export All" to export the entire library without selecting individual books
- Use the view toggle to switch between Grid and List views
- Sort books by Title, Author, Date Last Read, or Highlight Count

### 3. Preview Book Highlights

- Click on a book to view all its highlights
- Review chapter titles and highlight text
- Navigate back to library to select more books

### 4. Configure and Export

1. Choose the destination folder
2. Configure export options (metadata, date format)
3. Click "Export Selected"
4. Markdown files are generated in the chosen folder

## Export File Structure

Each book is exported as a separate Markdown file:

```markdown
# Book Title

**Author**: Author Name
**ISBN**: 978-1234567890
**Export Date**: 29 January 2026

> Date format is configurable in settings: `DD Month YYYY`, `DD/MM/YYYY`, or `ISO 8601`

---

## Chapter 1

> "This is the highlight text..."

---

## Chapter 2

> "Another highlight..."
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Project Setup

```bash
# Clone the repository
git clone <repository-url>
cd khi

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Run Tests

```bash
# Frontend tests (Vitest)
npm test

# Backend tests (Rust)
cd src-tauri && cargo test

# Tests with coverage
npm test -- --coverage
```

### Production Build

```bash
# Full build (frontend + backend)
npm run tauri build

# The application bundle is located at:
# src-tauri/target/release/bundle/
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte 5)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ LibraryView  │  │ BookDetails  │  │ SettingsPanel    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   BookCard   │  │ HighlightItem│  │   AppLayout      │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ IPC (Tauri)
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Rust)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Device     │  │    KoboDB    │  │   CoverExtractor │   │
│  │  Detection   │  │   (SQLite)   │  │   (EPUB parser)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Export     │  │   Settings   │  │     Models       │   │
│  │  (Markdown)  │  │   Manager    │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Testing

The project follows the **Test-Driven Development (TDD)** methodology:

| Module | Tests | Coverage |
|--------|-------|----------|
| Frontend (TypeScript/Svelte) | 177+ | >90% |
| Backend (Rust) | 52+ | 100% |
| **Total** | **229+** | **>90%** |

## Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Tauri](https://tauri.app/) - Framework for desktop applications
- [Svelte](https://svelte.dev/) - Reactive UI framework
- [Rust](https://www.rust-lang.org/) - Safe and performant programming language

---

**Note**: This application is not affiliated with Rakuten Kobo. It is an independent project created to facilitate the export of personal highlights.
