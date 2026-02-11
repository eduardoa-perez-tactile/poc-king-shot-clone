# RTS Input + Formation Updates

## Keybinds
- `ArrowUp/ArrowDown/ArrowLeft/ArrowRight`: move the player hero (dt-based movement).
- `T`: rally friendly player squads to stable ring slots around the hero.
- Arrow keys no longer pan the RTS camera.

Gameplay key handlers are ignored while a text input/textarea/select/contenteditable element has focus.

## Rally Slot Formation
- Rally uses deterministic ring slots around the hero.
- Slots per ring: 8 (`N, NE, E, SE, S, SW, W, NW`).
- Assignment order is stable: `ownerBuildingId -> squadId -> entityId`.
- If units exceed 8 slots, additional rings are allocated with larger radius.

## Separation (No Overlap)
- Unit overlap prevention is handled with a lightweight spatial-hash pass each simulation step.
- Broadphase cell buckets are used to query nearby neighbors only (same + adjacent cells).
- Friendly units within minimum spacing push away with clamped correction force for stable movement/idle spacing.
- Group move/attack-move orders also distribute destinations by formation slots to avoid identical target points.

## Position Persistence Across Battle Transitions
- Friendly positions are snapshotted in combat results and written back to run roster spawn positions.
- Build -> Combat and Combat -> Build sim resets now preserve these stored positions instead of teleporting to default spawn/rally.
- If a saved position is invalid, entities are nudged to nearby walkable space during sim creation.
