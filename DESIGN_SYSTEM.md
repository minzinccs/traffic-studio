# Traffic Studio — desktop UI direction

## Product shape

Windows desktop app first. The current code is a **UI shell** and does not capture traffic yet. Tauri hosts a React/TypeScript frontend; the proxy engine is a separate decision after a runtime spike. No Flutter code or dependency is included.

## Visual language

- Dark graphite workspace, soft panel separation, amber for primary actions and focus, mint for healthy/live status, red only for errors.
- Dense developer-tool information in active workspaces, generous spacing in empty states.
- Native window frame for the first version; app menu starts beneath the Windows title bar. Avoid copying Reqable's brand assets or exact layout measurements.
- Typography: Segoe UI for interface, JetBrains Mono when installed (Consolas fallback) for addresses, methods, shortcuts, IDs and timings. The shell works offline.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#181a1d` | Main workspace |
| Surface | `#202226` | Rail, panels |
| Raised surface | `#25282d` | Toolbar, inputs |
| Border | `#34383d` | Panel edges |
| Text | `#e6e8e9` | Primary content |
| Muted | `#8f969d` | Secondary content |
| Amber | `#efb34f` | Primary actions, active tab |
| Mint | `#5fc59a` | Live/healthy status |

Base grid uses 4 px units. Menu height 44 px, navigation rail 58 px, capture toolbar 79 px, tab strip 47 px, status bar 29 px. Corners: 5–9 px for controls; 11 px for dialogs.

## Layout hierarchy

1. Application menu and workspace status.
2. Vertical navigation for Traffic, API, Rules, History, Devices, Toolbox.
3. Capture control with editable listener address and record action.
4. Workspace tabs and future dockable panels.
5. Contextual content: empty state or traffic table + inspector; API and other sections have preview shells.
6. Footer status with capture state, listener and version.

## Interaction state

Record toggle, tab switching/closing, new API tab, local listener address editing, search and selectable sample traffic are interactive UI previews. The main workspace pages now include frontend interactions; API drafts can be saved to browser localStorage and a small set of toolbox transforms run locally. Proxy listener, certificate state, HAR import, API send, rule execution, durable workspace persistence and device pairing **are not wired to a core**; UI labels and notices indicate this. Sample traffic is synthetic and never claimed to be captured data.

## Next integration boundary

Expose a Rust-side interface for `start_capture`, `stop_capture`, `set_proxy_endpoint`, `subscribe_flows`, `get_flow`, `import_har` and `send_request`. Back it with the selected proxy core after benchmarking. Keep React state shaped around domain events rather than a specific engine's objects.
