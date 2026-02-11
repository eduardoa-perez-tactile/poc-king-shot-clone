# Progression Rules Tuning

This project now uses level-driven progression rules for pad unlocking and producer auto-spawn behavior.

## Runtime loop

Each day runs as:

1. Build phase
2. Battle cry (short pre-combat phase)
3. Combat
4. Day-end rewards
5. Next day

Day 1 miniboss is suppressed by runtime when `minibossRules.suppressDay1MiniBoss` is enabled (default).

## Dashboard tuning locations

- `Economy` tab:
  - starting gold and day reward settings
- `Pads` tab:
  - pad type (`TOWER_ONLY`, `UNIT_PRODUCER`, `HERO`)
  - unlock level per pad
  - pad constraints (min tower / max producer / max hero)
- `Stronghold & Gates` tab:
  - pad unlock mapping by stronghold level
  - stronghold max level and gating values
- `Units` tab:
  - producer defaults:
    - `unitsOnBuild`
    - `unitsPerUpgradeLevel`
    - per-level stat scaling (health/damage/attack speed)
- `Boss Rules` tab:
  - day-1 miniboss suppression is shown as a locked runtime rule

## Data fields

Relevant level definition fields:

- `padConstraints`
- `buildingPads[].padType`
- `stronghold.padUnlockLevels`
- `stronghold.padUnlocksByLevel`
- `producerDefaults`
- `minibossRules.suppressDay1MiniBoss`
