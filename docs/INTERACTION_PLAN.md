# Traffic Studio — desktop interaction and implementation plan

Status: specification, not a claim of implemented functionality. Scope: Windows desktop first, Tauri 2 + React/TypeScript. Use the seven user screenshots as behavior references; retain Traffic Studio's original visual identity. No Git push requested.

## 1. Product model

Traffic Studio is a local-first workspace with multiple simultaneous documents and panes. A **workspace** contains sessions, API collections, environments, rules, tracker boards, analytics layouts and user layout preferences. A **session** stores captured flows and capture settings. An **API document** stores a request definition and its response history. A **view** is a rendering of the same data, never a second copy of it. The user may have multiple tables/boards/inspectors open side by side.

The top title/menu bar, activity rail, contextual sidebar, proxy/capture toolbar, document tabs, editor/content area, optional bottom panel and status bar are persistent shell regions. Clicking a rail icon changes the sidebar/content context without silently discarding open documents. Tabs represent documents, while panels represent views of a document. Separate dirty indicators, loading/progress state and errors per document.

## 2. Interaction language

| Element | Required behavior |
| --- | --- |
| Hover | 100–150 ms color/background transition; icon, row and tab affordances appear without moving layout. Tooltip after 500–700 ms. Hover alone never triggers a destructive action. |
| Press/focus | Distinct pressed and `:focus-visible` states; keyboard and mouse reach the same commands. No focus trap outside dialogs/menus. |
| Page/panel transition | 120–200 ms subtle opacity/translate or width change; preserve scroll, selected row and text draft. Respect reduced-motion setting. |
| Loading | Small spinner/skeleton only where work is happening; show command progress and cancellation for long tasks. Never show synthetic traffic as real capture. |
| Feedback | Inline validation for fields, toast for completed reversible actions, explicit error with retry for failures, confirmation only for destructive or unsaved-data actions. |
| Empty state | Explain the next useful action and its shortcut. Differentiate no data, filtered-to-zero, disconnected, loading and failed states. |
| Menu/dropdown | Click or keyboard opens; arrow keys navigate; Enter/Space activates; Esc closes; disabled items remain visible with explanation; submenu opens on pointer and keyboard. |
| Drag | Show ghost, insertion marker and valid drop targets. Auto-scroll long tab strips and sidebars. Cancel with Esc; persist order/layout. |

Central design tokens in `DESIGN_SYSTEM.md`; add motion/density/z-index tokens there before implementing. Use one overlay/portal layer so menus are not clipped by split panes. Animation should never block typing or network rendering.

## 3. Shell and tab lifecycle (screenshot 1)

- Tab types: Traffic, HTTP request, WebSocket, SSE, collection, tracker table/board, analytics dashboard and tool. A tab has stable ID, title, kind, icon, dirty flag, pinned flag, loading state and optional session/document ID.
- New-tab `+` opens a picker; keyboard shortcuts open the most common document types. Double-click a tab to rename when relevant. Middle-click closes. Ctrl+Tab cycles; Ctrl+Shift+Tab reverses; Ctrl+W closes current.
- Drag tabs to reorder. Drop near left/right edge to form a split group; drag across groups to move. Show visible split indicator. Resize groups with keyboard-accessible divider; remember per-workspace sizes. Allow reset layout.
- Context menu: Clear, New Session, Save, Close, Force Close, Close Others, Force Close Others, Close to Right, Force Close to Right, Close All, Force Close All. Scope each command to the clicked tab/group; disable impossible commands (e.g. Save for unchanged scratch tab). Treat force close as discarding unsaved content and ask once with clear scope. Clear traffic must say whether it clears current view or persisted session.
- Closing dirty tabs asks Save / Don't Save / Cancel. Save failures keep the tab open. Autosave drafts locally with a visible recovery path; explicit Save still writes durable workspace state. Reopen Closed Tab and undo for reversible close/clear.
- Startup restores last workspace and tab order, except when user chose a clean start. Persist active tab, group, sidebar, bottom panel and selected subview.

## 4. Capture and proxy workspace

- Toolbar: listener address/port edit, start/stop capture, recording state, proxy mode, certificate/trust state and device status. Show `Stopped`, `Starting`, `Recording`, `Stopping`, `Error` with timestamp and actual listener endpoint. An IP shown in UI must come from the backend.
- Traffic list: live rows, pause display versus stop capture, search/query chips, filters by method/status/domain/content type/time/device, sortable/resizable/reorderable columns, multi-select, context actions, virtual scrolling and bounded memory. Keep current selection when a new flow arrives.
- Inspector: request/response overview, headers, query, cookies, body, timing, TLS, raw/decoded/hex/image views; copy/export/save; compare two flows; redaction for secrets. Independent loading/error for large bodies.
- Sessions: new/open/save/save as/import/export HAR, clear, merge or duplicate. Unsaved state and retention policy visible. History is durable only after storage implementation.
- Rules: breakpoints, rewrite, map local/remote, mock, scripts, throttling and replay with explicit enabled/status/order. Rule testing and conflict feedback. This needs a chosen core; do not present switches as effective until wired.

