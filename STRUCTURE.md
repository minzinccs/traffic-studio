# Traffic Studio — structure and module map

**Superseding code map, 2026-09-28:** `src-tauri/src/capture/` owns authenticated mitmproxy listener/event ingestion; `rules/`, `protocols/`, `analytics/`, `integrations/` and `storage/{har,backup,retention,decode,batch}.rs` hold native behavior. Matching UI is under `src/features/{capture,rules,protocols,tracker,analytics,layout,integrations,storage}/` and calls `src/bridge/`. `engine-sidecar/` contains the Python adapter and controlled benchmarks/fixtures; `scripts/setup-capture.ps1` prepares local development dependencies. `PHASE_6_10_PROGRESS.md` lists open acceptance work. Historical descriptions below are not the current runtime status.

## Current state

The repo contains a **working frontend build and visual preview**, plus a Tauri shell scaffold. It is not yet a traffic-capture app. `npm run build` succeeds; the browser preview has been checked for traffic/inspector, column menu, API split, Collections, History and Analytics. No native Tauri executable has been built on this machine.

**Current 2026-09-28 update — WORKLOG25:** the preceding paragraph records the old baseline. Native executable now builds. `src-tauri/src/http` provides direct HTTP transport; `src/bridge` has typed native/browser adapters; API native request/history components and storage resources call them. `src-tauri/src/http/oauth.rs` provides token exchange, `src-tauri/src/scripts/` contains bounded QuickJS execution, and `src/features/api/adapters/` contains Postman/OpenAPI JSON conversion. `src/features/environments/` edits native environment documents backed by `src-tauri/src/storage/environments.rs` and DPAPI secrets. Storage import/export modules provide atomic document imports and native body Save As. `src-tauri/src/platform/proxy.rs` reads WinINet settings; `proxy_control.rs` supplies explicit manual apply/restore with a durable recovery ledger and frontend recovery notice. Behavioral acceptance of these new modules is pending; capture engine remains unselected. See PHASE_4_5_PROGRESS.md.

```text
traffic-studio/
├─ AGENTS.md                 Agent rules and constraints
├─ AI_HANDOFF.md             Copy/paste brief for another AI
├─ INTERACTION_PLAN.md       Desktop interaction spec and phased plan
├─ WORKLOG.md                Completed UI work, verification and remaining gaps
├─ DESIGN_DECISION.md        Product scope, stack and core gate
├─ DESIGN_SYSTEM.md          Theme, layout, typography and tokens
├─ FEATURE_INVENTORY.md      Reqable feature-parity checklist
├─ CORE_REUSE.md             Candidate proxy-core research
├─ SELF_HOSTING.md           LAN-first transfer and optional relay
├─ src/
│  ├─ main.tsx               React entry point
│  ├─ App.tsx                Desktop shell, navigation, tabs, preview traffic
│  ├─ styles.css             Current global styles (needs gradual split)
│  ├─ theme.css              Mine Shaft palette overrides (#2B2B2B)
│  ├─ motion.css             Shared motion cues and reduced-motion handling
│  ├─ domain/types.ts        View, Tab, Flow, FlowDetail, MockResponse UI types
│  ├─ data/
│  │  ├─ demoFlows.ts        Synthetic traffic fixture (list)
│  │  └─ flowDetails.ts      Per-flow mock detail (headers/body/timeline/device/app)
│  ├─ bridge/
│  │  └─ mockBridge.ts       Typed mock data source (DEMO flag; listFlows, getFlowDetail, sendMockRequest)
│  ├─ features/
│  │  ├─ capture/TrafficInspector.tsx  Inspector Summary/Raw/Headers/Body/Timeline (mock)
│  │  ├─ capture/TrafficTable.tsx      Configurable Traffic columns (local preference)
│  │  ├─ capture/TrafficFilters.tsx    Quick and advanced sample traffic filters
│  │  ├─ api/ApiView.tsx               Editable API draft, local save, mock Send response
│  │  ├─ api/CollectionsPanel.tsx      Local collection/profile editor
│  │  ├─ api/collections.ts            Local collection/profile storage model
│  │  ├─ history/sessions.ts           Labelled sample sessions + browser saved requests
│  │  ├─ history/HistorySidebar.tsx    History sidebar mode (search, selected, filter-zero)
│  │  ├─ history/HistoryView.tsx       History detail pane driven by the sidebar
│  │  ├─ devices/devices.ts            Host-only device model; Connected/Available stay empty
│  │  ├─ devices/DeviceSidebar.tsx     Host/Connected/Available tree + pairing note
│  │  ├─ devices/DevicesView.tsx       Device cards, selection and detail
│  │  ├─ environments/environments.ts  Shared environment store (secrets stripped on write)
│  │  ├─ environments/EnvironmentSidebar.tsx  Environment list / active picker
│  │  ├─ tools/tools.ts                Tool catalogue with availability + reasons
│  │  ├─ tools/toolIcons.tsx           Shared tool icons
│  │  └─ tools/ToolboxSidebar.tsx      Toolbox sidebar mode
│  ├─ shell/
│  │  ├─ MenuBar.tsx        Menubar + portal overlay for multi-level menus (FE-1)
│  │  ├─ menuModel.ts       Typed menu command model and buildMenus()
│  │  ├─ sidebarModes.ts    Contextual sidebar modes, F1–F6 and section mapping (FE-2)
│  │  ├─ PageChrome.tsx     Shared PageHead / DemoNote used across feature pages
│  │  ├─ ExplorerSidebar.tsx Contextual Traffic/API tree and setup JSON editor
│  │  ├─ WorkspaceTabs.tsx  Tab context menu and reorder controls
│  │  ├─ menu.css           Menu bar and overlay styling
│  │  ├─ explorer.css        Explorer and Traffic table styling
│  │  ├─ resizers.css       Sidebar/divider resize affordances
│  │  └─ splitPane.css      Two-pane API layout
│  └─ views/
│     ├─ WorkspacePages.tsx Rules, Toolbox, Tracker, Analytics, Environments UI
│     ├─ useLocalDraft.ts    Browser persistence for non-secret UI drafts
│     └─ workspacePages.css Styles for primary workspace pages
├─ src-tauri/
│  ├─ Cargo.toml             Rust package
│  ├─ build.rs               Tauri build hook
│  ├─ tauri.conf.json        Desktop window and Vite integration
│  └─ src/main.rs            Tauri entry point; no commands yet
├─ package.json             Frontend scripts and dependencies
└─ vite.config.ts           Local dev server (127.0.0.1:5173 for web preview)
```

