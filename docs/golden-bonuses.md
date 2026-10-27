# Golden pickup variants

Golden variants use the same symbols as silver pickups with a gold rim. The collected timed bonus keeps that variant in the HUD and uses the same clock overlay and shuffle animation.

| Pickup | Silver | Gold |
| --- | --- | --- |
| Shield | Incoming damage ×0.5 | Incoming damage ×0.25 |
| Rapid fire | Fire rate ×2 | Fire rate ×4 |
| Movement | Movement speed ×1.5 | Movement speed ×3 |
| Damage | Current weapon damage ×2 | Current weapon damage ×4 |
| Medkit | +50 HP over 400 ms | +100 HP over 400 ms |
| Ice blast | 1 damage, movement speed ×0.5 for 4 seconds | 2 damage, movement speed ×0.25 for 8 seconds |
| Explosion | 6 damage | 12 damage |

Timed effects last 10 simulation seconds, multiplied by the character's bonus-duration stat. Repeated pickups refresh the full timer and move that kind to the newest HUD position. Gold upgrades an active silver bonus; silver refreshes active gold without downgrading it. Expiration clears the tier, so a later silver pickup starts silver again. Medkits respect maximum HP and never occupy a timed HUD slot. Ammo has no golden variant.

Golden variants are locked by default. `PickupVariants.ts` defines the individual kinds that future progression may unlock and their relative drop weight (0.25 of the matching ordinary pickup). No progression or player-facing unlock action is implemented yet.

Ice blast (Ледяной взрыв) and explosion (Взрыв) trigger immediately at the collected pickup's ground position. A visible expanding wave marks the area; neither pickup occupies a timed HUD slot. Ice blast has a 210 px radius (three 70 px mercenary model lengths), and explosion has a 315 px radius (4.5 model lengths). Gold keeps the same radius. Ice damage and slowing affect enemies inside its radius at collection; the slowing duration advances with simulation time. Explosion deals greater area damage without slowing. The silver variants are included in ordinary enemy drops from the start; their gold variants require future unlocks just like other gold pickups.

Regression coverage in `tests/pickup-effects.test.ts` checks gold strength, expiry, mixed-tier refresh order, and smooth 100 HP healing.
