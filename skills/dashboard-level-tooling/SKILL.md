---
name: dashboard-level-tooling
description: Extend and maintain the dev level-tuning Dashboard for this project, including tab UX, editor state flows, validation/diff surfaces, import/export overrides, preview generation, and playtest handoff. Use when changing dashboard-level tools rather than in-run HUD or simulation code.
---

# Dashboard Level Tooling

## Overview

Use this skill to implement Dashboard features safely across editor state, validation, persistence, preview, and playtest flow.

## Workflow

1. Define the editor outcome in concrete terms:
   - Which tab or control changes.
   - Which `LevelDefinition` fields are affected.
   - Whether the change affects save/import/export/playtest.
2. Update dashboard presentation in `src/ui/screens/Dashboard/Dashboard.tsx`.
3. Update editor state and actions in `src/ui/screens/Dashboard/dashboardEditorStore.ts` when behavior changes.
4. Keep level data valid with `migrateLevelDefinition` and `validateLevelDefinition`.
5. Confirm persistence and playtest paths still behave correctly.
6. Verify with build/tests and a manual dashboard pass.

## Primary Files

- Dashboard UI, tabs, actions, raw JSON panel:
  - `src/ui/screens/Dashboard/Dashboard.tsx`
- Dashboard editor state, undo/redo, import/export/save/revert:
  - `src/ui/screens/Dashboard/dashboardEditorStore.ts`
- Preview modal and Babylon scene:
  - `src/ui/screens/Dashboard/LevelPreviewModal.tsx`
  - `src/ui/screens/Dashboard/createLevelPreviewScene.ts`
- Tuning persistence store:
  - `src/game/tuning/tuningStore.ts`
- Runtime level resolution with overrides/playtest:
  - `src/config/levels.ts`
- App routing and playtest handoff:
  - `src/ui/App.tsx`
- Dashboard styling:
  - `src/ui/styles.css`

Use `references/dashboard-ops-playbook.md` to map requests to files quickly.

## Core Model Guardrails

- Treat `baseLevelsById` as immutable baseline and `levelsById` as editable draft state.
- Preserve undo/redo history behavior for selected level edits.
- Keep preview freshness tracking coherent (`draftRevisionById` vs `lastPreviewRevisionById`).
- Keep override persistence compatible with `kingshot:tuningLevels:v1`.
- Do not bypass validation pathways when writing imported or raw JSON data.
- Keep playtest entry gated by validation unless user explicitly chooses force playtest.

## Useful Checks

```bash
rg -n "activeTab|patchSelectedLevel|saveDashboardOverrides|importDashboardOverridesJson|onPlaytest" src/ui/screens/Dashboard/Dashboard.tsx src/ui/screens/Dashboard/dashboardEditorStore.ts
rg -n "getLevelById|getLevels|getTuningOverrideById|getPlaytestLevel" src/config/levels.ts src/ui/App.tsx
rg -n "dashboard-|level-preview-" src/ui/styles.css
```

## Verification

Run:

```bash
npm run build
npm run test:night
```

Manual dashboard checks:

1. Edit a level field and confirm validation/diff updates.
2. Undo and redo changes.
3. Save overrides and reload flow consistency.
4. Export then import overrides JSON.
5. Open preview modal and confirm revision/up-to-date behavior.
6. Run normal playtest and force playtest paths.

## Output Contract

At completion, report:

1. Dashboard capability added or changed.
2. State/persistence/playtest paths touched.
3. Validation and safety constraints preserved.
4. Verification results and any remaining caveats.

