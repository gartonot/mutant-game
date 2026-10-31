import { createLazyImageAsset } from '@/rendering/ImageAsset';
import { EQUIPMENT_LAYOUT } from '@/assets/equipment-runtime/layout';
import { EQUIPMENT_WEAPON_PREVIEWS, EQUIPMENT_BONUS_PREVIEWS } from '@/assets/equipment-runtime/previews';
import type { WeaponId } from '@/gameplay/ids';
import type { GoldPickupKind, PickupTier } from '@/gameplay/PickupVariants';

const weaponUrl = new URL('../assets/equipment-runtime/weapons.webp', import.meta.url).href;
const bonusUrl = new URL('../assets/equipment-runtime/bonuses.webp', import.meta.url).href;
const createImage = () => { const image = new Image(); image.fetchPriority = 'high'; image.decoding = 'async'; return image; };
const weapons = createLazyImageAsset(weaponUrl, createImage);
const bonuses = createLazyImageAsset(bonusUrl, createImage);
const weaponIcons = new Map<string, string>(), bonusIcons = new Map<string, string>();
let preparedWeapons: Promise<boolean> | undefined, preparedBonuses: Promise<boolean> | undefined;
type Cell = { x: number; y: number; width: number; height: number };

function crop(image: HTMLImageElement, cell: Cell): string {
    const canvas = document.createElement('canvas');
    canvas.width = cell.width; canvas.height = cell.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Equipment artwork canvas unavailable');
    ctx.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, cell.width, cell.height);
    return canvas.toDataURL();
}

export function equipmentWeaponIcon(id: WeaponId): string {
    if (!weaponIcons.has(id) && weapons.asset?.loaded) weaponIcons.set(id, crop(weapons.asset.image, EQUIPMENT_LAYOUT.weapons.cells[id]));
    return weaponIcons.get(id) ?? EQUIPMENT_WEAPON_PREVIEWS[id];
}

export function equipmentBonusIcon(kind: GoldPickupKind, tier: PickupTier): string {
    const key = `${tier}:${kind}` as keyof typeof EQUIPMENT_BONUS_PREVIEWS;
    if (!bonusIcons.has(key) && bonuses.asset?.loaded) bonusIcons.set(key, crop(bonuses.asset.image, EQUIPMENT_LAYOUT.bonuses.cells[key]));
    return bonusIcons.get(key) ?? EQUIPMENT_BONUS_PREVIEWS[key];
}

export function refreshEquipmentArtwork(root: HTMLElement): Promise<boolean> {
    // The two sheets settle independently; a slow bonus never holds weapon cards back.
    preparedWeapons ??= weapons.ensure().then(async ready => {
        if (!ready) { preparedWeapons = undefined; return false; }
        for (const id of Object.keys(EQUIPMENT_LAYOUT.weapons.cells) as WeaponId[]) {
            equipmentWeaponIcon(id);
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        return true;
    });
    preparedBonuses ??= bonuses.ensure().then(async ready => {
        if (!ready) { preparedBonuses = undefined; return false; }
        for (const key of Object.keys(EQUIPMENT_LAYOUT.bonuses.cells)) {
            const [tier, kind] = key.split(':') as [PickupTier, GoldPickupKind];
            equipmentBonusIcon(kind, tier);
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
        return true;
    });
    void preparedWeapons.then(ready => {
        if (!ready || !root.isConnected) return;
        root.querySelectorAll<HTMLImageElement>('img[data-weapon-art]').forEach(image => {
            const url = equipmentWeaponIcon(image.dataset.weaponArt as WeaponId);
            if (image.getAttribute('src') !== url) image.src = url;
        });
    });
    void preparedBonuses.then(ready => {
        if (!ready || !root.isConnected) return;
        root.querySelectorAll<HTMLImageElement>('img[data-bonus-art]').forEach(image => {
            const [tier, kind] = image.dataset.bonusArt!.split(':') as [PickupTier, GoldPickupKind];
            const url = equipmentBonusIcon(kind, tier);
            if (image.getAttribute('src') !== url) image.src = url;
        });
    });
    return Promise.all([preparedWeapons, preparedBonuses]).then(results => results.every(Boolean));
}
