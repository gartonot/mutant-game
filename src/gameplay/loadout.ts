import type { BonusSelection } from './bonuses';
import { validateConsumables } from './Consumables';
import type { ConsumableSelection } from './Consumables';
import { validateArsenal } from './arsenal';
import type { ArsenalAllocation } from './arsenal';
import { CHARACTER_IDS } from './ids';
import type { CharacterId, WeaponCategory, WeaponId } from './ids';
import { validateImplants } from './implants';
import type { ImplantAllocation } from './implants';
import { WEAPON_DEFINITIONS } from './weapons';

export interface WeaponSlot {
    readonly id: string;
    readonly label?: string;
    readonly fixedWeapon?: WeaponId;
    readonly allowedCategories?: readonly WeaponCategory[];
}
export const WEAPON_SLOTS: readonly WeaponSlot[] = [
    { id: '1', label: 'Пистолет', fixedWeapon: 'pistol', allowedCategories: ['sidearm'] },
    { id: '2', label: 'Дробовики', allowedCategories: ['shotgun'] },
    { id: '3', label: 'Автоматы', allowedCategories: ['automatic'] },
    { id: '4', label: 'Особое оружие', allowedCategories: ['special'] },
    { id: '5', label: 'Энергетическое', allowedCategories: ['scientific'] },
];
export interface Loadout {
    readonly character: CharacterId;
    readonly weapons: readonly { readonly slotId: string; readonly weaponId: WeaponId }[];
    readonly bonuses: readonly BonusSelection[];
    readonly implants?: ImplantAllocation;
    readonly arsenal?: ArsenalAllocation;
    readonly consumables?: readonly ConsumableSelection[];
    readonly consumableSlotsUnlocked?: number;
}
/** The same compatibility rule serves draft editing, default grants and battle validation. */
export function acceptsWeapon(slot: WeaponSlot, id: WeaponId): boolean {
    if (!Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, id)) return false;
    return (!slot.fixedWeapon || slot.fixedWeapon === id) &&
        (!slot.allowedCategories || slot.allowedCategories.includes(WEAPON_DEFINITIONS[id].category));
}

/** Resolve starting grants by slot rules, never by the order of the weapon list. */
export function placeStartingWeapons(weapons: readonly WeaponId[], slots: readonly WeaponSlot[] = WEAPON_SLOTS): Loadout['weapons'] {
    const entries: { slotId: string; weaponId: WeaponId }[] = [];
    for (const weaponId of weapons) {
        const available = (slot: WeaponSlot) => !entries.some(entry => entry.slotId === slot.id) && acceptsWeapon(slot, weaponId);
        const slot = slots.find(slot => slot.fixedWeapon === weaponId && available(slot)) ?? slots.find(available);
        if (!slot) throw new Error(`No available slot for starting weapon: ${weaponId}`);
        entries.push({ slotId: slot.id, weaponId });
    }
    return entries;
}

export function validateLoadout(loadout: Loadout, slots = WEAPON_SLOTS): void {
    validateConsumables(loadout.consumables ?? [], loadout.consumableSlotsUnlocked);
    if (loadout.implants !== undefined) validateImplants(loadout.implants);
    if (loadout.arsenal !== undefined) validateArsenal(loadout.arsenal);
    if (!CHARACTER_IDS.includes(loadout.character)) throw new Error('Unknown character');
    if (new Set(slots.map(slot => slot.id)).size !== slots.length) throw new Error('Duplicate slot definition');
    if (!loadout.weapons.length) throw new Error('At least one weapon is required');
    for (const slot of slots) {
        if (slot.fixedWeapon && !loadout.weapons.some(entry => entry.slotId === slot.id && entry.weaponId === slot.fixedWeapon)) throw new Error(`Required weapon missing: ${slot.fixedWeapon}`);
    }
    const occupied = new Set<string>();
    for (const entry of loadout.weapons) {
        const slot = slots.find(candidate => candidate.id === entry.slotId);
        if (!slot || occupied.has(entry.slotId)) throw new Error('Invalid weapon slot');
        if (!acceptsWeapon(slot, entry.weaponId)) throw new Error('Incompatible weapon category');
        occupied.add(entry.slotId);
    }
}