`node_modules/`, `dist/`, `.npm-cache/`, TypeScript build info and Rust `target/` are generated and ignored.

## Real module status

- **Physically separated now:** shared UI types, synthetic data, API view, History, Devices, Environments and Tools modules, main workspace pages, shared page chrome, Tauri shell.
- **Still shared/centralized:** `App.tsx` owns shell, toolbar, tab state, sidebar-mode state and traffic preview; `styles.css` contains all UI styles; `src/views/WorkspacePages.tsx` still holds Rules/Toolbox/Tracker/Analytics/Environments views. These are refactor targets as real features are added.
- **Still missing:** selected/integrated capture engine, real capture persistence, rule execution, durable tracker/analytics integration, general docking and LAN transfer. Native HTTP, scripts, storage/vault, certificate and manual proxy modules now compile; their runtime acceptance is pending. Tracker and analytics still use sample data.

## Target module boundaries

| Module | Owns | Suggested directory |
| --- | --- | --- |
| Shell | Menu, rail, toolbar, tabs, status, workspace layout | `src/shell/` |
| Capture | Traffic list, search/filter, inspector, sessions, HAR | `src/features/capture/` |
| API client | Request editor, auth, collections, environments, response | `src/features/api/` |
| Rules | Breakpoint, rewrite, mock/map, scripts, network conditions | `src/features/rules/` |
| Tracker | Request links, tags, status, notes, board/table views | `src/features/tracker/` |
| Analytics | Metrics, charts, drill-down and comparisons | `src/features/analytics/` |
| Device/LAN | Pairing and transfer (later phase) | `src/features/devices/` |
| Core bridge | Typed commands/events and domain mapping | `src/bridge/`, `src-tauri/src/` |
| Design | Reusable controls and tokens | `src/ui/`, feature-local styles |

Build the missing directories only when implementing those modules. Keep the shell small; features should not import each other's internals.

## Data flow target

```text
Proxy engine (candidate pending)
    ↓ events / commands
Tauri Rust adapter
    ↓ typed bridge
Domain model + local persistence
    ↓ selectors / actions
React feature modules
    ↓
Dockable desktop workspace
```

The bridge contract should start with `start_capture`, `stop_capture`, `set_proxy_endpoint`, `subscribe_flows`, `get_flow`, `import_har`, and `send_request`. Names are a proposed boundary, not implemented API calls.

## Commands

```powershell
npm ci
npm run dev       # browser UI at http://127.0.0.1:1420/
npm run build     # TypeScript + production frontend build
npm run preview   # built frontend preview
npm run tauri -- dev  # only after Rust + MSVC/Windows SDK are installed
```

## First useful tasks for another AI

1. Extract the traffic list/inspector and shell pieces from `App.tsx` into separate modules without changing the visible UI.
2. Split `styles.css` by shell and feature while retaining tokens and responsive behavior.
3. Implement a typed bridge interface with a mock provider. Keep sample traffic clearly synthetic.
4. Benchmark Whistle and mitmproxy on Windows against `FEATURE_INVENTORY.md` before committing to a proxy core.
5. Implement P0 shell interactions from `INTERACTION_PLAN.md` before expanding backend-dependent UI.

## Current feature map — 2026-09-26

New feature boundaries: settings (preferences/config/CA/integrations), notifications, layout, tools (local codecs/crypto/QR), protocols (WebSocket/SSE previews), rules, tracker, analytics, data-transfer (validated modal), environments. Capture owns MessagePane/annotations/Explorer/sessionFiles/session manager/comparison. API owns cURL/collection transfer/CollectionExplorer/multi-pane workspace. WorkspacePages now reexports feature views; shell/useDialogFocus owns shared modal focus behavior. See FE_STATUS.md for behavioral limits.

features/workspaces exports WorkspaceRoot (main.tsx entry wrapper) and owns local snapshot switching/management. File menu and Settings dispatch the workspace manager event. Inspector owns persistent tab order/visibility. useDialogFocus now supports an optional enabled flag for conditionally mounted overlays.


Follow-up (19): environment `resolution.ts`/`VariableEditor.tsx` own scope interpolation and overrides; settings `shortcuts.tsx` owns configurable shell commands; `BackupRecovery.tsx` validates document recovery into new workspaces. `FlowDetail.responseBodyBase64` carries original imported HAR bytes alongside UTF-8 preview text. `tests/frontend-contracts.cjs` exercises these boundaries using the existing TypeScript dependency.


## Full app planning map — 2026-09-27

`APP_IMPLEMENTATION_PLAN.md` defines P00–P14 and completion gates; `APP_ROUTE_MAP.md` defines 26 proposed logical routes, module ownership, entities and bridge command/event boundaries. `APP_TRACKER.json` is the status/dependency/evidence source for 105 tasks and 36 inventory groups; `APP_TASKS.md` is generated with `node scripts/check-plan.mjs --render`. Planned directories/routes/commands are not implemented simply because they appear in these documents.
