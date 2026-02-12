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
  - `src/rts/spawnResolver.ts` — border spawn transform resolver (N/E/S/W edges, spacing, padding, seed)
  - `src/rts/waveSpawns.ts` — wave spawn transform resolution + next-battle preview aggregation
- `src/ui` — React HUD, menus, LevelRun scene, canvas layers
  - `src/ui/components/hud/NextBattleIntelPanel.tsx` — day-phase intel modal for distinct upcoming enemy types
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
  - Wave spawn config supports border spawns with:
    - `spawnEdges` (`N`/`E`/`S`/`W`, optionally weighted)
    - `spawnPointsPerEdge` (number or `{ min, max }`)
    - `spawnPadding` (spawn offset outside playable bounds)
  - If border config is omitted, runtime falls back to legacy single `enemySpawn`.
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
- Day-phase preview is computed from combat wave data in `src/rts/combat.ts` (`nextBattlePreview`) and feeds both:
  - 3D border indicators ("Next Invasion") in `src/rts/render3d.ts`
  - HUD Intel panel in `src/ui/components/hud/NextBattleIntelPanel.tsx`
- Border invasion indicators must remain lightweight: thin instances/material reuse, non-pickable, toggled by phase/state changes.
- Optional dev toggle for spawn debugging:
  - `localStorage.setItem('rts_debug_spawn_points', '1')`
