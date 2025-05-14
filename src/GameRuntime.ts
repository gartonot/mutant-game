import { Player } from '@/entities/player/Player';
import { GameWorld } from '@/systems/GameWorld';
import { InputSystem } from '@/systems/InputSystem';
import { PlayerController } from '@/systems/Player/PlayerController';

export function createGameWorld(): GameWorld {
    const player = new Player();
    const input = new InputSystem();
    const controller = new PlayerController(player, input);
    const gameWorld = new GameWorld(controller);

    controller.init((x, y, angle) => {
        gameWorld.addMuzzleFlash(x, y, angle);
    });

    return gameWorld;
}
