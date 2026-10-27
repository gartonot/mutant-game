import type { PickupKind } from './Pickups';
import { AMMO_CATEGORIES, type AmmoCategory } from './WeaponLoot';
export { rollWeaponDrop } from './WeaponLoot';
import { DEFAULT_UNLOCKED_GOLD_PICKUPS, GOLD_PICKUP_KINDS, GOLD_PICKUP_WEIGHT,
    type GoldPickupKind, type PickupDrop } from './PickupVariants';

export const PICKUP_DROP_CHANCE = .3;
export const PICKUP_KINDS: readonly Exclude<PickupKind, 'weapon'>[] = ['ammo', 'health', 'rapidFire', 'moveSpeed', 'doubleDamage', 'shield', 'iceBlast', 'fireBlast'];

/** One independent drop roll per defeated enemy; all ordinary kinds have equal weight. */
export function rollPickup(random: () => number = Math.random): PickupKind | null {
    return rollPickupDrop(random)?.kind ?? null;
}

/** Preserve the overall drop chance; each unlocked gold variant has a quarter of its silver weight. */
export function rollPickupDrop(random: () => number = Math.random,
    unlockedGoldKinds: readonly GoldPickupKind[] = DEFAULT_UNLOCKED_GOLD_PICKUPS,
    ammoCategories: readonly AmmoCategory[] = []): PickupDrop | null {
    if (random() >= PICKUP_DROP_CHANCE) return null;
    // Filtering the canonical list also ignores duplicate unlocks and prevents gold ammunition.
    const goldKinds = GOLD_PICKUP_KINDS.filter(kind => unlockedGoldKinds.includes(kind));
    const eligibleAmmo = AMMO_CATEGORIES.filter(category => ammoCategories.includes(category));
    const silverKinds = eligibleAmmo.length ? PICKUP_KINDS : PICKUP_KINDS.filter(kind => kind !== 'ammo');
    const totalWeight = silverKinds.length + goldKinds.length * GOLD_PICKUP_WEIGHT;
    const roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * totalWeight;
    if (roll < silverKinds.length) {
        const kind = silverKinds[Math.floor(roll)];
        if (kind === 'ammo') {
            const index = Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * eligibleAmmo.length);
            return { kind, tier: 'silver', ammoCategory: eligibleAmmo[index] };
        }
        return { kind, tier: 'silver' };
    }
    const index = Math.min(goldKinds.length - 1,
        Math.floor((roll - silverKinds.length) / GOLD_PICKUP_WEIGHT));
    return { kind: goldKinds[index], tier: 'gold' };
}
