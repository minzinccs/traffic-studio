# Traffic Studio — rules for coding agents

These instructions apply to the repository at `H:\Zstudio\tech stuff\coding helper\traffic-studio`.

## Product and scope

- Build a **Windows PC app first**. Android/iOS companions come later.
- Stack: **Tauri 2 (Rust shell) + React/TypeScript/Vite**. Do not introduce Flutter or Dart into the PC app.
- Target all Reqable Community + Premium capabilities listed in `FEATURE_INVENTORY.md`, excluding Enterprise-only features. Add the requested tracker, analytics and multi-pane views. The present implementation is only a UI shell.
- Keep the visual design original. Use the reference screenshot for information hierarchy, not Reqable's logo, assets, exact styling or source code.
- Work locally in this directory. **Do not push to Git or publish** unless the user explicitly requests it.

## Sources of truth

1. `DESIGN_DECISION.md`: current stack and core-selection gate.
2. `DESIGN_SYSTEM.md`: colors, spacing, layout and interaction language.
3. `FEATURE_INVENTORY.md`: feature-parity checklist.
4. `STRUCTURE.md`: current code map and intended module boundaries.
5. `CORE_REUSE.md`: research only; runtime choice is still open.
6. `INTERACTION_PLAN.md`: interaction behavior, persistence model, phases and acceptance gates.
7. `NEXT_STEPS.md`: ordered implementation backlog and immediate handoff task.
8. `APP_IMPLEMENTATION_PLAN.md`, `APP_ROUTE_MAP.md`, `APP_TRACKER.json` and generated `APP_TASKS.md`: full app phases/routes/modules/dependencies/acceptance. Edit tracker JSON and run `node scripts/check-plan.mjs --render`; never mark mock/runtime work done without evidence.

If documents disagree, prefer the most recent direct user instruction, then `DESIGN_DECISION.md`. Update stale documents when changing a decision.

## Implementation rules

- Put new product features in their own `src/features/<feature>/` directory. Export a small public entry point (`index.ts`), types, components and styles there. Keep `src/App.tsx` for shell composition and routing/tab state; avoid adding a whole feature to that file.
- Current views in `src/views/` are UI previews. Do not treat demo flows, capture state, certificate status, API sending, rules, HAR import or LAN transfer as working backend behavior.
- Keep UI state honest: actions without a backend should be visibly disabled or identified as previews. Never show synthetic traffic as real capture.
- Shared domain types belong in `src/domain/`; sample fixtures belong in `src/data/`. Do not let the future proxy engine's raw objects leak into React components; use adapter/domain types.
- Put Rust commands/events in `src-tauri/` behind a typed frontend bridge (create `src/bridge/` when integration begins). Capture, API and storage modules should depend on that bridge, not call global Tauri APIs throughout the UI.
- The app is local-first. Do not add cloud login, telemetry, remote storage or LAN listening as a default. Any proxy listener exposed beyond localhost must have explicit authentication and clear UI state.
- Preserve keyboard and mouse operation. Add accessible names/tooltips to icon-only buttons and visible focus states.
- Avoid unrelated dependency churn. Any new dependency needs a concrete feature reason and compatible license.

## Collaboration boundaries

Several agents may work on this repo. Assign ownership by directory: `src/features/capture`, `src/features/api`, `src/features/rules`, `src/features/tracker`, `src/features/analytics`, `src/bridge`, `src-tauri`. Coordinate before editing shared `src/App.tsx`, `src/styles.css`, `package.json` or shared domain types. Review current changes before overwriting files.

## Verification

- Run `npm run build` after TypeScript/UI changes. Use `npm run dev` or `npm run preview` for visual review.
- For a new interaction, verify the visible result and the empty/error states. Do not write tests that only mirror markup.
- Native debug build was verified on 2026-09-27 (WORKLOG 22): Rust/Cargo 1.98.1 at configured CARGO_HOME, VS2022 MSVC/Windows SDK and WebView2 present; Cargo build succeeded. Native interaction acceptance and release installer remain unverified. Use scripts/dev-native.ps1 for local dev; do not claim complete native feature behavior from compilation/startup alone.
- Record what is implemented, what is simulated, and what remains untested in the final handoff.
