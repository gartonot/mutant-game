let sprite: HTMLCanvasElement | undefined;

/** Rasterize the identical glow once, instead of running shadowBlur per projectile per frame. */
export function drawBulletSprite(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    if (!sprite) {
        sprite = document.createElement('canvas');
        sprite.width = 128; sprite.height = 96;
        const image = sprite.getContext('2d')!;
        image.scale(2, 2); image.translate(32, 24);
        image.shadowBlur = 20; image.shadowColor = 'rgba(209,216,42,0.8)'; image.fillStyle = '#d1d82a';
        image.beginPath(); image.roundRect(-6.5, -1.5, 13, 3, 1.5); image.fill();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.drawImage(sprite, -32, -24, 64, 48);
    ctx.restore();
}
