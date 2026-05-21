# ADR 0001: sql.js Fallback for Phase 0

- **Status**: Accepted
- **Date**: 2026-05-20
- **Deciders**: CrossPDF Studio development team

## Context

Blueprint `BLUEPRINT_ID.md` dan `docs/02-technical-architecture.md` mengunci
`better-sqlite3` sebagai database lokal untuk CrossPDF Studio. `better-sqlite3`
adalah binding native C++ ke SQLite, dipilih karena performa tinggi, API
synchronous yang sederhana, dan dukungan WAL mode penuh.

## Problem

Saat implementasi Phase 0 (2026-05-20), `better-sqlite3@12.10.0` gagal dikompilasi
untuk Electron 42.1.0. Electron 42 membawa V8 engine versi baru dengan breaking
changes pada API `v8::External`:

- `External::New(isolate, value)` → sekarang butuh parameter ketiga `tag`
- `External::Value()` → sekarang butuh parameter `tag`
- `SetNativeDataProperty` → overload ambigu

Error muncul dari `node-gyp rebuild` via `@electron/rebuild`:

```
error: too few arguments to function call, single argument 'tag' was not specified
error: call to member function 'SetNativeDataProperty' is ambiguous
```

Versi `better-sqlite3@12.10.0` belum mendukung V8 API baru ini. Tidak ada versi
patch yang tersedia pada saat penulisan.

## Decision

**Phase 0 menggunakan `sql.js` (SQLite WASM) sebagai fallback, bukan `better-sqlite3`.**

`sql.js` adalah SQLite yang dikompilasi ke WebAssembly. Tidak memerlukan
kompilasi native, sehingga tidak terpengaruh oleh perubahan V8 API.

## Consequences

### Positif

- Tidak perlu native compilation / `node-gyp`
- Tidak perlu `electron-builder install-app-deps` atau `@electron/rebuild`
- Portable — WASM jalan di semua platform tanpa rebuild
- Inisialisasi async → lebih eksplisit

### Negatif

- **Persist ke disk harus manual**: `db.export()` mengembalikan `Uint8Array`,
  harus di-write ke filesystem dengan `fs.writeFile`. Tidak ada auto-persist
  seperti `better-sqlite3` WAL.
- **Tidak ada WAL mode sejati**: PRAGMA WAL bisa diset tapi tidak persisten
  antar session. Database selalu full-load ke memory.
- **Performa**: Operasi baca/tulis di memory WASM, bukan native. Untuk dataset
  besar (>100MB) mungkin terasa lebih lambat.
- **Ukuran bundle**: `sql-wasm.wasm` sekitar 1.2MB, harus tersedia di runtime.

### Risiko Packaging

Saat aplikasi di-package (Phase 5), file `sql-wasm.wasm` harus:

1. Tersalin ke direktori resources/aplikasi
2. Path-nya di-resolve dengan benar di `initSqlJs({ locateFile })`
3. Diuji di macOS DMG dan Windows NSIS

## Revisit Trigger

Kembali ke `better-sqlite3` jika salah satu kondisi terpenuhi:

1. `better-sqlite3` merilis versi yang kompatibel dengan V8 API di Electron 42+
2. Electron men-stabilkan ABI native module untuk versi LTS
3. Performa `sql.js` terbukti tidak memadai untuk workload nyata (misal,
   recent documents > 1000, atau session restore lambat)

**Target revisit**: Sebelum Phase 5 (packaging). Jika `better-sqlite3` sudah
kompatibel, migrasi dilakukan sebagai bagian dari Phase 5.

## Alternatives Considered

| Alternatif                          | Alasan ditolak                                                 |
| ----------------------------------- | -------------------------------------------------------------- |
| Downgrade Electron ke 33.x          | Kehilangan security patch Chromium, V8 improvement             |
| `node:sqlite` (built-in Node 22.5+) | Tidak tersedia di Electron 42 (Node internal berbeda)          |
| `sql.js` (WASM)                     | **Diterima sebagai fallback**                                  |
| Tunda database, pakai JSON file     | Tidak scalable untuk Phase 1 (recent docs, session, bookmarks) |

## References

- [Blueprint — Technical Architecture](docs/02-technical-architecture.md) section 8.2
- [Blueprint — Development Readiness Review](docs/06-development-readiness-review.md) section 2
- [sql.js documentation](https://github.com/sql-js/sql.js/)
- [Electron 42 release notes](https://www.electronjs.org/blog/electron-42-0)
