# AGENT.md

## Project Summary
Governor: Day Cycle is a single-player, browser-based RTS prototype with a map-centric day loop. You build and upgrade on the mission map, rally squads/heroes, then survive real-time combat waves to advance days. Progression is stronghold-gated and data-driven.

Current shell flow is:
- Main Menu -> World Map mission select -> Level run
- Optional dev Dashboard for level tuning/playtest (`DEV` or `?dev=1`)

## Tech Stack
- Vite + React + TypeScript
- Tailwind CSS for UI styling
- RTS simulation + renderer with switchable modes: legacy 2D and BabylonJS 3D (`src/config/rendering.ts`)
- Framer Motion + Lucide icons for HUD polish

## Run Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Night systems tests: `npm run test:night`

## Active App Flow (High-Level)
1. Main Menu (`src/ui/components/MainMenu.tsx`)
2. Missions (`src/ui/components/WorldMapMissionSelect.tsx`) with mission unlock progression
3. Level run (`src/ui/components/LevelRun.tsx`)
4. Build -> Battle Cry -> Combat -> Day End -> Perk choice / next day
5. Win/Lose -> return to World Map (or Dashboard when playtesting)

## Key Directories
- `src/ui` — app routing/scenes, mission map scene, HUD, canvas layers
  - `src/ui/screens/Dashboard` — level tuning dashboard, JSON/raw editor, diff/validation, playtest
  - `src/ui/store` — UI selection/panel/settings state for LevelRun
- `src/run` — run store/state, economy, goals, night planning/perks/modifiers, day-phase transitions
- `src/rts` — simulation, combat planning, spawn transforms, input, 2D/3D render paths
  - `src/rts/spawnResolver.ts` — border spawn transform resolver (`N`/`E`/`S`/`W`, spacing, padding, seed)
  - `src/rts/waveSpawns.ts` — wave spawn transform resolution + next-battle preview aggregation
- `src/config` — base game data (levels/buildings/units/heroes/elites/stronghold/night/rendering)
  - `src/config/levels.ts` merges base levels with tuning overrides; `getLevelById` also honors in-memory playtest overrides
- `src/game/rules` — progression rules used by runtime and dashboard (pad types, constraints, producer scaling)
- `src/game/types/LevelDefinition.ts` — canonical level schema, migration, validation
- `src/game/tuning` — dashboard tuning override store and import/export (`localStorage`)
- `src/game/runtime/playtest.ts` — in-memory playtest level override
- `src/storage/runSave.ts` — active run/meta save file
- `src/ui/worldProgression.ts` — world map mission progression save
- `src/ui/MetaHub.tsx`, `src/game/logic.ts`, `src/game/types.ts`, `src/storage/save.ts` — legacy meta path, currently not wired by `src/ui/App.tsx`

## Balance and Content
Tuning is data-driven. Prefer editing configs over hardcoding values in logic or UI.
- `src/config/buildings.ts` — costs, upgrades, income, bonuses, hero recruiter
- `src/config/units.ts` — squad stats and costs
- `src/config/levels.ts` + `src/game/types/LevelDefinition.ts` — waves, goals, map, progression, modifiers, validation
  - Wave spawn config supports border spawns via:
    - `spawnEdges` (`N`/`E`/`S`/`W`, optionally weighted)
    - `spawnPointsPerEdge` (number or `{ min, max }`)
    - `spawnPadding` (spawn offset outside playable bounds)
  - If omitted, runtime falls back to legacy single `enemySpawn`.
- `src/config/stronghold.ts` — unlocks, caps, pad gating, HQ scaling
- `src/config/heroes.ts` — summonable hero defs and stats
- `src/config/elites.ts` — mini-boss/boss tuning
- `src/config/nightContent.ts` — night modifiers, perks, enemy traits, elite config

## Persistence
- Run/meta save: `src/storage/runSave.ts` (`roguelike3d-daycycle-save-v1`)
- World map mission progression: `src/ui/worldProgression.ts` (`roguelike3d-world-map-progression-v1`)
- Dashboard tuning overrides: `src/game/tuning/tuningStore.ts` (`kingshot:tuningLevels:v1`)
- Main Menu -> Reset Save clears run/meta + world progression (not dashboard tuning overrides)

## Development Notes
- RTS visuals are drawn on canvas; avoid per-frame React rerenders.
- `RunState` is the source of truth for run gameplay.
- Run phases are `build`, `battle_cry`, `combat`, `day_end`, `win`, `lose`.
- Render mode toggles in `src/config/rendering.ts`; 3D path is in `src/rts/render3d.ts` and `src/rts/render/`.
- Keep build/combat/night systems data-driven and aligned with level/config tables.
- Day-phase preview is computed from combat wave data in `src/rts/combat.ts` (`nextBattlePreview`) and feeds both:
  - 3D border indicators ("Next Invasion") in `src/rts/render3d.ts`
  - HUD Intel panel in `src/ui/components/hud/NextBattleIntelPanel.tsx`
- Border invasion indicators must remain lightweight: thin instances/material reuse, non-pickable, toggled by phase/state changes.
- Input notes:
  - Arrow keys move the player hero (not camera panning)
  - `T` rallies friendly squads into deterministic slots around the hero
  - Key handling should respect `isGameplayKeyboardBlockedByFocus()` (`src/rts/input/focusGuard.ts`)
- Optional dev toggle for spawn-point debugging:
  - `localStorage.setItem('rts_debug_spawn_points', '1')`
