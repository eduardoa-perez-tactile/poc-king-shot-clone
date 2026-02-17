# HUD Delivery Playbook

Use this playbook to pick the smallest safe change set for HUD work.

## Request-to-File Matrix

| Request pattern | Primary files | Secondary checks |
| --- | --- | --- |
| Add top bar metric/button | `src/ui/components/hud/TopBar.tsx`, `src/ui/components/LevelRun.tsx` | `src/ui/components/hud/ResourcePill.tsx` |
| Add or adjust side panel content | `src/ui/components/hud/Panel.tsx`, `src/ui/components/LevelRun.tsx` | `src/ui/store/uiStore.ts` |
| Add/update modal flow (setup, summary, settings) | `src/ui/components/hud/*Modal.tsx`, `src/ui/components/LevelRun.tsx` | `src/ui/components/ui/Dialog.tsx` |
| Add new HUD toggle/setting | `src/ui/store/uiStore.ts`, `src/ui/components/hud/SettingsDialog.tsx` | `src/ui/hooks/useMotionSettings.ts` |
| Add alert/feedback toast | `src/ui/store/uiStore.ts`, `src/ui/components/hud/Toasts.tsx` | `src/ui/components/LevelRun.tsx` |
| Update intel/minimap overlays | `src/ui/components/hud/NextBattleIntelPanel.tsx`, `src/ui/components/hud/MiniMap.tsx`, `src/ui/components/LevelRun.tsx` | `src/rts/combat.ts` preview wiring |

## Design and Architecture Rules

1. Derive gameplay-facing view data in `LevelRun` with `useMemo`.
2. Pass compact props to HUD components; keep them display-focused.
3. Keep one-directional flow:
   - Store/action -> `LevelRun` orchestration -> presentational component.
4. Extend existing UI primitives before creating new base components.

## State Safety Checklist

1. New UI state belongs in `uiStore` only if it is local/presentation state.
2. Gameplay mutations should continue to go through run store actions.
3. Feature visibility rules must explicitly respect `runPhase`.
4. Keyboard/focus behavior should remain usable when dialogs are open.

## Motion and Responsive Checklist

1. Motion should respect `useMotionSettings`.
2. Mobile behavior should be checked with existing breakpoint logic (`useMediaQuery`).
3. Avoid hover-only controls for key actions that must work on touch.

## Common Regressions

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Action button appears but does nothing | Missing LevelRun wiring | Add handler and pass callback prop |
| Action works in wrong phase | Missing phase gate | Add explicit `runPhase` checks and disabled states |
| Modal traps users or fails to close | Incorrect dialog state wiring | Use existing `Dialog` open/onOpenChange patterns |
| Janky transitions | Motion setting ignored | Route animation timing through `useMotionSettings` |
| HUD update causes frame drops | Heavy derived computation each render | Memoize derived values and keep canvas-heavy work outside React |

## Minimum QA Pass

1. `npm run build`
2. `npm run test:night`
3. Manual run:
   - Open the changed HUD path in build and combat phases
   - Toggle settings and reopen changed surfaces
   - Check mobile-width layout behavior
   - Validate no blocked core loop actions
