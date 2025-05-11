import { startGameLoop } from '@/core/GameLoop';
import { GameWorld } from '@/systems/GameWorld.ts';
import { InputSystem } from '@/systems/InputSystem.ts';
import { PlayerController } from '@/systems/Player/PlayerController';
import { FpsCounter } from '@/ui/FpsCounter.ts';
import { Player } from '@entities/player/Player';

// Создаём канвас
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;


// Создаём игрока и его поведение
const player = new Player();
const input = new InputSystem();
const controller = new PlayerController(player, input);
const gameWorld = new GameWorld(controller);

// Счётчик FPS
const fpsCounter = new FpsCounter();

// Преключение оружия, заменить в будущем на UI
window.addEventListener('keydown', (event) => {
    if (event.key === '1') controller.switchToWeapon(0);
    if (event.key === '2') controller.switchToWeapon(1);
    if (event.key === '3') controller.switchToWeapon(2);
});

// Запускаем цикл игры, передаём в него игрока
startGameLoop(ctx, [
    gameWorld,
    controller,
    fpsCounter,
]);
