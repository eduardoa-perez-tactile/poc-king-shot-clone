# Spawn Debug Checklist

Use this checklist to pinpoint where spawn behavior diverges from expectation.

## 1) Config Validity

Check in `src/config/levels.ts` and schema rules in `src/game/types/LevelDefinition.ts`:

- `spawnEdges` only uses `N | E | S | W`.
- `spawnEdges[].weight` is `> 0` when set.
- `spawnPointsPerEdge` is either:
  - number `>= 1`, or
  - `{ min, max }` with `min >= 1` and `max >= min`.
- `spawnPadding` is non-negative.

If `spawnEdges` is missing, the system should still work via legacy `enemySpawn`.

## 2) Resolver Behavior

Inspect `src/rts/spawnResolver.ts`:

- Edge normalization dedupes invalid/duplicate edges.
- Count logic applies weight and clamps to at least one point.
- Point placement applies jitter and min-distance fallback scan.
- Forward vectors per edge are correct:
  - `N -> (0, 1)`
  - `E -> (-1, 0)`
  - `S -> (0, -1)`
  - `W -> (1, 0)`

## 3) Wave Integration

Inspect `src/rts/waveSpawns.ts`:

- `resolveWaveSpawnTransforms` uses border config when present.
- Otherwise it falls back to legacy `enemySpawn`.
- `buildNextBattlePreview` deduplicates transforms and builds `previewEdges`.

## 4) Combat Wiring

Inspect `src/rts/combat.ts`:

- Spawn seed format remains stable: ``${run.runSeed}:spawns:${run.dayNumber}``.
- `resolveCombatWaveSpawns` result is used for combat waves.
- `nextBattlePreview` is built from resolved waves.

## 5) Consumer Consistency

Inspect `src/rts/render3d.ts` and `src/ui/components/hud/NextBattleIntelPanel.tsx`:

- 3D markers read `preview.previewSpawnTransforms` first, then edge-center fallback.
- Markers hide outside build phase unless `rts_debug_spawn_points=1`.
- HUD wave cards list `spawnEdges` from preview waves with same edge labels.

## 6) Common Failure Modes

| Symptom | Likely layer | Typical fix |
| --- | --- | --- |
| All waves spawn from one side unexpectedly | Config | Add or correct `spawnEdges` per wave |
| Too many spawn points on one edge | Resolver | Revisit `weight` and `spawnPointsPerEdge` interaction |
| HUD says North/East but 3D markers look wrong | Consumer/preview | Verify `previewSpawnTransforms` and forward vectors |
| Markers not visible during combat while debugging | Render toggle | Set `localStorage.rts_debug_spawn_points = '1'` |
| No border behavior despite config | Integration | Confirm wave fields survive migration and reach `resolveWaveSpawnTransforms` |

## 7) Minimum Verification

1. `npm run build`
2. `npm run test:night`
3. Manual run in dev:
   - confirm next battle intel borders
   - confirm 3D indicator positions
   - confirm expected fallback behavior when border config is removed
