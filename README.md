# CrossPDF Studio

Professional cross-platform PDF editor built with Electron + React + TypeScript.

> **Status**: Phase 4 — OCR, Preferences, PDF Security, Forms & Export complete

## Tech Stack

| Layer           | Technology                    |
| --------------- | ----------------------------- |
| Desktop Shell   | Electron 42                   |
| UI              | React 19, Tailwind CSS 4      |
| Language        | TypeScript 6 (strict)         |
| Bundler         | Vite 8 + vite-plugin-electron |
| PDF Rendering   | PDF.js (`pdfjs-dist`)         |
| State           | Zustand 5                     |
| Validation      | Zod 4                         |
| Database        | sql.js (WASM SQLite)          |
| Testing         | Vitest 4                      |
| Linting         | ESLint 10, Prettier 3         |
| Package Manager | pnpm                          |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development (Electron + Vite dev server)
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build
```

## Scripts

| Script              | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Start Electron dev server with HMR  |
| `pnpm build`        | Type check + production build       |
| `pnpm typecheck`    | TypeScript type check only          |
| `pnpm lint`         | ESLint check                        |
| `pnpm test`         | Run Vitest test suite               |
| `pnpm format`       | Format code with Prettier           |
| `pnpm format:check` | Check formatting without writing    |
| `pnpm package:mac`  | Build + package for macOS           |
| `pnpm package:win`  | Build + package for Windows         |
| `pnpm package:all`  | Build + package for macOS + Windows |

## Project Structure

```
crosspdf-studio/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App lifecycle, window creation
│   │   ├── ipc/        # IPC handler registration
│   │   ├── database/   # SQLite (sql.js) connection + repos
│   │   ├── services/   # File I/O, PDF ops services
│   │   └── utils/      # Paths, logging
│   ├── preload/        # contextBridge (window.crosspdf)
│   ├── renderer/       # React app
│   │   ├── main.tsx    # Entry point
│   │   ├── App.tsx     # Root component
│   │   ├── components/ # UI components
│   │   ├── stores/     # Zustand stores
│   │   └── hooks/      # React hooks
│   └── shared/         # Shared types + IPC channels
├── tests/              # Vitest test suite
├── docs/               # Documentation + ADRs
├── .github/workflows/  # CI configuration
└── resources/          # App icons + static assets
```

## Phase Progress

### Foundation & Viewer

- [x] Phase 0: Electron + React + TypeScript + Vite foundation
- [x] Phase 0: Tailwind CSS, secure preload bridge, IPC handlers, and `sql.js` fallback
- [x] Phase 1A: Single-page PDF viewer — open, render, navigate, zoom, loading/error states
- [x] Phase 1B: Continuous scroll viewer, IntersectionObserver-based visible-page tracking
- [x] Phase 1C: Fit modes (actual/fit-width/fit-page), zoom presets, thumbnails, search, tab system
- [x] Phase 1D: Annotations — highlight, underline, strikeout, sticky-note, free-text, freehand, shapes, arrows; undo/redo, sidecar persistence

### Page Operations

- [x] Phase 2: Merge, split, extract, delete, reorder pages (pdf-lib in Web Worker)
- [x] Phase 3: Page rotation (90° CW/CCW)

### Advanced Features

- [x] Phase 4: OCR (Tesseract.js, 42 languages), preferences (SQLite-persisted), PDF security (password-protected open), forms (AcroForm fill/flatten), export service

## Database

Phase 0 uses **sql.js** (WASM-compiled SQLite) as a fallback from `better-sqlite3`.

| Aspect             | Detail                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| Why sql.js         | `better-sqlite3@12.10.0` native binding incompatible with Electron 42 V8 API   |
| Persistence        | Manual via `db.export()` → `fs.writeFile()`                                    |
| Runtime dependency | `sql-wasm.wasm` (~1.2 MB) must be available at runtime                         |
| Revisit plan       | Switch back to `better-sqlite3` when compatible version ships (before Phase 5) |
| ADR                | [docs/adr/0001-sqljs-fallback.md](docs/adr/0001-sqljs-fallback.md)             |

## Packaging

Packaging scripts are configured with `electron-builder@24` (stable).

```bash
pnpm package:mac   # macOS DMG
pnpm package:win   # Windows NSIS
pnpm package:all   # Both platforms
```

Code signing and notarization are deferred to Phase 5. See `electron-builder.yml` for configuration.

## Architecture Decisions

- [ADR 0001: sql.js Fallback](docs/adr/0001-sqljs-fallback.md)

## License

Proprietary. All rights reserved.
