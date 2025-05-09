import type { IGameEntity } from '@entities/interfaces';

export class FpsCounter implements IGameEntity {
    private frameCount = 0;
    private lastTime = performance.now();
    private fps = 0;
    public visible = true;

    update = (): void => {
        const now = performance.now();
        this.frameCount++;

        if (now - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = now;
        }
    };

    draw = (ctx: CanvasRenderingContext2D): void => {
        if (!this.visible) return;

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText(`FPS: ${this.fps}`, 10, 20);
    };
}
