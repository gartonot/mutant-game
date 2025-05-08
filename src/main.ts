
import { startGameLoop } from './core/GameLoop'
import type { GameObject } from './core/GameLoop';
import { Player } from './entities/player/Player';
// Создаём канвас
const canvas = document.getElementById('game') as HTMLCanvasElement;
// Получаем контекст
const ctx = canvas.getContext('2d')!;
// Указываем размеры канваса отнсоительно экрана
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;



// Создаём игрока
const player: GameObject = new Player();

// Запускаем цикл игры, передаём в него игрока
startGameLoop(ctx, [player]);