## 5. API editor (screenshots 2–3)

- Request types: HTTP, WebSocket and later SSE/GraphQL/gRPC if included in `FEATURE_INVENTORY.md`. HTTP method dropdown supports common methods plus custom verb; method color is secondary to text. URL field supports typing/paste, variable interpolation, history and cURL paste/import, validation and clear error.
- Tabs: Query, Headers, Body, Script, Authorization, Docs, Settings. Each has its own state and count badge. Key/value grids support add/delete, enable/disable, reorder, duplicate keys, bulk edit, paste multi-line pairs and undo. Enter adds a row; Tab advances cells. Do not drop blank-but-edited rows.
- Body: none, form data, URL encoded, raw text/JSON/XML, binary/file and multipart, with content-type handling. Structured editor has formatting/validation and file size safeguards. Auth options and scripts are scoped to request/collection/environment with clear precedence.
- Send lifecycle: Idle → Validating → Sending → Receiving → Complete/Error/Cancelled. Disable duplicate Send for same request unless explicitly allowed. Show cancel, timeout, progress, elapsed time, status, response size and certificate error. Sending must call the typed bridge; preview mode must say it is simulated.
- Response pane: split horizontally/vertically, drag divider, collapse/expand, resize, response body/header/cookie/timing tabs, formatted/raw/preview, search and copy/save. Preserve response while editing next request and label which request produced it.
- Save: request belongs to collection/folder or scratch; name, rename, move, duplicate and Save As. New scratch request is recoverable even before named save. Drafts are local, encrypted only if a real encryption implementation exists.

## 6. Environment, device, toolbox, certificate

### Environments (screenshot 3)

Global → workspace → collection → request precedence, with a selector in the editor. Create, rename, duplicate, delete, import/export; row editor for variable name/current value/initial value/secret flag. Warn on unresolved variables and cycles. Secret values masked by default and excluded from plain exports unless explicitly selected. Import adapters for Postman/Hoppscotch/ApiFox should show a preview and unmapped fields before committing.

### Devices (screenshot 2)

Host device, connected devices and available devices are separate collapsible groups. Refresh, pair by QR or IP/code, authenticate, show trust/last-seen, disconnect/revoke. LAN transfer and mobile companion are later phases; until then the panel should state that pairing is unavailable. No unauthenticated LAN listener by default.

### Toolbox and menus (screenshots 4 and 7)

Searchable categories: Codec (Base64, URL, JWT, JSON escape, Unicode), Crypto (hash, HMAC, AES), View (JSON, XML, Hex, Image, Color), Other (timestamp, UUID, regex, QR). Tool opens as a tab or side panel with input/output, direction, options, copy, clear, error and history. Menu mirrors actions; nested menus for Decode/Encode/Hash/HMAC/Encrypt/Decrypt/View. Premium icons in reference are not a product requirement: mark only actually implemented tools available. Avoid handling secret keys in telemetry or logs.

### Certificate (screenshot 5)

Menu actions: view/manage root certificate, install/export for local Windows, Firefox, Android, iOS and Java VM; inspect SSL certificate. Each platform needs a real guided flow with current trust status, fingerprint, clear security explanation and removal instructions. OS trust modification needs explicit user action and admin elevation where required; never make the UI imply installation succeeded before backend confirmation.

## 7. WebSocket editor (screenshots 4 and 6)

URL/connect/disconnect lifecycle with protocol selection, headers/query, message composer (text/JSON/binary), sent/received stream, timestamps, search/filter, save/export and reconnect policy. Settings: ping interval, proxy, TLS verification, omit equal sign and URL autocomplete. Validate ping interval and proxy choice; distinguish connection, protocol and TLS errors. On disconnect retain message history until user clears or closes the session. Server-sent events should have its own read-only stream behavior where applicable.

## 8. Tracker, analytics and multi-view additions

- Tracker entities: linked flow(s), issue title, category, tags, status, priority, assignee optional, notes, timestamps and custom fields. One flow can be linked to multiple issues; one issue can link multiple flows. Status/category are user-defined and can be reordered.
- Views over one dataset: table, kanban board, timeline and saved filters. Multiple boards/tables can be open at once and placed in separate split groups. Changes propagate live to all views without duplicate records. Support sort/group/filter, bulk edit, CSV/JSON export and local persistence.
- Analytics: latency/status/domain/device/content-type charts, time windows, drill down to flows, comparisons between sessions and saved dashboards. Show data source, sampling/retention and empty-state meaning. Computation should be incremental on large captures.
- Workspace layout: dockable panes for traffic, inspector, tracker and analytics; save named layouts and restore. Constrain minimum sizes; accessible divider. A pane's filters are view-local unless explicitly saved/shared.

