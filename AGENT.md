# AGENT.md

## Project Summary
Governor: Day Cycle is a single-player, browser-based RTS prototype. The core loop is a map-centric "day cycle": build/upgrade on the same map, rally squads, then survive real-time wave combat to advance the day. Progress is saved locally via `localStorage`.

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS for UI styling
- Canvas-based RTS rendering (`src/rts`)

## Run Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## Key Directories
- `src/run` — RunState, economy, goals, day/phase loop
- `src/rts` — real-time simulation, pathfinding, combat, canvas render
- `src/ui` — React HUD and menus
- `src/config` — units, buildings, levels/waves
- `src/storage` — save/load with `localStorage`
- `src/game` — game wiring and orchestration

## Gameplay Loop (High-Level)
1. Main Menu -> Level Select -> Mission Map (single scene)
2. Build phase: click building pads to construct/upgrade/recruit
3. Combat phase: real-time wave defense
4. Survive waves to complete the day and gain rewards
5. Repeat until level goals are complete

## Balance and Content
Tuning is data-driven:
- `src/config/buildings.ts`
- `src/config/units.ts`
- `src/config/levels.ts`

Prefer editing configs over hardcoding values in logic or UI.

## Persistence
- Auto-saves to `localStorage`
- Reset via Main Menu -> Reset Save

## Development Notes
- RTS visuals are drawn on canvas; avoid per-frame React rerenders.
- RunState is the shared source of truth for a run. Update it rather than duplicating state.
- Keep build/combat logic data-driven and aligned with config tables.
