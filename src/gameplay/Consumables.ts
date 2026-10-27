import { GOLD_PICKUP_KINDS } from './PickupVariants';
import type { GoldPickupKind, PickupTier } from './PickupVariants';

export const CONSUMABLE_SLOT_COUNT = 6;
export const DEFAULT_CONSUMABLE_SLOTS_UNLOCKED = 4;

export interface ConsumableSelection {
    readonly slotIndex: number;
    readonly kind: GoldPickupKind;
    readonly tier: PickupTier;
}

export function validateConsumables(entries: readonly ConsumableSelection[], unlocked = DEFAULT_CONSUMABLE_SLOTS_UNLOCKED): void {
    if (!Number.isInteger(unlocked) || unlocked < 0 || unlocked > CONSUMABLE_SLOT_COUNT) throw new Error('Invalid unlocked consumable slot count');
    const occupied = new Set<number>();
    const kinds = new Set<GoldPickupKind>();
    for (const entry of entries) {
        if (!Number.isInteger(entry.slotIndex) || entry.slotIndex < 0 || entry.slotIndex >= unlocked || occupied.has(entry.slotIndex)) throw new Error('Invalid consumable slot');
        if (!GOLD_PICKUP_KINDS.includes(entry.kind) || (entry.tier !== 'silver' && entry.tier !== 'gold')) throw new Error('Invalid consumable bonus');
        if (kinds.has(entry.kind)) throw new Error('Consumable bonus already equipped');
        occupied.add(entry.slotIndex);
        kinds.add(entry.kind);
    }
}
