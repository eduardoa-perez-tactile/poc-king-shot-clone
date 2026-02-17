# Dashboard Ops Playbook

Use this playbook to keep dashboard changes focused and safe.

## Request-to-File Matrix

| Request pattern | Primary files | Secondary checks |
| --- | --- | --- |
| Add/update a dashboard tab or editor control | `src/ui/screens/Dashboard/Dashboard.tsx` | `src/ui/styles.css` |
| Add new stateful editor action (patch/reset/selection behavior) | `src/ui/screens/Dashboard/dashboardEditorStore.ts` | `src/ui/screens/Dashboard/Dashboard.tsx` |
| Change validation and issue reporting surface | `src/ui/screens/Dashboard/Dashboard.tsx` | `src/game/types/LevelDefinition.ts` |
| Change import/export/save/revert behavior | `src/ui/screens/Dashboard/dashboardEditorStore.ts` | `src/game/tuning/tuningStore.ts` |
| Change preview controls or rendering | `src/ui/screens/Dashboard/LevelPreviewModal.tsx`, `src/ui/screens/Dashboard/createLevelPreviewScene.ts` | `src/ui/screens/Dashboard/dashboardEditorStore.ts` preview revision marks |
| Change playtest flow from dashboard | `src/ui/screens/Dashboard/Dashboard.tsx`, `src/ui/App.tsx` | `src/game/runtime/playtest.ts`, `src/config/levels.ts` |

## Editor State Invariants

1. `levelsById` is the mutable draft source.
2. `baseLevelsById` is the baseline for diff and revert semantics.
3. `historyById` tracks undo/redo windows per selected level.
4. `draftRevisionById` increments on meaningful draft edits.
5. `lastPreviewRevisionById` marks preview freshness against draft revision.

Preserve these invariants when adding new mutating operations.

## Persistence Rules

1. Save operations flow through:
   - dashboard editor overrides extraction
   - `replaceTuningOverrides`
   - `saveTuningOverrides`
2. Import operations must validate each incoming level before accepting it.
3. Reject invalid payload entries with explicit reasons.
4. Keep export shape compatible with:
   - `{ version, savedAt, overrides }`

## Playtest Safety Rules

1. Normal playtest should require `validateLevelDefinition(...).isValid === true`.
2. Force playtest remains an explicit fallback path.
3. Route playtest level through `setPlaytestLevel` and run source handling in `src/ui/App.tsx`.
4. Preserve return path to Dashboard after dashboard-sourced playtests.

## Common Regressions

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Undo/redo stops working | History not updated for a new mutation path | Ensure mutations use tracked update helpers |
| Diff panel incorrect | Base/draft map drift | Re-check cloning and id remap behavior |
| Save works but runtime ignores edits | Overrides not written or level id mismatch | Verify override map keys and `getLevelById` resolution |
| Preview says up-to-date when stale | Revision marker not updated | Update `draftRevisionById` and preview mark flow |
| Playtest opens wrong scene/return path | App run source not maintained | Preserve `runSource` + playtest return logic |

## Minimum QA Pass

1. `npm run build`
2. `npm run test:night`
3. Manual dashboard pass:
   - edit value
   - validate/diff refresh
   - undo/redo
   - save/export/import
   - preview regenerate + status
   - playtest and return
