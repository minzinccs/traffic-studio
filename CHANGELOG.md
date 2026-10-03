# Changelog — Traffic Studio

All notable changes to this project are documented here. Dates are in UTC.
Development worklogs and AI handoff notes were removed before release prep;
history below is condensed to product-relevant milestones.

## [Unreleased]

### Changed
- Traffic page is now Reqable-style: clean empty state (Start Recording
  Ctrl+G / Create REST API Ctrl+T / Open File Ctrl+O) with only a flow
  table when data exists. All native setup moved out of the main view
  into the Capture setup dialog (workspace, port, mode, CA/TLS, HAR
  import, packet tools), opened from Record / Configure in Capture.
- Workbench Traffic panes use the same clean `NativeTrafficView`; the old
  inline `NativeCaptureWorkspace` is removed.
- Packet capture moved to Toolbox as a `Capture` tool + Tools menu entry;
  native HAR import/export moved into Sessions & HAR (`File` menus) via a
  new `NativeHarPanel`. Capture dialog keeps workspace/listener/TLS only.
- API workspace slide timing: workspace-tab slide 0.68s (680ms),
  request-tab slide 0.64s (640ms); the two levels animate independently.
- Workspace tab strip 47px → 33px; pane preset moved into the `...` panel menu.
- Request tabs use a square underline hugging the label; Fast Refresh
  no longer invalidates on `KeyValueGrid` / `RequestBodyEditor` edits.

### Added
- LAN ingest for the mobile companion: `POST /v1/ingest` (TLS + bearer, ≤50 flows / ≤100 events / ≤512 KiB) stores mobile flows as `flow` entities and debug events as `tracker_item` records; QR pairing payload (`schemaVersion`, host, port, fingerprint, token), per-device last-seen/counters with revoke (`lan_devices`, `lan_pairing`, `lan_revoke`), and a 120 req/min LAN rate limit.
- Native flow full-text search: SQLite FTS5 `flow_search` index maintained by
  triggers, `flow_search` IPC command + typed bridge contract, native capture
  search box wired to the server (browser falls back to page filter).
- Traffic Explorer shows real native sessions/flows in native mode with an
  empty-state Create workspace action; browser preview keeps sample data.
- Mode-honest copy: Settings retention and History footer now distinguish
  native runtime from browser preview.

### Fixed
- Zoom 80% caused 360px horizontal overflow (removed faulty width/height
  compensation; CSS `zoom` alone scales layout).
- Native selects rendered tiled chevrons in light theme under
  `appearance: base-select` (background-image specificity fix).
- Escape now closes the About/Shortcuts modal.
- Unified all dropdowns on the shared `SelectField` picker (keyboard
  operable, portal popup, dark/light): settings, API editor, capture,
  rules, tracker, analytics, protocols, toolbox, workbench. Only the
  bespoke per-method API select keeps native rendering.

### Verification status (this checkout)
- `npm run build`, frontend contract suites pass.
- Rust verified 2026-09-30 (cargo 1.98.1, MSVC 14.44, SDK 26100.0):
  `cargo fmt --check` clean, `cargo test` 32 passed / 0 failed
  (100k FTS benchmark ignored by design), FTS 100k benchmark through
  `Database::open`: 100000 rows in ~28s debug / ~7.8s release, query
  1 row in 0ms both profiles.
  Fixed an MCP keep-alive race (400-version replies now drain the bounded
  body; flaky 2/3 → stable).
- `scripts/build-local-release.ps1` produced an embedded-frontend release
  executable; native CDP driver: 11 rail screens, 0 console problems,
  0 overflow, 0 zero-size controls; native Settings/History copy verified
  on screenshots (evidence under `.runtime/uitest/`, git-ignored).
- Remaining before installer: clean-machine install/upgrade/uninstall test,
  code signing, 100k-flow soak, full parity audit. MSI now builds locally
  (`tauri build --bundles msi`, WiX 3.14, bundle enabled in
  `src-tauri/tauri.conf.json` 2026-10-01: `Traffic Studio_0.1.0_x64_en-US.msi`
  ~7 MB, unsigned); NSIS target and signed installer remain open.

## [0.1.0] — 2026-09-29 — local-first native foundation (pre-release)

### Added
- Tauri 2 + React/TypeScript/Vite desktop shell (dark/light, VI/EN, shortcuts,
  named layouts, mixed 1–4 pane workbench, detached windows).
- Native HTTP client (send/cancel/timeout, TLS verify, proxy/CA per request,
  multipart streaming, Digest/OAuth, QuickJS pre/post scripts, cookie jars).
- Authenticated localhost mitmproxy capture adapter (regular/reverse/upstream,
  explicit TLS interception, breakpoints, rewrite/mock/gateway/mirror rules,
  WebSocket/SSE clients, HTTP/3 reverse fixture).
- SQLite metadata + streaming body store, DPAPI secret vault, environments,
  backup/restore with checksum, body retention GC, crash recovery.
- HAR 1.2 import/export (binary-safe), Charles XML exchange import, body
  decoders (gzip/deflate/br, protobuf wire fields, AES-GCM lab, file hashes).
- Tracker (status/category/tag, bulk edit, board/table/timeline, JSON/CSV
  export) and Analytics (real-session metrics, dashboards, drill-down) on
  persisted data.
- Certificates: local ECDSA signing CA, current-user Windows trust
  install/remove with fingerprint ledger; per-target setup guidance.
- Opt-in integrations: read-only LAN metadata gateway (private IPv4 + bearer),
  local MCP tools with audit, proxy terminal, packet capture via installed
  dumpcap/Npcap with PCAPNG ring and key-log analysis.
- Release tooling: `scripts/build-local-release.ps1` (Tauri CLI build with
  embedded-frontend guard), `tests/native-ui-drive.mjs` CDP UI driver,
  `scripts/license-inventory.mjs` third-party inventory.

### Known limits
- No clean-machine installer, MSI, or code signing yet; capture runtime needs
  `scripts/setup-capture.ps1` on the dev checkout (not portable).
- Native UI interaction acceptance, 100k-flow performance soak, and full
  Reqable parity audit remain open. Android/iOS companions are future work.
- License/SBOM: `THIRD_PARTY_INVENTORY.json` is the source; NOTICES draft in
  `notices/`. Exact OSS license for the app itself is undecided.

## Docs

Product docs live in `docs/`: scope and stack (`DESIGN_DECISION.md`),
design language (`DESIGN_SYSTEM.md`), feature checklist
(`FEATURE_INVENTORY.md`), interaction and persistence
(`INTERACTION_PLAN.md`), module map (`STRUCTURE.md`), engine choice
(`ENGINE_SELECTION.md`, `CORE_REUSE.md`), local-first architecture
(`LOCAL_FIRST_ARCHITECTURE.md`), MCP/port/packet designs
(`MCP_PORT_DESIGN.md`, `PACKET_CAPTURE_DESIGN.md`), self-hosting
(`SELF_HOSTING.md`). Agent rules: `AGENTS.md`.
