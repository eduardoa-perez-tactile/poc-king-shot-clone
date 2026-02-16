# Governor: Day Cycle (Single Player)

A playable single-player, browser-based RTS prototype built around a **Day Cycle** loop: build and upgrade inside the level, rally your squads, and survive real-time waves to advance each day. Everything runs locally with `localStorage` persistence.

## How To Run

1. Install dependencies.
2. Start the dev server.

```bash
npm install
npm run dev
```

## How To Play

1. Start a run from **Main Menu → Level Select**.
2. In Build Mode, click open **building pads** to place your first economy and unit buildings.
3. Recruit squads from completed buildings and position them near likely attack lanes.
4. Press **Battle Cry** to begin the combat wave sequence for the current day.
5. During combat, use RTS controls to move, focus targets, and protect key structures.
6. After surviving the day, return to Build Mode, spend gold on upgrades/recruits, then rally again.
7. Complete the level goals (target day, boss, and/or gold objective) to win and unlock progression.

### Beginner Priorities

- Get early income online first, then expand unit production.
- Keep squads grouped and use control groups for faster commands.
- Spend between waves; unused gold slows your scaling.
- Check the **Goals** panel each day so upgrades match win conditions.

## Map-Centric Day Cycle Loop

1. Main Menu → Level Select → Mission Map Scene (single scene).
2. Control the hero in real time and click building pads to construct or upgrade.
3. Press **Battle Cry** to start real-time wave combat.
4. Survive all waves to complete the day and collect rewards.
5. Enter Build Mode on the same map, spend gold, then rally again.
6. Complete all level goals to win and unlock the next level.

## Main Systems

- **RunState**: A single shared state for the level run (day, gold, buildings, squads, goals).
- **Build Phase**: Click map pads to build/upgrade, recruit squads, and prepare.
- **Combat Phase**: Real-time wave defense on the same map scene.
- **Goals**: Survive a target day, defeat bosses, and/or earn gold.
- **Elite Waves**: Mini bosses spawn after Wave 2 by default; each level’s final wave includes a boss.
- **Hero Recruiter**: Unlock at Stronghold Lv3 to summon one hero (Mage, Rock Golem, or Dragon) per building.
- **Unit Purchase Caps**: Each unit-producing building can sell up to `4 * Stronghold Level` squads per day.

## Controls (RTS)

- Left click selects units (drag to box select).
- Right click issues move/attack commands.
- `A` attack-move, `S` stop.
- `Q`/`E` hero abilities.
- `T` rally friendly squads to the hero.
- `Ctrl+1/2/3` assign control groups, `1/2/3` recall.
- `Arrow` keys move the hero (not camera pan).
- Mouse wheel zoom, middle mouse click resets zoom to default.

## Controllers (Input Devices)

- Supported: keyboard + mouse (desktop browser).
- Not currently supported: gamepad/console controllers.
- Gameplay hotkeys are ignored while typing in text inputs (input/textarea/select/contenteditable).

## Map Build Notes

- All construction and upgrades happen directly on the mission map.
- Buildings can only be placed on predefined **building pads**.
- Click empty pads to build, click existing buildings to upgrade or recruit.
- Toggle unit identifiers in **Settings** to show labels above squads and heroes.

## Levels

- **Level 1**: Survive until Day 3 and earn 120 total gold.
- **Level 2**: Survive until Day 4 and defeat the Day 4 boss wave.
- **Level 3**: Survive until Day 5 and build a war chest.

## Project Structure

- `src/run` — RunState, economy, goals, and loop logic
- `src/rts` — Real-time simulation, pathfinding, rendering, combat
- `src/ui` — React UI screens and overlays
- `src/config` — Levels, buildings, units, waves
- `src/storage` — Save/load (`localStorage`)

## Balance Tweaks

All tuning lives in:

- `src/config/buildings.ts` — building costs, upgrades, and income
- `src/config/units.ts` — squad costs and stats
- `src/config/levels.ts` — day plans, wave compositions, and goals

## Save/Load

Progress saves automatically to `localStorage`. Use Main Menu → Reset Save to clear the save.
