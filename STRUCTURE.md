# Traffic Studio — structure and module map

## Current state

The repo contains a **working frontend build and visual preview**, plus a Tauri shell scaffold. It is not yet a traffic-capture app. `npm run build` succeeds; the browser preview has been checked for home, sample traffic/inspector, API view and proxy-address dialog. No native Tauri executable has been built on this machine.

```text
traffic-studio/
├─ AGENTS.md                 Agent rules and constraints
├─ AI_HANDOFF.md             Copy/paste brief for another AI
├─ INTERACTION_PLAN.md       Desktop interaction spec and phased plan
├─ DESIGN_DECISION.md        Product scope, stack and core gate
├─ DESIGN_SYSTEM.md          Theme, layout, typography and tokens
├─ FEATURE_INVENTORY.md      Reqable feature-parity checklist
├─ CORE_REUSE.md             Candidate proxy-core research
├─ SELF_HOSTING.md           LAN-first transfer and optional relay
├─ src/
│  ├─ main.tsx               React entry point
│  ├─ App.tsx                Desktop shell, navigation, tabs, preview traffic
│  ├─ styles.css             Current global styles (needs gradual split)
│  ├─ domain/types.ts        View, Tab and Flow UI types
│  ├─ data/demoFlows.ts      Synthetic traffic fixture only
│  └─ views/
│     ├─ ApiView.tsx         API client preview
│     └─ PlaceholderView.tsx Rules/History/Devices/Toolbox previews
├─ src-tauri/
│  ├─ Cargo.toml             Rust package
│  ├─ build.rs               Tauri build hook
│  ├─ tauri.conf.json        Desktop window and Vite integration
│  └─ src/main.rs            Tauri entry point; no commands yet
├─ package.json             Frontend scripts and dependencies
└─ vite.config.ts           Local dev server (127.0.0.1:1420)
```

`node_modules/`, `dist/`, `.npm-cache/`, TypeScript build info and Rust `target/` are generated and ignored.

## Real module status

- **Physically separated now:** shared UI types, synthetic data, API view, placeholder views, Tauri shell.
- **Still shared/centralized:** `App.tsx` owns shell, toolbar, tab state, traffic preview and inspector; `styles.css` contains all UI styles. These are refactor targets as real features are added.
- **Not implemented:** proxy engine, capture persistence, certificate management, HTTP client, rule engine, tracker, analytics, dockable pane engine, LAN transfer.

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
