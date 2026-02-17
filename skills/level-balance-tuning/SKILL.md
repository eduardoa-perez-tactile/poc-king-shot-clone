---
name: level-balance-tuning
description: Adjust mission pacing, economy, squads, and progression for the Day Cycle RTS prototype. Use when asked to rebalance levels, wave pressure, resource flow, unit/building values, day goals, or stronghold-gated progression in this repository.
---

# Level Balance Tuning

## Overview

Use this skill to make balance changes that stay data-driven and consistent with the current run loop.

## Workflow

1. Restate the balance intent as measurable targets.
2. Map the request to the minimum config files that control the behavior.
3. Edit data tables first, then adjust logic only when data cannot express the change.
4. Run lightweight verification commands.
5. Summarize exact value changes and expected gameplay impact.

## Target Files

- Economy, goals, waves, map pads: `src/config/levels.ts`
- Unit cost and combat profile: `src/config/units.ts`
- Building costs, upgrades, income, bonuses: `src/config/buildings.ts`
- Stronghold unlock/caps/gating: `src/config/stronghold.ts`
- Hero stats/loadouts: `src/config/heroes.ts`
- Elite and boss tuning: `src/config/elites.ts`
- Night modifiers/perks/traits: `src/config/nightContent.ts`

Use `references/balance-playbook.md` to select files quickly based on the request pattern.

## Guardrails

- Prefer configuration edits over hardcoded logic changes.
- Keep run phases intact: `build`, `battle_cry`, `combat`, `day_end`, `win`, `lose`.
- Preserve existing level schema expectations from `src/game/types/LevelDefinition.ts`.
- Avoid changing unrelated systems while tuning one axis.
- If changing spawn pressure, keep preview consistency with RTS wave data consumers.

## Verification

Run these checks after edits:

```bash
npm run test:night
npm run build
```

If a command cannot run, state it explicitly and explain what was validated manually.

## Output Contract

When finishing a balance task, report:

1. Files changed.
2. Old value -> new value for each tuned entry.
3. Intended gameplay effect.
4. Verification results.

