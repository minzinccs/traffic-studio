# Traffic Studio — structure and module map

## Current state

The repo contains a **working frontend build and visual preview**, plus a Tauri shell scaffold. It is not yet a traffic-capture app. `npm run build` succeeds; the browser preview has been checked for traffic/inspector, column menu, API split, Collections, History and Analytics. No native Tauri executable has been built on this machine.

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
- **Not implemented:** proxy engine, capture persistence, certificate management, HTTP client, rule execution, durable tracker/analytics storage, dockable pane engine, LAN transfer. Tracker and analytics now have frontend views using sample data.

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
