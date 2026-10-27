import type { CharacterId, WeaponId } from '@/gameplay/ids';
import layout, { redrawnLayouts } from '@/assets/characters/combat-v4/layout';
import { loadImageAsset } from './ImageAsset';
import type { ImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';

const urls = import.meta.glob<string>(['../assets/characters/combat-v3/*.png', '../assets/characters/combat-v4/*.png'], { eager: true, query: '?url', import: 'default' });
const images = new Map<CharacterId, ImageAsset>();
export const additionalCharacterArtReady = Promise.all((Object.keys(layout) as (keyof typeof layout)[]).map(id => {
    const version = Object.prototype.hasOwnProperty.call(redrawnLayouts, id) ? 'combat-v4' : 'combat-v3';
    const url = urls[`../assets/characters/${version}/${id}.png`];
    if (!url) return Promise.resolve(false);
    const asset = loadImageAsset(url);
    images.set(id, asset);
    return asset.ready;
}));

export function drawAdditionalCharacter(ctx: CanvasRenderingContext2D, character: CharacterId, weapon: WeaponId, recoil: number): boolean {
    const asset = images.get(character);
    return asset ? drawRasterCharacter(ctx, character, asset, weapon, recoil) : false;
}

export function loadedAdditionalCharacters(): CharacterId[] {
    return [...images].filter(([, asset]) => asset.loaded).map(([id]) => id);
}
