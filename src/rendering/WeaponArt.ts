import type { WeaponId } from '@/gameplay/ids';
import { drawWeaponSprite, isWeaponSpriteLoaded } from './WeaponSprites';
import { drawExperimentalWeapon } from './ExperimentalWeaponArt';
export type { WeaponId } from '@/gameplay/ids';
export { WEAPON_ART, WEAPON_ORDER, WEAPON_MOUNT, muzzlePosition } from './WeaponGeometry';

export function drawWeapon(ctx: CanvasRenderingContext2D, id: WeaponId) {
    if (drawWeaponSprite(ctx, id)) return;
    if (drawExperimentalWeapon(ctx, id)) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#111819';
    const part = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 1); ctx.fill(); ctx.stroke();
    };
    const metal = ctx.createLinearGradient(0, -6, 0, 6);
    metal.addColorStop(0, '#a6b3b1'); metal.addColorStop(.35, '#5b6b6d'); metal.addColorStop(1, '#253138');
    if (id === 'pistol') {
        part(-2, -3, 12, 9, '#3c3028');
        ctx.fillStyle = metal; ctx.fillRect(5, -4, 22, 7); ctx.strokeRect(5, -4, 22, 7);
        part(26, -3, 3, 5, '#242d30');
        part(8, -5, 3, 2, '#c8d1c9');
        for (let x = 7; x < 14; x += 2) part(x, -3, .7, 5, '#344145');
    } else if (['rifle', 'm16', 'ak47'].includes(id)) {
        part(-14, -3, 16, 7, id === 'ak47' ? '#985b2c' : '#37474b');
        part(5, 3, 10, 5, '#343e40');
        part(29, -2, 17, 3, '#586466');
        part(43, -4, 3, 7, '#1d282e');
        ctx.fillStyle = metal; ctx.fillRect(0, -5, 24, 10); ctx.strokeRect(0, -5, 24, 10);
        part(20, -4, 14, 8, id === 'ak47' ? '#8d6340' : '#43565c');
        if (id === 'm16') part(3, -10, 20, 3, '#37474b');
        part(4, -6, 15, 2, '#a8b2ab');
        for (let x = 23; x < 32; x += 3) part(x, -3, 1, 6, '#503f2e');
    } else if (id === 'shotgun' || id === 'double-barrel') {
        part(-14, -3, 17, 8, '#714531');
        part(17, -4, 32, 3, '#8b9a9a');
        part(17, 0, 32, 3, '#4c5a60');
        ctx.fillStyle = metal; ctx.fillRect(0, -5, 18, 10); ctx.strokeRect(0, -5, 18, 10);
        part(23, -5, 13, 10, '#9a6642');
        for (let x = 25; x < 36; x += 3) part(x, -4, 1, 8, '#553c2b');
        part(47, -5, 2, 9, '#19232a');
        if (id === 'double-barrel') { part(17, -7, 32, 4, '#bac5c4'); part(17, 3, 32, 4, '#6b777c'); }
    } else if (id === 'plasma-grenade') {
        ctx.fillStyle = '#dbe9f1'; ctx.beginPath(); ctx.arc(14, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        part(10, -12, 7, 24, '#81a6ef'); part(12, -12, 2, 24, '#f4ffff');
    } else if (id === 'machine-gun') {
        part(-12, -6, 32, 12, '#424d53'); part(4, 5, 14, 9, '#713a2e');
        for (let y = -6; y <= 6; y += 4) part(17, y, 29, 3, '#9da7ad');
        part(23, -8, 4, 18, '#37444c'); part(42, -8, 4, 18, '#37444c');
    } else if (id === 'plasma-auto') {
        part(-13, -4, 19, 8, '#303f49');
        part(0, -6, 29, 12, '#455661');
        part(24, -5, 22, 10, '#899ba8');
        part(27, -3, 16, 6, '#25394b');
        part(28, -2, 14, 3, '#83a9ff');
        part(6, 5, 11, 13, '#34465c');
        for (let x = 8; x < 16; x += 2) part(x, 7, 1, 9, '#7799e8');
        ctx.strokeStyle = '#82919b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-8, -12); ctx.lineTo(22, -12); ctx.lineTo(29, -5); ctx.stroke();
        part(18, -5, 5, 10, '#83939c');
    } else if (['plasma-cannon', 'laser', 'flamethrower', 'skull-launcher'].includes(id)) {
        const energy = id === 'laser' ? '#ff553c' : id === 'flamethrower' || id === 'skull-launcher' ? '#69b341' : '#8fcbff';
        part(-12, -4, 20, 9, '#424e51'); part(0, -9, 39, 18, id === 'plasma-cannon' ? '#acbac7' : '#496052');
        part(5, -10, 27, 5, energy); part(5, 5, 27, 5, energy); part(35, -6, 11, 12, '#8d9da7');
        if (id === 'skull-launcher') for (let x = 9; x < 34; x += 10) { ctx.fillStyle = '#e2e0ca'; ctx.beginPath(); ctx.arc(x, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#282d29'; ctx.fillRect(x, -3, 2, 2); ctx.fillRect(x, 1, 2, 2); }
        else part(9, -2, 20, 4, energy);
    } else {
        part(-12, -4, 14, 9, '#4e5841');
        part(4, 3, 10, 6, '#343a32');
        const tube = ctx.createLinearGradient(0, -8, 0, 8);
        tube.addColorStop(0, '#b2b77a'); tube.addColorStop(.4, '#738553'); tube.addColorStop(1, '#35452f');
        ctx.fillStyle = tube; ctx.fillRect(0, -7, 40, 14); ctx.strokeRect(0, -7, 40, 14);
        part(35, -8, 8, 16, '#6e7c70');
        part(40, -6, 3, 12, '#182522');
        part(9, -9, 17, 3, '#36433b');
        part(7, -6, 3, 12, '#a4aa80');
        part(27, -6, 3, 12, '#a4aa80');
        part(17, -3, 6, 6, '#d8bb5a');
    }
    ctx.restore();
}

/** Transparent, cached image URL for any DOM UI; uses the same model as the game. */
const icons = new Map<WeaponId, { url: string; raster: boolean }>();
export function weaponIcon(id: WeaponId): string {
    const raster = isWeaponSpriteLoaded(id);
    if (icons.get(id)?.raster !== raster) {
        const canvas = document.createElement('canvas');
        canvas.width = 192; canvas.height = 80;
        const ctx = canvas.getContext('2d')!;
        ctx.translate(52, 40); ctx.scale(2.1, 2.1);
        drawWeapon(ctx, id);
        icons.set(id, { url: canvas.toDataURL(), raster });
    }
    return icons.get(id)!.url;
}