## 9. State and persistence contracts

Separate transient UI state from persisted documents. Proposed records: `Workspace`, `Tab`, `PaneGroup`, `CaptureSession`, `Flow`, `RequestDocument`, `ResponseRun`, `Collection`, `Environment`, `TrackerItem`, `SavedView`, `LayoutPreset`. Give each stable ID and version. Do not put full captured bodies into browser `localStorage`; store only small UI preferences/drafts there until Rust-backed local storage exists. Production persistence should use a Rust-managed SQLite database plus content-addressed/streamed body files, with schema migrations, atomic save and export/backup. This is a design proposal, not implemented.

Define typed commands/events through `src/bridge/`: capture start/stop/state, flow summary/body stream, request send/cancel, WebSocket connect/send/disconnect, save/load/import/export, certificate state, device state. The React feature modules should consume domain models, not proxy-engine objects. Support a mock bridge for UI development with prominent `Demo` state; real bridge selected only after integration.

## 10. Implementation phases and acceptance gates

| Phase | Deliverable | Acceptance |
| --- | --- | --- |
| P0: shell interaction | Extract shell/tabs from `App.tsx`; menus, keyboard shortcuts, hover/focus/motion tokens, drag/reorder, split groups, dirty-close flow, local layout persistence | Reload restores layout/order; mouse and keyboard paths work; no lost draft on close; reduced motion respected. |
| P1: local documents | Request editor, collections/categories, environments, key/value grids, draft/save/open/import UI, toolbox tools that run entirely locally | A typed request and environment survive restart; duplicate keys and unsaved edits persist; imports show validation; UI labels real versus simulated actions. |
| P2: Rust storage/bridge | Tauri commands/events, SQLite migrations, file-backed bodies, typed errors, import/export | Save/reopen session and requests in native app; interruption does not corrupt workspace; frontend build and native build pass on provisioned Windows machine. |
| P3: HTTP client | HTTP send/cancel, auth, body types, response viewer, timing, redirects/TLS/proxy options | Real request round trip with status/body/timing and error/cancel states; no fake success. |
| P4: capture core | Benchmark/select core, listener/TLS, flow streaming, sessions, filters/inspector, HAR, certificates | Capture browser/device traffic with explicit trust setup; large session remains responsive; endpoint and state are accurate. |
| P5: advanced protocol/rules | WebSocket/SSE, breakpoints/rewrite/mock/map/script, replay, toolbox completion | Each rule has a verifiable test case; WebSocket send/receive and disconnect states work. |
| P6: tracker/analytics/layout | Multi-view tracker, custom status/category, charts, drill-down, named layouts | Same record updates in two open views; layouts survive restart; charts link back to source flows. |
| P7: LAN companion | Authenticated pairing and IP transfer; Android/iOS apps only after PC foundation | Revocation works; transfer is encrypted/authenticated; LAN listener opt-in. |

Do not defer basic accessibility, empty/error/loading states or persistence integrity to later phases. Each phase should finish with a real interaction walkthrough and explicit list of simulated actions.

## 11. Work packages for other AI agents

1. **Shell owner:** `src/shell/`, `src/ui/`, shell CSS; tab lifecycle, menu, drag/split, shortcuts. Coordinate changes to `src/App.tsx`.
2. **API owner:** `src/features/api/`; request editor, key/value grids, environment/collection UI and response pane. No direct Tauri globals.
3. **Capture owner:** `src/features/capture/`; list, inspector, filters, sessions and HAR UI. Demo source must remain marked.
4. **Bridge/storage owner:** `src/bridge/`, `src-tauri/`; typed API, migrations, local files. Coordinate domain type changes.
5. **Tracker/analytics owner:** `src/features/tracker/`, `src/features/analytics/`; shared records and multiple saved views.

For every work package: state exact files touched, real versus mock behavior, keyboard/mouse interaction, loading/empty/error states, persistence, verification and unresolved backend dependencies. One agent owns shared shell files at a time.

## 12. Immediate next slice

Implement P0 first: interactive tab strip/context menu, drag reorder, basic split/drop target, top menus/dropdowns, focus/hover/motion, and honest save/dirty flow backed by local draft persistence. Follow with P1 request editor. This yields a usable desktop interaction foundation before core selection and native proxy integration.
