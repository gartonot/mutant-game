import { CHARACTER_TEXTURES } from '@/assets/combat-scaled/dimensions';
import { CHARACTER_RIGS } from './CharacterRig';
import type { RigRect } from './CharacterRig';
import type { CharacterId } from '@/gameplay/ids';

/** Only source pixels change. World-space bounds, fingers, pivots and muzzle positions stay authored. */
export function characterTextureRect(character: CharacterId, rect: RigRect): RigRect {
    const { scaleX, scaleY } = CHARACTER_TEXTURES[character];
    return [rect[0] * scaleX, rect[1] * scaleY, rect[2] * scaleX, rect[3] * scaleY];
}

export const CHARACTER_TEXTURE_RIGS = Object.fromEntries(Object.entries(CHARACTER_RIGS).map(([id, rig]) =>
    [id, { ...rig, source: characterTextureRect(id as CharacterId, rig.source) }])) as typeof CHARACTER_RIGS;

export function drawCharacterTextureInAuthorSpace(ctx: CanvasRenderingContext2D, character: CharacterId, image: CanvasImageSource) {
    const { sourceWidth, sourceHeight } = CHARACTER_TEXTURES[character];
    ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
}
