import { CHARACTER_IDS } from './ids';
import type { CharacterId, WeaponId } from './ids';
import { placeStartingWeapons, WEAPON_SLOTS } from './loadout';
import type { Loadout, WeaponSlot } from './loadout';
import { BASE_STATS } from './stats';
import type { CombatStats, StatModifier } from './stats';

export interface CharacterDefinition {
    readonly id: CharacterId;
    readonly baseStats: Readonly<CombatStats>;
    readonly modifiers: readonly StatModifier[];
    readonly ability: { readonly id: string; readonly status: 'pending' };
    readonly startingWeapons: readonly WeaponId[];
}
const prototypeWeapons: readonly WeaponId[] = ['pistol'];
// Reference bonuses/abilities are not activated by this refactor.
export const CHARACTER_DEFINITIONS = Object.fromEntries(CHARACTER_IDS.map(id => [id, {
    id, baseStats: BASE_STATS, modifiers: [],
    ability: { id: id === 'mercenary' ? 'dual-weapons' : id === 'assassin' ? 'victim-fear' : id === 'destroyer' ? 'artillery' : `${id}-ability`, status: 'pending' },
    startingWeapons: prototypeWeapons,
}])) as unknown as Readonly<Record<CharacterId, CharacterDefinition>>;
export function defaultLoadout(character: CharacterId, slots: readonly WeaponSlot[] = WEAPON_SLOTS): Loadout {
    if (!Object.prototype.hasOwnProperty.call(CHARACTER_DEFINITIONS, character)) throw new Error('Unknown character');
    return { character, weapons: placeStartingWeapons(CHARACTER_DEFINITIONS[character].startingWeapons, slots), bonuses: [] };
}
