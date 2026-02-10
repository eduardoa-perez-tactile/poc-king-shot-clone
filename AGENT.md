# AGENT.md

## Project Summary
Governor: Day Cycle is a single-player, browser-based RTS prototype. The core loop is a map-centric day cycle: build and upgrade on the mission map, rally squads and heroes, then survive real-time wave combat to advance the day. Stronghold progression gates pads/buildings and caps. Progress is saved locally via `localStorage`.

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS for UI styling
- Canvas RTS renderer with switchable modes: legacy 2D and BabylonJS 3D (`src/config/rendering.ts`)
- Framer Motion + Lucide icons for HUD polish

## Run Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## Key Directories
- `src/run` — RunState, economy, goals, day/phase loop, run store
- `src/rts` — real-time simulation, pathfinding, combat, input, 2D/3D rendering
- `src/ui` — React HUD, menus, LevelRun scene, canvas layers
- `src/config` — units, buildings, levels/waves, heroes, elites, stronghold, rendering
- `src/storage` — save/load with `localStorage`
- `src/game` — meta systems (town/hero/troops/quests) used by `src/ui/MetaHub.tsx` but not wired in `src/ui/App.tsx`

## Gameplay Loop (High-Level)
1. Main Menu -> Level Select -> Mission Map (single scene).
2. Build phase: click building pads to construct/upgrade, recruit squads, summon heroes, and upgrade the Stronghold.
3. Start combat with the Battle Cry button.
4. Combat phase: real-time wave defense with hero abilities (Q/E) and squad control.
5. Survive waves to complete the day and gain rewards.
6. Repeat until level goals are complete; elite waves/bosses gate some goals.

## Balance and Content
Tuning is data-driven. Prefer editing configs over hardcoding values in logic or UI.
- `src/config/buildings.ts` — costs, upgrades, income, bonuses, hero recruiter
- `src/config/units.ts` — squad stats and costs
- `src/config/levels.ts` — waves, goals, hero loadouts, map data
- `src/config/stronghold.ts` — unlocks, caps, pad gating, HQ scaling
- `src/config/heroes.ts` — summonable hero defs and stats
- `src/config/elites.ts` — mini-boss/boss tuning
- `src/config/rendering.ts` — 2D vs 3D render mode

## Persistence
- Auto-saves to `localStorage` in `src/storage/runSave.ts`
- Reset via Main Menu -> Reset Save

## Development Notes
- RTS visuals are drawn on canvas; avoid per-frame React rerenders.
- `RunState` is the shared source of truth for a run. Update it rather than duplicating state.
- Render mode is toggled in `src/config/rendering.ts`; 3D uses BabylonJS in `src/rts/render3d.ts` and `src/rts/render/`.
- Keep build/combat logic data-driven and aligned with config tables.
