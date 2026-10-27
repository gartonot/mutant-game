import type { IUpdatable, IDrawable } from '@/entities/interfaces';

import { FixedStep } from './FixedStep';
import { FrameProfiler } from './FrameProfiler';

export type GameObject = IUpdatable & IDrawable;

export function startGameLoop(ctx: CanvasRenderingContext2D, objects: GameObject[], options: { isActive?: () => boolean } = {}) {
    const simulation = new FixedStep();
    const profiler = new URLSearchParams(location.search).has('profile') ? new FrameProfiler() : undefined;
    if (profiler) Object.assign(window, { mutantProfile: () => ({ ...profiler.report(), droppedSimulationMs: simulation.droppedMs }) });
    let previousFrame: number | undefined;
    let handle = 0;
    const update = (deltaMs: number) => {
        if (options.isActive?.() === false) return;
        for (const object of objects) object.update(deltaMs);
    };
    const loop = (timestamp: number) => {
        if (document.hidden || options.isActive?.() === false) {
            simulation.reset(); previousFrame = undefined;
        } else {
            const start = profiler ? performance.now() : 0;
            simulation.advance(timestamp, update);
            const updated = profiler ? performance.now() : 0;
            // Backing-store dimensions must be cleared without the DPR transform (also at zoom < 100%).
            ctx.save();
            ctx.resetTransform();
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
            for (const object of objects) object.draw(ctx);
            if (profiler) profiler.record(updated - start, performance.now() - updated, previousFrame === undefined ? 0 : timestamp - previousFrame);
            previousFrame = timestamp;
        }
        handle = requestAnimationFrame(loop);
    };
    const reset = () => { simulation.reset(); previousFrame = undefined; };
    document.addEventListener('visibilitychange', reset);
    handle = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(handle); document.removeEventListener('visibilitychange', reset); };
}
