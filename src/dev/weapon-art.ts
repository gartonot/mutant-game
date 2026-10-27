import { drawCharacter, ensureCharacterArt, CHARACTER_IDS } from '@/rendering/CharacterArt';
import { drawWeapon } from '@/rendering/WeaponArt';
import { WEAPON_ORDER, WEAPON_ART, weaponAttachment } from '@/rendering/WeaponGeometry';
import { CHARACTER_RIGS } from '@/rendering/CharacterRig';
import { loadedWeaponSprites, weaponSpritesReady } from '@/rendering/WeaponSprites';
import { loadedAdditionalCharacters } from '@/rendering/AdditionalCharacterArt';
import { CHARACTER_PRESENTATIONS } from '@/ui/CharacterPresentations';
import type { CharacterId, WeaponId } from '@/gameplay/ids';

const grid = document.querySelector('#grid')!;
const character = document.querySelector<HTMLSelectElement>('#character')!;
const weapon = document.querySelector<HTMLSelectElement>('#weapon')!;
const mode = document.querySelector<HTMLSelectElement>('#mode')!;
const angle = document.querySelector<HTMLInputElement>('#angle')!;
const recoil = document.querySelector<HTMLInputElement>('#recoil')!;
const muzzle = document.querySelector<HTMLInputElement>('#muzzle')!;
const grips = document.querySelector<HTMLInputElement>('#grips')!;
character.replaceChildren(...CHARACTER_PRESENTATIONS.map(c => new Option(c.name, c.id)));
character.value = 'mercenary';
weapon.replaceChildren(...WEAPON_ORDER.map(id => new Option(WEAPON_ART[id].name, id)));
weapon.value = 'rifle';

type Card = { canvas: HTMLCanvasElement; character: CharacterId; weapon: WeaponId; name: string };
let cards: Card[] = [];
let assetsReady = false;
let baseCharactersLoaded = 0;
function buildCards() {
    grid.replaceChildren(); cards = [];
    const matrix = mode.value === 'matrix';
    const entries = matrix
        ? CHARACTER_PRESENTATIONS.flatMap(c => WEAPON_ORDER.map(id => ({ name: `${c.name} · ${WEAPON_ART[id].name}`, character: c.id, weapon: id })))
        : mode.value === 'characters'
            ? CHARACTER_PRESENTATIONS.map(c => ({ name: c.name, character: c.id, weapon: weapon.value as WeaponId }))
            : WEAPON_ORDER.map(id => ({ name: WEAPON_ART[id].name, character: character.value as CharacterId, weapon: id }));
    character.disabled = mode.value !== 'weapons';
    weapon.disabled = mode.value !== 'characters';
    grid.classList.toggle('matrix', matrix);
    for (const entry of entries) {
        const article = document.createElement('article');
        const title = document.createElement('h2'); title.textContent = entry.name;
        const canvas = document.createElement('canvas'); canvas.width = 430; canvas.height = 420;
        canvas.setAttribute('aria-label', entry.name);
        article.append(title, canvas); grid.append(article); cards.push({ canvas, ...entry });
    }
    render();
}
function cross(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size = 2.5) {
    ctx.strokeStyle = color; ctx.lineWidth = .65;
    ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
}
function render() {
    const rotation = Number(angle.value) * Math.PI / 180;
    const kick = Number(recoil.value);
    document.querySelector('#recoil-value')!.textContent = String(kick);
    document.querySelector<HTMLElement>('#legend')!.hidden = !grips.checked;
    const failures: string[] = [];
    for (const card of cards) {
        const attachment = weaponAttachment(card.character, card.weapon, kick);
        if (!attachment.supportValid) failures.push(card.name);
        card.canvas.parentElement!.classList.toggle('invalid', !attachment.supportValid);
        const ctx = card.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 430, 420);
        ctx.save(); ctx.translate(162, 45); ctx.scale(2.7, 2.7); drawWeapon(ctx, card.weapon); ctx.restore();
        drawCharacter(ctx, card.character, card.weapon, 205, 230, rotation, 1.8, kick);
        ctx.save(); ctx.translate(205, 230); ctx.rotate(rotation); ctx.scale(1.8, 1.8);
        if (muzzle.checked) cross(ctx, attachment.muzzle.x, attachment.muzzle.y, '#e7ba6d');
        if (grips.checked) {
            ctx.strokeStyle = attachment.supportValid ? '#a6ed85' : '#ff6d6d';
            ctx.lineWidth = .75;
            if (attachment.supportActive) {
                ctx.fillStyle = attachment.supportValid ? '#a6ed851c' : '#ff6d6d1c';
                ctx.beginPath();
                attachment.supportPolygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(attachment.support.x, attachment.support.y, 3, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.strokeStyle = '#ffd35a';
            ctx.beginPath(); ctx.arc(attachment.primary.x, attachment.primary.y, 2, 0, Math.PI * 2); ctx.stroke();
            for (const palm of CHARACTER_RIGS[card.character].palms) cross(ctx, palm.x - kick, palm.y, '#61d9ff');
        }
        ctx.restore();
    }
    document.querySelector('#status')!.textContent = `${assetsReady ? `${WEAPON_ORDER.length} оружий (${loadedWeaponSprites().length} растровых) · ${loadedAdditionalCharacters().length + baseCharactersLoaded} персонажей` : 'Загрузка…'} · ${cards.length} сочетаний`;
    document.querySelector('#validation')!.textContent = failures.length
        ? `Опора второй руки вне зоны: ${failures.length} из ${cards.length}. ${failures.slice(0, 8).join('; ')}${failures.length > 8 ? '…' : ''}`
        : `Проверено ${cards.length} сочетаний: ошибок опоры не найдено. Отдача ${kick}. Для одноручного хвата опора второй руки не требуется.`;
}
for (const control of [character, weapon, mode]) control.addEventListener('input', buildCards);
for (const control of [angle, muzzle, grips, recoil]) control.addEventListener('input', render);
buildCards();
void Promise.all([weaponSpritesReady(), Promise.all(CHARACTER_IDS.map(ensureCharacterArt))]).then(([, characters]) => {
    baseCharactersLoaded = CHARACTER_IDS.filter((id, index) =>
        ['mercenary', 'assassin', 'destroyer'].includes(id) && characters[index]).length;
    assetsReady = true;
    render();
});

