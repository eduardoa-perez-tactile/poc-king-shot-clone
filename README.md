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

## Controls (RTS)

- Left click selects units (drag to box select).
- Right click issues move/attack commands.
- `A` attack-move, `S` stop.
- `Ctrl+1/2/3` assign control groups, `1/2/3` recall.
- Mouse wheel zoom, arrow keys pan camera.

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
