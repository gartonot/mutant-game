import type { IUpdatable, IDrawable } from '../entities/interfaces';

export type GameObject = IUpdatable & IDrawable;


// Запускаем цикл игры
export const startGameLoop = (
    ctx: CanvasRenderingContext2D,
    gameObjects: GameObject[]
): void => {
    const loop = () => {
        updateAll(gameObjects);
        renderAll(ctx, gameObjects);
        requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
};

// Обновляем все объекты
const updateAll = (objects: GameObject[]): void => {
    for (const obj of objects) {
        obj.update();
    }
};

// Рендерим все объекты
const renderAll = (
    ctx: CanvasRenderingContext2D,
    objects: GameObject[]
): void => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const obj of objects) {
        obj.draw(ctx);
    }
};
