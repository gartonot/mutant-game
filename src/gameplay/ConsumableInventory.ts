import { CONSUMABLE_SLOT_COUNT, DEFAULT_CONSUMABLE_SLOTS_UNLOCKED, validateConsumables } from './Consumables';
import type { ConsumableSelection } from './Consumables';

export type ConsumableSlot = (ConsumableSelection & { readonly used: boolean }) | null;

/** Per-run charges are isolated from the preparation loadout. */
export class ConsumableInventory {
    private readonly entries: ConsumableSlot[];
    constructor(selections: readonly ConsumableSelection[] = [],
        readonly unlockedSlots = DEFAULT_CONSUMABLE_SLOTS_UNLOCKED) {
        validateConsumables(selections, unlockedSlots);
        this.entries = Array.from({ length: CONSUMABLE_SLOT_COUNT }, (_, slotIndex) => {
            const entry = selections.find(selection => selection.slotIndex === slotIndex);
            return entry ? { ...entry, used: false } : null;
        });
    }
    get slots(): readonly ConsumableSlot[] { return this.entries.map(entry => entry ? { ...entry } : null); }
    consume(slotIndex: number): ConsumableSelection | null {
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.unlockedSlots) return null;
        const entry = this.entries[slotIndex];
        if (!entry || entry.used) return null;
        this.entries[slotIndex] = { ...entry, used: true };
        return { slotIndex: entry.slotIndex, kind: entry.kind, tier: entry.tier };
    }
}
