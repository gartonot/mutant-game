import type { CharacterId } from '@/gameplay/ids';

const urls = typeof Image === 'undefined' ? {} : import.meta.glob<string>('../assets/abilities/v1/*.png', {
    eager: true, query: '?url', import: 'default',
});
const images = new Map<CharacterId, HTMLImageElement>();
let ready: Promise<void> | undefined;

/** The unknown costumes deliberately have no invented ability artwork. */
export function abilityIconUrl(character: CharacterId | undefined): string | undefined {
    return character ? urls[`../assets/abilities/v1/${character}.png`] : undefined;
}

/** Load once before combat; drawing never initiates image requests. */
export function ensureAbilityIcons(): Promise<void> {
    if (typeof Image === 'undefined') return Promise.resolve();
    return ready ??= Promise.all(Object.entries(urls).map(([path, url]) => new Promise<void>(resolve => {
        const character = path.split('/').pop()!.replace('.png', '') as CharacterId;
        const image = new Image();
        image.onload = () => { images.set(character, image); resolve(); };
        image.onerror = () => resolve();
        image.src = url;
    }))).then(() => undefined);
}

export function drawAbilityIcon(ctx: CanvasRenderingContext2D, character: CharacterId | undefined,
    x: number, y: number, size: number, radius = 6): boolean {
    const image = character ? images.get(character) : undefined;
    if (!image) return false;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.clip();
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - sourceSize) / 2, (image.naturalHeight - sourceSize) / 2,
        sourceSize, sourceSize, x, y, size, size);
    ctx.restore();
    return true;
}
