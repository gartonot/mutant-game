import { Player } from '@/entities/player/Player';
import { createWeapon } from '@/entities/weapon/WeaponFactory';

import { resolveBonuses } from './bonuses';
import type { BonusDefinition } from './bonuses';
import { CHARACTER_DEFINITIONS } from './characters';
import { validateLoadout, WEAPON_SLOTS } from './loadout';
import type { Loadout } from './loadout';
import { resolveStats } from './stats';
import type { StatModifier } from './stats';

export function createCharacter(loadout: Loadout, progression: readonly StatModifier[] = [],
    bonusCatalog?: Readonly<Record<string, BonusDefinition>>) {
    validateLoadout(loadout);
    const definition = CHARACTER_DEFINITIONS[loadout.character];
    if (!definition) throw new Error('Unknown character');
    const stats = resolveStats(definition.baseStats,
        [...definition.modifiers, ...resolveBonuses(loadout.bonuses, bonusCatalog), ...progression]);
    const player = new Player();
    player.character = definition.id;
    player.maxHp = stats.maxHp;
    player.currentHp = stats.maxHp;
    player.speed = stats.speed;
    const weapons = WEAPON_SLOTS.map(slot => {
        const entry = loadout.weapons.find(item => item.slotId === slot.id);
        return entry ? createWeapon(entry.weaponId, stats.damage, stats.attackSpeed, loadout.character) : null;
    });
    player.weapon = weapons.find(weapon => weapon !== null)!.id;
    return { player, weapons, stats };
}

