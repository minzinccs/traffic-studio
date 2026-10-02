# Traffic Studio — desktop UI direction

## Product shape

Windows desktop app first. The current code is a **UI shell** and does not capture traffic yet. Tauri hosts a React/TypeScript frontend; the proxy engine is a separate decision after a runtime spike. No Flutter code or dependency is included.

## Visual language

- Mine Shaft gray workspace based on the user's `#2B2B2B` reference. Use nearby neutral grays for panel separation; keep amber as a restrained focus/accent color, mint for healthy/live status, red only for errors.
- Dense developer-tool information in active workspaces, generous spacing in empty states.
- Native window frame for the first version; app menu starts beneath the Windows title bar. Avoid copying Reqable's brand assets or exact layout measurements.
- Typography: Segoe UI for interface, JetBrains Mono when installed (Consolas fallback) for addresses, methods, shortcuts, IDs and timings. The shell works offline.
- Motion: 160–220 ms transitions for rail navigation, pane entry, tab content and selectable rows. View → Animations can disable them; icon transitions use the same timing.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#2b2b2b` | Main workspace |
| Surface | `#303030` | Panels |
| Raised surface | `#363636` | Menu, rail, toolbar, inputs |
| Border | `#464646` | Panel edges |
| Text | `#e9e9e9` | Primary content |
| Muted | `#aaaaaa` | Secondary content |
| Amber | `#dfa73d` | Focus and small accents |
| Mint | `#6ec78c` | Live/healthy status |

Base grid uses 4 px units. Menu height 44 px, navigation rail 58 px, capture toolbar 79 px, tab strip 33 px, status bar 29 px. Corners: 5–9 px for controls; 11 px for dialogs.

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

## Local appearance controls — 2026-09-26

Settings supports original dark and light palettes, accent color, compact/comfortable Traffic rows, 80–125% interface zoom and toolbar/status visibility. Dialogs cancel parent zoom to preserve usability; focus states and keyboard operation remain visible. Named layouts and Zen are browser-local preferences.

Personalization adds Studio/Ocean/Paper/Focus preset drafts, named style profiles, text size 12–16px, system monospace/Consolas, soft/square corners, contrast and navigation labels. All preferences apply locally and persist in browser storage.

2026-09-26 visual refinement: default accent #55b7c5, soft corners 3–4px for controls/cards/dialogs. Existing custom accents are preserved. Summary and response have separate content controls; header names/values form a readable two-column table. Semantic status colors remain distinct from interaction accent.

User correction: retain original yellow accent #dfa73d. This supersedes the cyan default refinement above; geometry remains 3–4px.
