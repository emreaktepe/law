# Final local acceptance: bulk, import, palette and performance

This extends `verification-workbench-local.md`. The earlier 78/91 counts and “context commands pending” text are historical checkpoints. The current source task owns the remaining tracking/release work and the authoritative 49-ticket status is `docs/tracking-status.md`.

## Applied and accepted locally

- **T2.13:** per-account recent-five IDs, normalized search, keyboard open and contextual Safahat / Görev / Duruşma commands are integrated in the actual demo shell. Real browser confirmed each command opens its corresponding tracking form, including `hearing` as the selected calendar kind. Only IDs/time are persisted for recent history; the current authorized rows determine visible results.
- **T2.14:** all selected matters validate before one aggregate write. Preview does not persist. Responsible candidates must be eligible in every selected matter; actor/time/reason and previous owner are audited. Archive rejects any open item and remains recoverable/read-only.
- **T2.15:** actual CSV and XLSX input, mapping, full-row validation, duplicate primary-number/authority check, preview, downloadable errors, explicit confirmation and one atomic local aggregate write. Imported client names are unlinked party names; sharing remains off. Reload preserves batch history. Undo requires the importing actor and unchanged SHA-256 fingerprints, then archives with audit and cancels the untouched initial work tasks; no permanent deletion.
- XLSX is lazy-loaded from pinned `read-excel-file@9.3.12`. [Maintainer documentation](https://github.com/catamphetamine/read-excel-file/blob/master/README.md). Package installation/clean CI reported zero vulnerabilities at verification time.
- Creator regression fixed: a wizard's first job exists as a task, without a duplicate manual next-action target. Completing the first task cannot resurrect the same work as the next step.

These are demo/local acceptance results. Live RLS/RPC/Storage/Realtime and remote batch transactions remain pending; local repositories do not grant server permissions.

## Browser evidence — isolated port 5196 / QA tab 4

Only synthetic fixtures were entered.

1. Two-row responsible preview → apply → reload succeeded.
2. Attempted archive of a selection containing an open task failed with the written blocker; no partial archive occurred.
3. A new no-work QA matter was archived, disappeared after reload under default active filtering, and opened under the Archive filter with “Arşiv · salt okunur”. A legacy manual target correctly blocked a separate archive attempt.
4. Ctrl+K showed recent authorized files. Safahat, task and hearing commands opened actual dialogs; hearing kind was selected.
5. Synthetic CSV → inferred mapping → preview → confirmation → commit succeeded. After reload, batch history remained; undo archived the batch and showed success.
6. Synthetic XLSX was parsed in the browser and displayed the correct title, number, court and readable type/stage. Commit succeeded.
7. Re-uploading the same XLSX after reload produced the duplicate row error; import was disabled. Undo of the unchanged original batch then succeeded.
8. 390×844 mobile import page: document width 375px, no page overflow. Browser error/warning log was empty. Temporary viewport was reset.

The first file chooser attempt stalled and failed because its browser backend node became stale during parallel development; no upload completed. A fresh separate QA tab and bounded chooser call resolved it. It is not a remaining blocker.

Screenshots: `screens/lawroom-import-preview-desktop.jpg`, `screens/lawroom-import-mobile.jpg`. Earlier list/Today/wizard screenshots remain alongside them.

## Checks

- Clean source snapshot `lawroom-clean-ci-import`: no environment file or existing node_modules copied; `npm ci`, **91 unit tests**, **8 local SQL/RLS tests** and build succeeded. Lock SHA-256 `781A5A601C8D64C65B6D2D3795CF8D8EF4A04C70DCFAC22274752BF60DC73698`, unchanged by clean install.
- A later full suite under concurrent Windows load exposed a list benchmark failure, reported by the source owner at 412ms. `prepareMatterRows` now normalizes once and calculates attention once per result set. `computeNextStep` reuses that batch result, including the explicit no-attention case. An equivalence/immutability regression was added; the **300ms threshold was retained**.
- After this correction, the actual main source suite passed **105/105**, 0 failed. 500 matters / 10,000 fixture events: median **135.6ms**. This is local indexing/filtering/sorting time, not HTTP latency or a full browser render.
- Production build after correction: **1722 modules, 1.28s**, success, including the lazy XLSX browser chunk.
- No SQL changed in this task after the successful eight-test SQL run. The source owner is performing its final release checks separately; do not extrapolate this report to later changes.

## Scope and unresolved boundaries

- No live database write, credential change, CLI authentication change or publication was performed by this delegated task.
- LawRoom access is already verified with explicit account selection; remaining baseline work is CLI/schema/history reconciliation, not an assumption that the project is still inaccessible globally.
- `docs/multi-project-supabase.md` contains the verified account/ref mapping. Correct LawRoom ref is `deezwydtiibbdtimxcxf`, organization `tvggccajnkjplhalnmhj`; DietApp is `qxpgnhuwqamvybobmfjx`, organization `xnhsnksgusjbnhghqonb`.
- Source owner is finalizing its tracking/49-ticket status and may publish only under its own authorized scope. This task's local work is complete; live-dependent tickets are not marked completed here.
