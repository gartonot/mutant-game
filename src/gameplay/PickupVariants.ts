import type { PickupKind } from './Pickups';
import type { WeaponId } from './ids';
import type { AmmoCategory } from './WeaponLoot';

export type PickupTier = 'silver' | 'gold';
export type GoldPickupKind = Exclude<PickupKind, 'ammo' | 'weapon'>;

export const GOLD_PICKUP_KINDS: readonly GoldPickupKind[] = [
    'health', 'rapidFire', 'moveSpeed', 'doubleDamage', 'shield', 'iceBlast', 'fireBlast',
];

/** Future progression may explicitly unlock individual variants; new runs unlock none. */
export const DEFAULT_UNLOCKED_GOLD_PICKUPS: readonly GoldPickupKind[] = [];
export const GOLD_PICKUP_WEIGHT = .25;

export type PickupDrop =
    | { kind: 'ammo'; tier: 'silver'; ammoCategory: AmmoCategory }
    | { kind: 'weapon'; tier: 'silver'; weaponId: WeaponId }
    | { kind: GoldPickupKind; tier: PickupTier };
