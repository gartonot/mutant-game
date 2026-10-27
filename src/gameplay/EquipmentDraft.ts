import { defaultLoadout } from './characters';
import { DEFAULT_CONSUMABLE_SLOTS_UNLOCKED, validateConsumables } from './Consumables';
import type { ConsumableSelection } from './Consumables';
import type { GoldPickupKind, PickupTier } from './PickupVariants';
import { ARSENAL_CATEGORIES, EMPTY_ARSENAL } from './arsenal';
import type { CharacterId, WeaponId } from './ids';
import { EMPTY_IMPLANTS } from './implants';
import { acceptsWeapon, validateLoadout, WEAPON_SLOTS } from './loadout';
import type { Loadout, WeaponSlot } from './loadout';
export { acceptsWeapon } from './loadout';

/** Stable key ignores selection order but preserves actual slot positions and bonus stacks. */
export function loadoutKey(loadout: Loadout): string {
    const implants = loadout.implants ?? EMPTY_IMPLANTS;
    const arsenal = loadout.arsenal ?? EMPTY_ARSENAL;
    return JSON.stringify([loadout.character,
        [...loadout.weapons].sort((a, b) => a.slotId.localeCompare(b.slotId)),
        [...loadout.bonuses].sort((a, b) => a.id.localeCompare(b.id)),
        [implants.health, implants.attackSpeed, implants.moveSpeed, implants.damage ?? 0, implants.armor ?? 0],
        ARSENAL_CATEGORIES.map(category => arsenal[category]),
        [...(loadout.consumables ?? [])].sort((a, b) => a.slotIndex - b.slotIndex),
        loadout.consumableSlotsUnlocked ?? DEFAULT_CONSUMABLE_SLOTS_UNLOCKED]);
}

export class EquipmentDraft {
    private drafts = new Map<CharacterId, Loadout>();
    constructor(private readonly slots = WEAPON_SLOTS, private readonly consumableSlotsUnlocked = DEFAULT_CONSUMABLE_SLOTS_UNLOCKED) {
        validateConsumables([], consumableSlotsUnlocked);
    }
    get(character: CharacterId): Loadout {
        const draft = this.drafts.get(character) ?? defaultLoadout(character, this.slots);
        return { character, weapons: draft.weapons.map(entry => ({ ...entry })), bonuses: draft.bonuses.map(entry => ({ ...entry })),
            ...(draft.consumables ? { consumables: draft.consumables.map(entry => ({ ...entry })) } : {}),
            ...(this.consumableSlotsUnlocked !== DEFAULT_CONSUMABLE_SLOTS_UNLOCKED ? { consumableSlotsUnlocked: this.consumableSlotsUnlocked } : {}),
            ...(draft.implants ? { implants: { ...draft.implants } } : {}),
            ...(draft.arsenal ? { arsenal: { ...draft.arsenal } } : {}) };
    }
    assign(character: CharacterId, slotId: string, weaponId: WeaponId | null): void {
        const slot = this.slots.find(item => item.id === slotId);
        if (!slot || (slot.fixedWeapon && weaponId !== slot.fixedWeapon) || (weaponId && !acceptsWeapon(slot, weaponId))) throw new Error('Incompatible slot');
        const draft = this.get(character);
        this.drafts.set(character, { ...draft, weapons: [
            ...draft.weapons.filter(entry => entry.slotId !== slotId),
            ...(weaponId ? [{ slotId, weaponId }] : []),
        ] });
    }
    slotFor(weaponId: WeaponId): WeaponSlot {
        const slot = this.slots.find(slot => acceptsWeapon(slot, weaponId));
        if (!slot) throw new Error('No compatible slot');
        return slot;
    }
    canEquip(character: CharacterId, weaponId: WeaponId): boolean {
        const slot = this.slotFor(weaponId);
        return !slot.fixedWeapon && !this.get(character).weapons.some(entry => entry.slotId === slot.id);
    }
    equip(character: CharacterId, weaponId: WeaponId): string {
        if (!this.canEquip(character, weaponId)) throw new Error('Weapon category already equipped');
        const slot = this.slotFor(weaponId);
        this.assign(character, slot.id, weaponId);
        return slot.id;
    }
    canPlay(character: CharacterId): boolean {
        try { validateLoadout(this.get(character), this.slots); return true; } catch { return false; }
    }
    assignConsumable(character: CharacterId, slotIndex: number, selection: Omit<ConsumableSelection, 'slotIndex'> | null): void {
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.consumableSlotsUnlocked) throw new Error('Invalid consumable slot');
        const draft = this.get(character);
        const consumables = [
            ...(draft.consumables ?? []).filter(entry => entry.slotIndex !== slotIndex),
            ...(selection ? [{ slotIndex, kind: selection.kind, tier: selection.tier }] : []),
        ].sort((a, b) => a.slotIndex - b.slotIndex);
        validateConsumables(consumables, this.consumableSlotsUnlocked);
        this.drafts.set(character, { ...draft, consumables });
    }
    canEquipConsumable(character: CharacterId, kind: GoldPickupKind, tier: PickupTier): boolean {
        const entries = this.get(character).consumables ?? [];
        const slotIndex = Array.from({ length: this.consumableSlotsUnlocked }, (_, index) => index)
            .find(index => !entries.some(entry => entry.slotIndex === index));
        if (slotIndex === undefined) return false;
        try { validateConsumables([...entries, { slotIndex, kind, tier }], this.consumableSlotsUnlocked); return true; } catch { return false; }
    }
    equipConsumable(character: CharacterId, kind: GoldPickupKind, tier: PickupTier): number {
        if (!this.canEquipConsumable(character, kind, tier)) throw new Error('No available slot or consumable bonus already equipped');
        const entries = this.get(character).consumables ?? [];
        const slotIndex = Array.from({ length: this.consumableSlotsUnlocked }, (_, index) => index)
            .find(index => !entries.some(entry => entry.slotIndex === index))!;
        this.assignConsumable(character, slotIndex, { kind, tier });
        return slotIndex;
    }
}
