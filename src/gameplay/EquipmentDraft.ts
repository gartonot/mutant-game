import { defaultLoadout } from './characters';
import type { CharacterId, WeaponId } from './ids';
import { acceptsWeapon, validateLoadout, WEAPON_SLOTS } from './loadout';
import type { Loadout, WeaponSlot } from './loadout';
export { acceptsWeapon } from './loadout';

/** Stable key ignores selection order but preserves actual slot positions and bonus stacks. */
export function loadoutKey(loadout: Loadout): string {
    return JSON.stringify([loadout.character,
        [...loadout.weapons].sort((a, b) => a.slotId.localeCompare(b.slotId)),
        [...loadout.bonuses].sort((a, b) => a.id.localeCompare(b.id))]);
}

export class EquipmentDraft {
    private drafts = new Map<CharacterId, Loadout>();
    constructor(private readonly slots = WEAPON_SLOTS) {}
    get(character: CharacterId): Loadout {
        const draft = this.drafts.get(character) ?? defaultLoadout(character, this.slots);
        return { character, weapons: draft.weapons.map(entry => ({ ...entry })), bonuses: draft.bonuses.map(entry => ({ ...entry })) };
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
}
