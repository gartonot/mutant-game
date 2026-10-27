import type { CharacterId } from '@/gameplay/ids';
import layout from '@/assets/characters/combat-v4/layout';

export type RigRect = readonly [number, number, number, number];
export type RigFinger = readonly [number, number, number, number];
export type RigPoint = Readonly<{ x: number; y: number }>;
export type CharacterRig = Readonly<{
    source: RigRect;
    target: RigRect;
    rotation: number;
    fingers: readonly RigFinger[];
    /** Palm centres in character space, facing +X, sorted rear to front. */
    palms: readonly RigPoint[];
    /** Optional crown silhouette, in the same unrotated target space as fingers. */
    headOcclusion?: RigFinger;
}>;

function rig(source: RigRect, target: RigRect, rotation: number, fingers: readonly RigFinger[], headOcclusion?: RigFinger): CharacterRig {
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const palms = fingers.map(([x, y]) => ({ x: x * cos - y * sin, y: x * sin + y * cos }))
        .sort((a, b) => a.x - b.x);
    return { source, target, rotation, fingers, palms, headOcclusion };
}

/** One calibration per character: the same sprite transform drives drawing and weapon attachment. */
export const CHARACTER_RIGS: Readonly<Record<CharacterId, CharacterRig>> = {
    mercenary: rig([0, 0, 1240, 887], [-25, -28, 70, 50.07], .35,
        [[39.8, -5.4, 2.2, 1.2], [35.4, .6, 2.1, 1.2]]),
    assassin: rig([0, 0, 1260, 887], [-25, -26, 70, 49.28], .2,
        [[41.4, -.8, 2.1, 1.2], [38.2, 3.4, 2.1, 1.2]]),
    destroyer: rig([0, 0, 1290, 887], [-27, -23, 83.85, 57.655], 0,
        [[52.1, 4.2, 2.1, 1.4], [49.1, 8.5, 2.3, 1.4]]),
    ...Object.fromEntries(Object.entries(layout).map(([id, region]) => {
        const scale = region.drawWidth / region.width;
        const fingers: RigFinger[] = region.hands.map(hand => [
            region.drawX + (hand.x - region.x) * scale,
            region.drawY + (hand.y - region.y) * scale,
            hand.rx * scale, hand.ry * scale,
        ]);
        const head = 'headOcclusion' in region ? region.headOcclusion : undefined;
        const headOcclusion: RigFinger | undefined = head ? [
            region.drawX + (head.x - region.x) * scale,
            region.drawY + (head.y - region.y) * scale,
            head.rx * scale, head.ry * scale,
        ] : undefined;
        return [id, rig([region.x, region.y, region.width, region.height],
            [region.drawX, region.drawY, region.drawWidth, region.height * scale], region.rotation, fingers, headOcclusion)];
    })) as Record<keyof typeof layout, CharacterRig>,
};

/** Recoil is always in character +X space, before the sprite's authored rotation. */
export function drawRigBody(ctx: CanvasRenderingContext2D, image: HTMLImageElement, body: CharacterRig, recoil: number) {
    ctx.save();
    ctx.translate(-recoil, 0);
    ctx.rotate(body.rotation);
    ctx.drawImage(image, ...body.source, ...body.target);
    ctx.restore();
}
