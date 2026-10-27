import { Player } from '@/entities/player/Player';
import { createWeapon } from '@/entities/weapon/WeaponFactory';

import { resolveBonuses } from './bonuses';
import type { BonusDefinition } from './bonuses';
import { CHARACTER_DEFINITIONS } from './characters';
import { applyImplants } from './implants';
import { arsenalBonuses } from './arsenal';
import { WEAPON_DEFINITIONS } from './weapons';
import { validateLoadout, WEAPON_SLOTS } from './loadout';
import type { Loadout } from './loadout';
import { resolveStats } from './stats';
import type { StatModifier } from './stats';
import type { WeaponId } from './ids';

export function createCharacter(loadout: Loadout, progression: readonly StatModifier[] = [],
    bonusCatalog?: Readonly<Record<string, BonusDefinition>>) {
    validateLoadout(loadout);
    const definition = CHARACTER_DEFINITIONS[loadout.character];
    if (!definition) throw new Error('Unknown character');
    const stats = applyImplants(resolveStats(definition.baseStats,
        [...definition.modifiers, ...resolveBonuses(loadout.bonuses, bonusCatalog), ...progression]), loadout.implants);
    const player = new Player();
    player.character = definition.id;
    player.maxHp = stats.maxHp;
    player.currentHp = stats.maxHp;
    player.speed = stats.speed;
    player.damageReduction = stats.damageReduction;
    player.regeneration = stats.regeneration;
    player.bonusGroundDuration = stats.bonusGroundDuration;
    player.bonusDuration = stats.bonusDuration;
    // Capture run progression once so later loot gets the same permanent modifiers.
    const arsenal = { ...loadout.arsenal };
    const createRunWeapon = (id: WeaponId) => {
        const category = WEAPON_DEFINITIONS[id].category;
        const bonus = arsenalBonuses(arsenal[category] ?? 0);
        return createWeapon(id, stats.damage * (1 + bonus.damage), stats.attackSpeed * (1 + bonus.attackSpeed),
            loadout.character, stats.explosionRadius, 1 + bonus.ammo);
    };
    const weapons = WEAPON_SLOTS.map(slot => {
        const entry = loadout.weapons.find(item => item.slotId === slot.id);
        return entry ? createRunWeapon(entry.weaponId) : null;
    });
    player.weapon = weapons.find(weapon => weapon !== null)!.id;
    return { player, weapons, stats, createRunWeapon };
}

