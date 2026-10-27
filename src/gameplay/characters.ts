import { CHARACTER_IDS } from './ids';
import type { CharacterId, WeaponId } from './ids';
import { placeStartingWeapons, WEAPON_SLOTS } from './loadout';
import type { Loadout, WeaponSlot } from './loadout';
import { BASE_STATS } from './stats';
import { CHARACTER_ABILITIES } from './CharacterAbilities';
import type { CombatStats, StatModifier } from './stats';

export interface CharacterDefinition {
    readonly id: CharacterId;
    readonly baseStats: Readonly<CombatStats>;
    readonly modifiers: readonly StatModifier[];
    readonly ability: { readonly id: string; readonly status: 'active' | 'pending' };
    readonly startingWeapons: readonly WeaponId[];
}
const prototypeWeapons: readonly WeaponId[] = ['pistol'];
// Starting weapons remain pending; active abilities are listed in CharacterAbilities.
const characterModifiers: Readonly<Record<CharacterId, readonly StatModifier[]>> = {
    destroyer: [
        { stat: 'explosionRadius', operation: 'percent', value: .5 },
        { stat: 'speed', operation: 'percent', value: -.1 },
    ],
    assassin: [
        { stat: 'attackSpeed', operation: 'percent', value: .3 },
        { stat: 'maxHp', operation: 'add', value: -20 },
    ],
    mercenary: [],
    'half-mutant': [
        { stat: 'maxHp', operation: 'add', value: 20 },
        { stat: 'regeneration', operation: 'add', value: .3 },
    ],
    telepath: [
        { stat: 'attackSpeed', operation: 'percent', value: .15 },
        { stat: 'speed', operation: 'percent', value: .15 },
    ],
    cyborg: [
        { stat: 'maxHp', operation: 'add', value: 70 },
        { stat: 'damage', operation: 'percent', value: .1 },
    ],
    goliath: [{ stat: 'maxHp', operation: 'add', value: 100 }],
    fanatic: [
        { stat: 'speed', operation: 'percent', value: .3 },
        { stat: 'bonusGroundDuration', operation: 'percent', value: .3 },
    ],
    nuclear: [
        { stat: 'damage', operation: 'percent', value: .25 },
        { stat: 'maxHp', operation: 'add', value: 20 },
    ],
    'silver-hunter': [
        { stat: 'bonusDuration', operation: 'percent', value: .25 },
        { stat: 'damage', operation: 'percent', value: .1 },
    ],
    witcher: [
        { stat: 'speed', operation: 'percent', value: .1 },
        { stat: 'regeneration', operation: 'add', value: .8 },
        { stat: 'maxHp', operation: 'percent', value: -.3 },
    ],
    'plasma-nuclear': [
        { stat: 'damage', operation: 'percent', value: .25 },
        { stat: 'maxHp', operation: 'add', value: 20 },
    ],
    hunter: [
        { stat: 'bonusDuration', operation: 'percent', value: .25 },
        { stat: 'attackSpeed', operation: 'percent', value: .1 },
    ],
    'unknown-white-outfit': [],
    'unknown-crossbow': [],
};
export const CHARACTER_DEFINITIONS = Object.fromEntries(CHARACTER_IDS.map(id => [id, {
    id, baseStats: BASE_STATS, modifiers: characterModifiers[id],
    ability: { id: id === 'mercenary' ? 'dual-weapons' : id === 'assassin' ? 'victim-fear' : id === 'destroyer' ? 'artillery' : `${id}-ability`, status: CHARACTER_ABILITIES[id] ? 'active' : 'pending' },
    startingWeapons: prototypeWeapons,
}])) as unknown as Readonly<Record<CharacterId, CharacterDefinition>>;
export function defaultLoadout(character: CharacterId, slots: readonly WeaponSlot[] = WEAPON_SLOTS): Loadout {
    if (!Object.prototype.hasOwnProperty.call(CHARACTER_DEFINITIONS, character)) throw new Error('Unknown character');
    return { character, weapons: placeStartingWeapons(CHARACTER_DEFINITIONS[character].startingWeapons, slots), bonuses: [] };
}
