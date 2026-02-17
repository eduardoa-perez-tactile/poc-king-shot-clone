# Balance Playbook

Use this file to choose the smallest safe edit set for common tuning requests.

## Request-to-File Matrix

| Request pattern | Primary files | Secondary checks |
| --- | --- | --- |
| "Early game feels too poor/rich" | `src/config/buildings.ts`, `src/config/levels.ts` | `src/run/economy.ts` |
| "Unit X is weak/too strong" | `src/config/units.ts`, `src/config/buildings.ts` | `src/rts/combat.ts` |
| "Wave N spikes too hard" | `src/config/levels.ts`, `src/config/elites.ts` | `src/rts/waveSpawns.ts` |
| "Progression unlocks too late/early" | `src/config/stronghold.ts`, `src/config/levels.ts` | `src/game/rules/progression.ts` |
| "Night modifiers/perks are unfair" | `src/config/nightContent.ts` | `src/run/nightSystems.ts` |
| "Hero carries too hard/falls off" | `src/config/heroes.ts`, `src/config/levels.ts` | `src/rts/combat.ts` |

## Tuning Order

1. Adjust economy and access first (costs, income, unlocks).
2. Adjust baseline combat stats second.
3. Adjust wave composition and elite pressure third.
4. Adjust goals only if pacing still misses target outcomes.

## Change Sizing

- Small pass: 5% to 10% on one axis.
- Medium pass: 10% to 20% on two connected axes.
- Large pass: more than 20% only with explicit user direction.

Avoid multi-axis large passes in a single step.

## Verification Checklist

1. Run `npm run test:night`.
2. Run `npm run build`.
3. Confirm no unintended schema drift in `src/game/types/LevelDefinition.ts` consumers.
4. Summarize values changed with expected before/after play feel.
