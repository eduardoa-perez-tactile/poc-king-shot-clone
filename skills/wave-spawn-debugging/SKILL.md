---
name: wave-spawn-debugging
description: Diagnose and fix enemy border spawn issues and invasion preview mismatches for this RTS project. Use when spawnEdges, spawnPointsPerEdge, spawnPadding, spawn transforms, Next Battle intel, or 3D invasion markers are wrong or inconsistent.
---

# Wave Spawn Debugging

## Overview

Use this skill to trace spawn behavior end-to-end and apply the smallest safe fix.

## Debug Pipeline

1. Confirm expected behavior from the user: which day/wave, which edges, and what was expected vs observed.
2. Validate level wave data and schema constraints.
3. Trace spawn transform resolution (including fallback behavior).
4. Trace preview aggregation used by HUD and 3D indicators.
5. Fix at the earliest layer that can explain the issue.
6. Verify with build checks and explicit manual debug steps.

## Primary Files

- Wave schema/types/migration/validation: `src/game/types/LevelDefinition.ts`
- Level content data: `src/config/levels.ts`
- Spawn transform resolver: `src/rts/spawnResolver.ts`
- Wave -> transforms + preview builder: `src/rts/waveSpawns.ts`
- Combat assembly + seeds + preview wiring: `src/rts/combat.ts`
- 3D invasion markers + debug toggle: `src/rts/render3d.ts`
- HUD intel panel for per-wave borders: `src/ui/components/hud/NextBattleIntelPanel.tsx`

Use `references/spawn-debug-checklist.md` for failure-mode mapping.

## Guardrails

- Keep fallback behavior intact when border config is absent:
  - Legacy path should still use `map.enemySpawn`.
- Prefer fixing config first, then resolver logic, then UI/render consumers.
- Do not introduce per-frame heavy work in render paths.
- Keep spawn edge labels consistent across preview, HUD, and 3D indicators.

## Fast Diagnostic Commands

```bash
rg -n "spawnEdges|spawnPointsPerEdge|spawnPadding|enemySpawn" src/config/levels.ts src/game/types/LevelDefinition.ts
rg -n "resolveWaveSpawnTransforms|buildNextBattlePreview|resolvedSpawnTransforms" src/rts/waveSpawns.ts src/rts/combat.ts
rg -n "updateInvasionIndicators|rts_debug_spawn_points|NextBattleIntelPanel" src/rts/render3d.ts src/ui/components/hud/NextBattleIntelPanel.tsx
```

## Manual Debug Toggle

To view spawn indicators outside build phase during local dev:

```js
localStorage.setItem('rts_debug_spawn_points', '1')
```

## Verification

Run:

```bash
npm run build
npm run test:night
```

Then validate manually in-game:

1. Start a level with known `spawnEdges`.
2. Open next battle intel and confirm edge list.
3. Enter build phase and confirm invasion markers align with expected borders.
4. If using debug toggle, confirm markers remain visible for troubleshooting.

## Output Contract

At completion, report:

1. Root cause.
2. Layer fixed (config, resolver, preview, or consumer).
3. Exact file/value/code updates.
4. Verification results and remaining risks.

