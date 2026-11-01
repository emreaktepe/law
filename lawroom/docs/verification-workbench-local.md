# Local workbench verification — 2026-11-01/02

Scope: actual application at `D:\projeler\LawPortal\portal\lawroom`. These changes remain local and were not published by this task. The source task owns the new tracking/cockpit work; its later changes require their own final browser pass.

## Applied and verified

- Exact hosted project guard is integrated in `src/lib/supabase.js`, using `src/domain/project-identity.js`. Only `deezwydtiibbdtimxcxf` can initialize the live LawRoom browser client. DietApp, efoks, host lookalikes, URL userinfo/query/path/fragment, secret/service_role and legacy anon JWTs naming another project fail closed. Existing generic connection helpers/tests remain. Generic local Supabase URL recognition does not bypass this live application guard.
- T2.2 catalogs/number normalization and T2.12 nine-tier attention domain are implemented and unit tested. Catalogs retain an unverified flag and a versioned per-matter snapshot.
- T2.4 lawyer list is integrated: columns, normalized number/party search with match reason, intersecting filters, grouping, sorting, comfortable/compact density, 50-row pagination, number copy, selection and keyboard navigation. Bulk mutation buttons are not implemented by this task.
- T2.5 demo saved views: owner/role namespace, pin/default, reload, complete URL filter state, recoverable deletion and persistent trash restoration. This is the local demo repository, not a deployed Supabase saved-view table.
- T2.12 Today screen is integrated with one highest-priority written reason per matter. Task completion writes the demo aggregate with actor/time/audit before updating UI; failure remains an error. Closed/archive mutation is rejected by the domain transition.
- T2.13 core command palette is integrated: Ctrl/Cmd+K, arrow/Enter selection, Escape/modal focus, normalized number and text search, open matter, Today/calendar/new-matter commands. Recent-five and contextual proceeding/task/hearing actions remain open for the tracking owner.
- T2.3 five-step demo wizard is integrated: type/subtype; title/optional number/authority; accepted-client/no-client/name-only party; initial stage/optional first work target; review/create. It stores normalized primary number, immutable template snapshot/version, initial stage history/audit, private first task and no legal deadline. Entering a party name never links a portal account. The accepted-client selector requires an explicitly accepted record; the current demo provides no accepted-client directory. `lr_create_matter` deployment/RLS/HTTP E2E is still pending.

## Tests and build

- Main application unit suite after wizard: **78 passed, 0 failed**. This includes 16 concurrently added tracking tests owned by the source task; the local workbench portion is 62 tests. Earlier stable boundaries: 55 after list/guard, 58 after Today/task transition.
- Main application SQL/RLS suite: **8 passed, 0 failed** at the guard/list boundary. No SQL migration was changed by this task afterward.
- Production build after wizard: Vite 8.3.5, **1649 modules, 1.47s**, success. No publish or deployment performed.
- 500 matters / 10,000 fixture events: index/filter/sort pipeline median **124.0ms** in the last combined run, threshold 300ms. This measures the local algorithm, not server round-trip or full browser render latency.

## Real browser evidence

Only synthetic/demo data were used, on isolated localhost ports 5195 and 5196.

1. Search `2026 184` found `2026/184 E.` with a number-match reason in the synthetic 500-matter harness and actual application.
2. Type + responsible-lawyer intersection returned 83 records; client grouping and page 2 of 2 rendered the remaining 33 rows.
3. Compact density, saved/pinned/default view, reset and reload restored the search. View removal + reload retained recoverable trash; restore succeeded without silently taking over the default.
4. J focus, X selection and Enter matter opening worked. Ctrl+K number search opened the main application's matter; calendar command opened the real calendar screen.
5. At 390×844, document width was 375px (no page overflow); list changed to cards. Existing mobile nav remains horizontally scrollable within its own container.
6. Wizard missing type was rejected. A synthetic `QA · Müvekkilsiz takip` was created with `2026 / 00184 E.`, no client, one private task and a work target. It opened the actual cockpit and survived reload. Browser date input required keyboard interaction to commit its date; the review step was checked before submitting.
7. The new delayed task appeared in Today tier 5 with its written reason. Completing it removed the card; removal persisted after reload.
8. Switching to client hid the new private QA matter, new-matter action and command palette.

Screenshots copied to `docs/screens/`: `lawroom-matters-integrated-desktop.jpg`, `matter-list-mobile.jpg`, `lawroom-today-desktop.jpg`, `lawroom-create-mobile.jpg`.

## Access verification and remaining boundaries

Read-only Supabase metadata now succeeds with explicit per-call account selection:

| Application | Connected account | Project | Expected/actual ref |
|---|---|---|---|
| LawRoom | aktepe25(law/aday) | lawportal | deezwydtiibbdtimxcxf |
| DietApp original | bilgiedu(efoks/dietapp) | diet | qxpgnhuwqamvybobmfjx |

LawRoom has 15 `lr_` tables with RLS enabled, and the migration-history response was empty. Six legacy public tables still had RLS disabled; no live schema/data changes were made. DietApp public Auth settings returned HTTP 200 using its existing public client configuration. No customer records were read, no keys created, no CLI login changed. Earlier access-denied and QA-only-guard notes are historical and superseded by this verification.

Still open: reliable remote schema baseline/history, Migration 002 and live atomic RPC/RLS/HTTP E2E; contextual command actions/recent files; bulk operations and CSV/XLSX import; remaining tracking/UI acceptance; real Auth/Storage/Realtime checks; new LawRoom domain and Resend delivery; provider/licensing and lawyer verification of legal rules/templates. Do not mark all 49 tickets complete from this report.
