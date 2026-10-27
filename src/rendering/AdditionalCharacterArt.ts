import type { CharacterId, WeaponId } from '@/gameplay/ids';
import layout from '@/assets/characters/combat-v4/layout';
import { createLazyImageAsset } from './ImageAsset';
import { drawRasterCharacter } from './RasterCharacterArt';

// Only active runtime artwork is bundled; previous authoring versions stay on disk.
const urls = import.meta.glob<string>('../assets/combat-runtime/characters/*.png', { eager: true, query: '?url', import: 'default' });
const images = new Map<CharacterId, ReturnType<typeof createLazyImageAsset>>();
export function ensureAdditionalCharacterArt(id: CharacterId): Promise<boolean> {
    if (id === 'mercenary' || id === 'assassin' || id === 'destroyer') return Promise.resolve(false);
    if (!Object.prototype.hasOwnProperty.call(layout, id)) return Promise.resolve(false);
    const url = urls[`../assets/combat-runtime/characters/${id}.png`];
    if (!url || typeof Image === 'undefined') return Promise.resolve(false);
    let source = images.get(id);
    if (!source) { source = createLazyImageAsset(url); images.set(id, source); }
    return source.ensure();
}

export function drawAdditionalCharacter(ctx: CanvasRenderingContext2D, character: CharacterId, weapon: WeaponId, recoil: number): boolean {
    if (character === 'mercenary' || character === 'assassin' || character === 'destroyer') return false;
    const asset = images.get(character)?.asset;
    return asset ? drawRasterCharacter(ctx, character, asset, weapon, recoil) : false;
}

export function loadedAdditionalCharacters(): CharacterId[] {
    return [...images].filter(([, source]) => source.asset?.loaded).map(([id]) => id);
}
