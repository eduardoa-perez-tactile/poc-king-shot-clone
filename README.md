# Governor: RTS Chronicle (Single Player)

A playable single-player RTS prototype inspired by “Kingshot”-style gameplay. Rebuild a town, manage resources, recruit heroes, train troops, and fight **real-time missions** on a top-down map. Everything runs locally with `localStorage` persistence.

## How To Run

1. Install dependencies.
2. Start the dev server.

```bash
npm install
npm run dev
```

## Game Cycle

1. Main Menu → Mission Select → Real-time Mission → End Screen.
2. Mission wins grant rewards and unlock new missions.
3. Settlement screens remain for building, heroes, troops, and quests.

## Main Systems

- **Town**: Build and upgrade structures, collect passive resources.
- **Heroes**: Summon, level up, and equip gear.
- **Troops**: Train infantry/archer/cavalry and manage capacity.
- **Quests & Events**: Daily + chapter quests and a timed event.
- **Missions (RTS)**: Real-time combat with hero abilities and AI waves.

## Controls (RTS)

- Left click selects units (drag to box select).
- Right click issues move/attack commands.
- `A` attack-move, `S` stop.
- `Ctrl+1/2/3` assign control groups, `1/2/3` recall.
- Mouse wheel zoom, arrow keys pan camera.

## RTS Notes

- Units are represented as **squad entities** (each entity = multiple troops).
- Right-click on enemy issues **attack**; right-click on ground issues **move**.
- Hero abilities are activated from the right panel, then **right-click** to place.

## Missions

- **Mission 1**: Survive 3 minutes (tutorial skirmish).
- **Mission 2**: Destroy enemy HQ (moderate defenses).
- **Mission 3**: Survive 6 minutes (escalating waves).

## Project Structure

- `src/game` — Meta economy, buildings, heroes, troops, quests, save state
- `src/rts` — Real-time simulation, pathfinding, rendering, missions
- `src/ui` — React UI screens and components
- `src/config` — Balance tables and definitions
- `src/storage` — Save/load (`localStorage`)

## Balance Tweaks

All tuning lives in `src/config/balance.ts` and `src/rts/missions.ts`:

- Building costs, production, and upgrade times
- Troop costs and training times
- Hero/gear definitions
- Quest templates and event milestones
- Enemy stats and reward tables
- Mission objectives, rewards, and wave schedules

## Save/Load

Game state saves automatically to `localStorage`. Use Settings → Reset Game to clear the save.
