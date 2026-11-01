import { createCharacter } from '@/gameplay/CharacterFactory';
import { configureArena, getArenaGeneration, getArenaSize, resetArena } from '@/gameplay/Arena';
import { defaultLoadout } from '@/gameplay/characters';
import type { Loadout } from '@/gameplay/loadout';
import { GameWorld } from '@/systems/GameWorld';
import { InputSystem } from '@/systems/InputSystem';
import { PlayerController } from '@/systems/Player/PlayerController';
import type { Bonuses } from '@/progression/Achievements';
import { emptyBonuses } from '@/progression/Achievements';
import type { CharacterId } from '@/gameplay/ids';

export function createGameWorld(bonuses: Bonuses = emptyBonuses(), character: CharacterId = 'mercenary', loadout: Loadout = defaultLoadout(character)): GameWorld {
    const { player, weapons, createRunWeapon } = createCharacter(loadout, [
        { stat: 'maxHp', operation: 'add', value: bonuses.health },
        { stat: 'speed', operation: 'percent', value: bonuses.speed },
        { stat: 'damage', operation: 'percent', value: bonuses.damage },
    ]);
    configureArena(window.innerWidth, window.innerHeight);
    const arenaGeneration = getArenaGeneration();
    const arena = getArenaSize();
    player.x = arena.width / 2;
    player.y = arena.height / 2;
    const input = new InputSystem();
    const controller = new PlayerController(player, input, weapons, createRunWeapon);
    const gameWorld = new GameWorld(controller, undefined, undefined, undefined,
        loadout.consumables, loadout.consumableSlotsUnlocked);
    const disposeWorld = gameWorld.dispose.bind(gameWorld);
    gameWorld.dispose = () => {
        disposeWorld();
        resetArena(arenaGeneration);
    };

    controller.init((x, y, angle) => {
        gameWorld.addMuzzleFlash(x, y, angle);
    });

    return gameWorld;
}
