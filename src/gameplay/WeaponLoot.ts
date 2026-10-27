import { WEAPON_IDS, type WeaponCategory, type WeaponId } from './ids';
import { WEAPON_DEFINITIONS } from './weapons';

export type AmmoCategory = Exclude<WeaponCategory, 'sidearm'>;
export const AMMO_CATEGORIES: readonly AmmoCategory[] = ['shotgun', 'automatic', 'special', 'scientific'];
/** Progression can supply a smaller allowlist without changing drop selection. */
export const ALL_DROP_WEAPONS: readonly WeaponId[] = WEAPON_IDS.filter(id => id !== 'pistol');
export const WEAPON_DROP_CHANCE = .06;
export const WEAPON_CATEGORY_DROP_WEIGHTS: Readonly<Record<AmmoCategory, number>> = {
    shotgun: 1, automatic: 1, special: .6, scientific: .6,
};

const unitRoll = (random: () => number) => Math.max(0, Math.min(1 - Number.EPSILON, random()));

/** Independent of bonus drops. Category weights do not grow with the number of unlocked guns. */
export function rollWeaponDrop(random: () => number = Math.random,
    available: readonly WeaponId[] = ALL_DROP_WEAPONS,
    acquiredCategories: readonly AmmoCategory[] = []): WeaponId | null {
    if (random() >= WEAPON_DROP_CHANCE) return null;
    const eligible = ALL_DROP_WEAPONS.filter(id => available.includes(id)
        && !acquiredCategories.some(category => category === WEAPON_DEFINITIONS[id].category));
    const categories = AMMO_CATEGORIES.filter(category => eligible.some(id => WEAPON_DEFINITIONS[id].category === category));
    if (!categories.length) return null;
    let roll = unitRoll(random) * categories.reduce((sum, category) => sum + WEAPON_CATEGORY_DROP_WEIGHTS[category], 0);
    let selected = categories[categories.length - 1];
    for (const category of categories) {
        roll -= WEAPON_CATEGORY_DROP_WEIGHTS[category];
        if (roll < 0) { selected = category; break; }
    }
    const weapons = eligible.filter(id => WEAPON_DEFINITIONS[id].category === selected);
    return weapons[Math.min(weapons.length - 1, Math.floor(unitRoll(random) * weapons.length))];
}
