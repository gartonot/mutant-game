import { drawWeapon } from './WeaponArt';
import type { WeaponId } from './WeaponArt';
import { drawMercenary, mercenaryArtReady } from './MercenaryArt';
import { drawAssassin, assassinArtReady } from './AssassinArt';
import { drawDestroyer, destroyerArtReady } from './DestroyerArt';
import { drawAdditionalCharacter, drawAdditionalStormCharacter, ensureAdditionalCharacterArt } from './AdditionalCharacterArt';
export { drawAdditionalGoliathSlam as drawGoliathSlam } from './AdditionalCharacterArt';
import { dualCharacterPose, weaponMount } from './WeaponGeometry';
import { CHARACTER_RIGS } from './CharacterRig';

import type { CharacterId } from '@/gameplay/ids';
export type { CharacterId } from '@/gameplay/ids';
export { CHARACTER_IDS } from '@/gameplay/ids';
/** Prepare only the selected hero. Drawing never starts requests. */
export function ensureCharacterArt(character: CharacterId): Promise<boolean> {
    if (typeof Image === 'undefined') return Promise.resolve(false);
    if (character === 'mercenary') return mercenaryArtReady();
    if (character === 'assassin') return assassinArtReady();
    if (character === 'destroyer') return destroyerArtReady();
    return ensureAdditionalCharacterArt(character);
}
const looks = {
    mercenary: { cloth: '#39484a', light: '#657371', skin: '#958d72', head: '#303c3a', size: 1 },
    assassin: { cloth: '#842c33', light: '#bf5050', skin: '#d8b39a', head: '#b75b32', size: .92 },
    destroyer: { cloth: '#53623b', light: '#8b9860', skin: '#c29a75', head: '#d0ab85', size: 1.13 },
};

export function drawStormCharacter(ctx: CanvasRenderingContext2D, x: number, y: number,
    angle: number, weapon: WeaponId, recoil = 0): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const drawn = drawAdditionalStormCharacter(ctx, weapon, recoil);
    ctx.restore();
    if (!drawn) drawSingleCharacter(ctx, 'fanatic', weapon, x, y, angle, 1, recoil);
}

/** The rear-facing twin overlaps the torso, with its own arms, head and weapon. */
export function drawCharacter(ctx: CanvasRenderingContext2D, character: CharacterId, weapon: WeaponId,
    x: number, y: number, angle = 0, scale = 1, recoil = 0, dualWeapons = false) {
    if (dualWeapons) {
        const twin = dualCharacterPose(x, y, angle, scale);
        // Draw behind the original so their overlapping backs form one silhouette.
        drawSingleCharacter(ctx, character, weapon, twin.x, twin.y, twin.angle, scale, recoil);
    }
    drawSingleCharacter(ctx, character, weapon, x, y, angle, scale, recoil);
}

/** Fixed top-down pose. Body, arms, weapon and head are independent layers. */
function drawSingleCharacter(ctx: CanvasRenderingContext2D, character: CharacterId, weapon: WeaponId,
    x: number, y: number, angle = 0, scale = 1, recoil = 0) {
    const look = looks[character as keyof typeof looks] ?? looks.mercenary;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    if (drawAdditionalCharacter(ctx, character, weapon, recoil)) { ctx.restore(); return; }
    if (character === 'mercenary' && drawMercenary(ctx, weapon, recoil)) {
        ctx.restore();
        return;
    }
    if (character === 'assassin' && drawAssassin(ctx, weapon, recoil)) {
        ctx.restore();
        return;
    }
    if (character === 'destroyer' && drawDestroyer(ctx, weapon, recoil)) {
        ctx.restore();
        return;
    }
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(-2, 2, 23 * look.size, 24 * look.size, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#151d1c'; ctx.lineWidth = 1.4;
    const oval = (cx: number, cy: number, rx: number, ry: number, color: string) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    // Boots and pack remain behind the shoulders.
    oval(-11, -9, 10, 6, '#262c2b'); oval(-11, 10, 10, 6, '#262c2b');
    oval(-10, 0, 12, 15, look.cloth);
    const torso = ctx.createLinearGradient(-15, -18, 12, 20);
    torso.addColorStop(0, look.light); torso.addColorStop(1, look.cloth);
    ctx.fillStyle = torso; ctx.beginPath(); ctx.roundRect(-12, -19 * look.size, 23, 38 * look.size, 9); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b7b48e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-7, -15); ctx.lineTo(3, 16); ctx.stroke();
    if (character === 'destroyer') {
        for (let i = 0; i < 7; i++) { ctx.fillStyle = '#d1b65d'; ctx.fillRect(-9 + i * 1.7, -14 + i * 4, 6, 2); }
    }
    // The loading/error fallback uses the same attachment as the raster model.
    const mount = weaponMount(character, weapon);
    const [rear, front] = CHARACTER_RIGS[character].palms;
    const rearX = rear.x, rearY = rear.y;
    const frontX = front.x, frontY = front.y;
    ctx.translate(-recoil, 0);
    ctx.strokeStyle = '#17211f'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(frontX * .5, -13); ctx.lineTo(frontX, frontY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(rearX * .5, 21); ctx.lineTo(rearX, rearY); ctx.stroke();
    ctx.strokeStyle = character === 'destroyer' ? look.skin : look.light; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(frontX * .5, -13); ctx.lineTo(frontX, frontY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(rearX * .5, 21); ctx.lineTo(rearX, rearY); ctx.stroke();
    ctx.save(); ctx.translate(mount.x, mount.y); ctx.rotate(mount.angle); drawWeapon(ctx, weapon); ctx.restore();
    ctx.strokeStyle = '#19211e'; ctx.lineWidth = 1.2;
    oval(rearX, rearY, 4, 3.5, look.skin);
    oval(frontX, frontY, 4, 3.5, look.skin);
    ctx.translate(recoil, 0);
    // Head is above arms: hood and green lenses, copper hair, or a bald scalp.
    oval(-1, -2, 12, 12, look.head);
    oval(5, -2, 6, 8, character === 'mercenary' ? '#57615b' : look.skin);
    if (character === 'mercenary') {
        oval(8, -6, 2.3, 2.3, '#a4d996'); oval(8, 2, 2.3, 2.3, '#a4d996');
        oval(12, -2, 3, 3, '#303b39');
        ctx.strokeStyle = '#819085'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-2, -2, 9, 1.7, 4.6); ctx.stroke();
    } else if (character === 'assassin') {
        oval(-5, -3, 9, 11, '#ae502f');
        ctx.strokeStyle = '#e39754'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-9, -9); ctx.quadraticCurveTo(0, -14, 3, -8); ctx.stroke();
    } else {
        ctx.strokeStyle = '#edc6a0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-2, -3, 8, 3.4, 5.3); ctx.stroke();
    }
    ctx.restore();
}

