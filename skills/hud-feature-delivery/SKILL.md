---
name: hud-feature-delivery
description: Deliver HUD and overlay features for this RTS project with safe run-phase wiring, responsive behavior, and low-risk UI state changes. Use when adding or updating top bar cards, side panels, modals, intel displays, minimap controls, settings toggles, or toast UX.
---

# HUD Feature Delivery

## Overview

Use this skill to ship HUD/UI changes that stay aligned with gameplay phases and existing UI architecture.

## Delivery Workflow

1. Define the feature outcome in UI terms: what appears, when it appears, and who can interact with it.
2. Map data sources before coding:
   - Run gameplay state: `useRunStore` and derived values in `src/ui/components/LevelRun.tsx`
   - UI state: `src/ui/store/uiStore.ts`
   - Phase context: `runPhase` gating in `src/ui/components/LevelRun.tsx`
3. Implement presentational UI in focused components under `src/ui/components/hud/` or `src/ui/components/ui/`.
4. Keep orchestration and wiring in `src/ui/components/LevelRun.tsx`.
5. Preserve responsive and motion behavior:
   - Use `useMediaQuery` and existing mobile patterns.
   - Use `useMotionSettings` for animation duration fallbacks.
6. Validate phase transitions and interaction safety in manual gameplay checks.

## Primary Files

- Main HUD wiring and derived data: `src/ui/components/LevelRun.tsx`
- HUD components: `src/ui/components/hud/*.tsx`
- Shared UI primitives: `src/ui/components/ui/*.tsx`
- UI local store/actions: `src/ui/store/uiStore.ts`
- App-level scene routing when needed: `src/ui/App.tsx`
- Theme tokens and app visual language: `src/ui/styles.css`

Use `references/hud-delivery-playbook.md` for request-to-file mapping and QA checklists.

## Guardrails

- Keep HUD components mostly presentational; avoid embedding core game mutation logic in leaf components.
- Gate build-only actions behind `runPhase === 'build'` and keep combat/day-end restrictions explicit.
- Prefer extending `uiStore` for local UI state instead of overloading run gameplay state.
- Reuse existing primitives (`Button`, `Dialog`, `Badge`, `Tooltip`) unless a new primitive is justified.
- Avoid creating per-frame React work from simulation updates; keep heavy realtime rendering in canvas layers.

## Verification

Run:

```bash
npm run build
npm run test:night
```

Then manual checks:

1. Desktop and mobile layout paths.
2. Build -> battle_cry -> combat -> day_end transitions.
3. Modal open/close and focus loop behavior.
4. Reduced-motion setting impact on animations.
5. No blocked critical actions (battle cry, settings, panel toggle, intel).

## Output Contract

At completion, report:

1. Feature behavior added or changed.
2. Files touched and why each file was needed.
3. Phase/state gates applied.
4. Verification results and any known UX tradeoffs.

