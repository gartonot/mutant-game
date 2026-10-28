import { CHARACTER_RIGS } from './CharacterRig';
import type { ImageAsset } from './ImageAsset';

const ease = (t: number) => t * t * (3 - 2 * t);

/** A short articulated, unarmed pose made from the existing character texture.
 * Coordinates below describe masks in the authored 1280px Goliath image.
 * The arms overlap the torso at their shoulder pivots, and the crown is restored last.
 */
export function drawGoliathSlamRaster(ctx: CanvasRenderingContext2D, asset: ImageAsset | undefined,
    x: number, y: number, angle: number, progress: number): void {
    const p = Math.max(0, Math.min(1, progress));
    const lift = p < .28 ? ease(p / .28) : p < .4 ? 1 - Math.pow((p - .28) / .12, 3) : 0;
    const impact = p < .4 ? 0 : 1 - ease(Math.min(1, (p - .4) / .6));
    const recovery = p < .68 ? 0 : ease((p - .68) / .32);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(-3, 3, 29 - lift * 3, 27 - lift * 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(-lift * 7 + impact * 6, -lift * 3);
    ctx.scale(1 + lift * .08 - impact * .08, 1 + lift * .08 + impact * .05);
    if (!asset?.loaded) {
        ctx.fillStyle = '#657366';
        ctx.beginPath(); ctx.ellipse(-7, 0, 24, 26, 0, 0, Math.PI * 2); ctx.fill();
        for (const sign of [-1, 1]) {
            ctx.beginPath(); ctx.ellipse(25 - lift * 36, sign * (19 + lift * 8), 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore(); return;
    }
    const image = asset.image, rig = CHARACTER_RIGS.goliath;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.rotate(rig.rotation);
    ctx.translate(rig.target[0], rig.target[1]);
    ctx.scale(rig.target[2] / rig.source[2], rig.target[3] / rig.source[3]);
    ctx.translate(-rig.source[0], -rig.source[1]);

    // Each forearm is a texture slice, articulated around its shoulder.
    const arm = (upper: boolean) => {
        const px = upper ? 641 : 650, py = upper ? 440 : 822;
        const rotation = upper ? -lift * 1.85 - impact * .65 : lift * 1.65 + impact * .1;
        ctx.save(); ctx.translate(px, py); ctx.rotate(rotation);
        const stretch = upper ? 1 + impact * .27 : 1 - impact * .13;
        ctx.scale(stretch, 1); ctx.translate(-px, -py);
        ctx.save(); ctx.beginPath();
        if (upper) {
            ctx.moveTo(610, 280); ctx.lineTo(950, 280); ctx.lineTo(950, 710);
            ctx.lineTo(735, 710); ctx.lineTo(735, 540); ctx.lineTo(625, 490); ctx.closePath();
        } else ctx.rect(615, 710, 430, 310);
        ctx.clip(); ctx.drawImage(image, 0, 0); ctx.restore();
        if (!upper) {
            // Replace the weapon-supporting open palm with the same hero's closed fist.
            ctx.save(); ctx.translate(1040, 762); ctx.rotate(-.75 * (1 - recovery));
            ctx.scale(1.05, 1.05); ctx.translate(-823, -607);
            ctx.beginPath(); ctx.ellipse(823, 607, 82, 80, -.35, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(image, 0, 0); ctx.restore();
        }
        ctx.restore();
    };
    arm(true); arm(false);
    // Keep the spine and shoulder mass solid throughout the swing.
    ctx.save(); ctx.beginPath(); ctx.rect(60, 245, 595, 775); ctx.clip(); ctx.drawImage(image, 0, 0); ctx.restore();
    ctx.save(); ctx.translate(impact * 26 - lift * 16, 0);
    ctx.beginPath(); ctx.ellipse(584, 612, 104, 101, 0, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(image, 0, 0); ctx.restore();
    ctx.restore();
}
