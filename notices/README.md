# notices/ — release third-party notices and SBOM (DRAFT)

Generated 2026-09-30 for TODO-F (P10-07). New files only; no dependency or tracker changes.

## Scope (release-bundled subset)

- `sbom.cdx.json` — CycloneDX 1.5 SBOM: 32 npm production packages + 513 Cargo crates.
- `NOTICES.md` — human-readable attribution table with per-item evidence source.
- `licenses/` — verbatim full texts, one per distinct SPDX identifier.

## Excluded as dev-only (not shipped in the release exe)

- npm devDependencies and transitive dev-only packages (Vite, TypeScript, Tauri CLI, ...).
- `.runtime/whistle` + deps (incl. sockx@0.2.3 MIT, streamsearch@0.1.2 MIT, weinre2@1.3.6 Apache-2.0
  per registry.npmjs.org metadata) — local engine candidate, never bundled.
- `.runtime/mitmproxy` site-packages incl. mitmproxy_rs@0.12.11 (upstream repo license MIT per
  api.github.com/repos/mitmproxy/mitmproxy_rs; PyPI metadata carries no license field) — same reason.

## Method

- npm prod closure: `npm ls --omit=dev --all` (32 packages); licenses read from installed package.json.
- Cargo: versions from `src-tauri/Cargo.lock`; licenses from crates.io version API (one-off fetch
  2026-09-30, cached outside the repo), cross-checked against the local-registry manifests recorded
  in the committed THIRD_PARTY_INVENTORY.json.
- The inventory script was NOT changed: its gap is environmental (registry cache at H:\\.cargo is
  absent in this shell; 163 lock members were never downloaded because they are non-Windows /
  lock-only platform deps), not a mapping bug fixable without network access.

## Remaining human decisions

- none: every release-bundled item has a license identifier with evidence.

- Confirm the app's own release license (SBOM metadata currently says TBD-release-license).
- Re-run on the dev machine with H:\\.cargo + .runtime present to refresh THIRD_PARTY_INVENTORY.json
  before packaging; this draft does not replace that step.

## License texts (licenses/)

Verbatim texts fetched 2026-09-30 from
https://raw.githubusercontent.com/spdx/license-list-data/main/text/{ID}.txt
(one file per atomic SPDX identifier appearing in the release subset expressions).
Compound expressions (OR/AND/WITH) are satisfied by the member texts present here.

No TODOs: all 15 texts fetched verbatim.
