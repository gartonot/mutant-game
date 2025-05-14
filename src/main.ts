import { startGameLoop } from '@/core/GameLoop';
import { FpsCounter } from '@/ui/FpsCounter.ts';

import { createGameWorld } from './GameRuntime';

// Создаём канвас
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Создание игрового мира
const gameWorld = createGameWorld();
const controller = gameWorld.getPlayerController();

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

const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
};
window.addEventListener('resize', resizeCanvas);
