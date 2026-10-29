import type { CharacterId } from '@/gameplay/ids';
import { createLazyImageAsset } from './ImageAsset';

const urls = typeof Image === 'undefined' ? {} : import.meta.glob<string>('../assets/abilities/v1/*.png', {
    eager: true, query: '?url', import: 'default',
});
const images = new Map<CharacterId, ReturnType<typeof createLazyImageAsset>>();

/** The unknown costumes deliberately have no invented ability artwork. */
export function abilityIconUrl(character: CharacterId | undefined): string | undefined {
    return character ? urls[`../assets/abilities/v1/${character}.png`] : undefined;
}

/** Prepare the selected hero; no argument prepares the complete sandbox catalog. */
export function ensureAbilityIcons(character?: CharacterId): Promise<void> {
    if (typeof Image === 'undefined') return Promise.resolve();
    const characters = character ? [character] : Object.keys(urls).map(path =>
        path.split('/').pop()!.replace('.png', '') as CharacterId);
    return Promise.all(characters.map(id => {
        const url = abilityIconUrl(id);
        if (!url) return Promise.resolve(false);
        let source = images.get(id);
        if (!source) { source = createLazyImageAsset(url); images.set(id, source); }
        return source.ensure();
    })).then(() => undefined);
}

export function drawAbilityIcon(ctx: CanvasRenderingContext2D, character: CharacterId | undefined,
    x: number, y: number, size: number, radius = 6): boolean {
    const asset = character ? images.get(character)?.asset : undefined;
    if (!asset?.loaded) return false;
    const image = asset.image;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.clip();
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - sourceSize) / 2, (image.naturalHeight - sourceSize) / 2,
        sourceSize, sourceSize, x, y, size, size);
    ctx.restore();
    return true;
}
