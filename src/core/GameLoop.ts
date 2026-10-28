import type { IUpdatable, IDrawable } from '@/entities/interfaces';

import { FixedStep } from './FixedStep';

export type GameObject = IUpdatable & IDrawable;

export function startGameLoop(ctx: CanvasRenderingContext2D, objects: GameObject[], options: { isActive?: () => boolean } = {}) {
    const simulation = new FixedStep();
    let handle = 0;
    const update = (deltaMs: number) => {
        if (options.isActive?.() === false) return;
        for (const object of objects) object.update(deltaMs);
    };
    const loop = (timestamp: number) => {
        if (document.hidden || options.isActive?.() === false) {
            simulation.reset();
        } else {
            simulation.advance(timestamp, update);
            // Backing-store dimensions must be cleared without the DPR transform (also at zoom < 100%).
            ctx.save();
            ctx.resetTransform();
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
            for (const object of objects) object.draw(ctx);
        }
        handle = requestAnimationFrame(loop);
    };
    const reset = () => { simulation.reset(); };
    document.addEventListener('visibilitychange', reset);
    handle = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(handle); document.removeEventListener('visibilitychange', reset); };
}
