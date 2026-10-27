import { createCharacter } from '@/gameplay/CharacterFactory';
import { defaultLoadout } from '@/gameplay/characters';
import type { Loadout } from '@/gameplay/loadout';
import { GameWorld } from '@/systems/GameWorld';
import { InputSystem } from '@/systems/InputSystem';
import { PlayerController } from '@/systems/Player/PlayerController';
import type { Bonuses } from '@/progression/Achievements';
import { emptyBonuses } from '@/progression/Achievements';
import type { CharacterId } from '@/gameplay/ids';

export function createGameWorld(bonuses: Bonuses = emptyBonuses(), character: CharacterId = 'mercenary', loadout: Loadout = defaultLoadout(character)): GameWorld {
    const { player, weapons } = createCharacter(loadout, [
        { stat: 'maxHp', operation: 'add', value: bonuses.health },
        { stat: 'speed', operation: 'percent', value: bonuses.speed },
        { stat: 'damage', operation: 'percent', value: bonuses.damage },
    ]);
    player.x = window.innerWidth / 2;
    player.y = window.innerHeight / 2;
    const input = new InputSystem();
    const controller = new PlayerController(player, input, weapons);
    const gameWorld = new GameWorld(controller);

    controller.init((x, y, angle) => {
        gameWorld.addMuzzleFlash(x, y, angle);
    });

    return gameWorld;
}
