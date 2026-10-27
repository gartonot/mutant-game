import { inventoryWeaponIcon, refreshWeaponIconsWhenReady } from '@/rendering/InventoryWeaponArt';
import type { WeaponId } from '@/gameplay/ids';
import './upgrades.css';

// Presentation only: these cards do not read or modify player progression.
const implantSymbols = [
    '<circle cx="32" cy="35" r="13"/><path d="M16 8v16M25 5v14M39 5v14M48 8v16M13 34a19 19 0 0 0 38 0"/>',
    '<path d="M12 48C8 17 43 7 51 27M17 52C10 28 37 16 46 32M24 53C17 36 34 27 39 38M31 51l3-9"/>',
    '<circle cx="35" cy="28" r="14"/><path d="M23 19C10 25 9 41 13 51M28 26C18 33 16 45 20 53M34 35l-7 18"/>',
    '<path d="M12 14l20 18-20 18M30 14l20 18-20 18"/>',
    '<circle cx="32" cy="32" r="19"/><path d="M7 17h50M7 47h50"/>',
];
const arsenal: { name: string; weapon: WeaponId }[] = [
    { name: 'Пистолеты', weapon: 'pistol' },
    { name: 'Автоматы', weapon: 'rifle' },
    { name: 'Дробовики', weapon: 'shotgun' },
    { name: 'Особое оружие', weapon: 'grenade-launcher' },
    { name: 'Энергетическое оружие', weapon: 'plasma-cannon' },
];

function card(icon: string, name: string, color: number): string {
    return `<div class="upgrade-card" role="group" aria-label="${name}">
        <div class="upgrade-icon upgrade-color-${color}" title="${name}">${icon}</div>
        <span class="upgrade-value" aria-label="Уровень улучшения: 0">0</span>
        <div class="upgrade-controls"><button type="button" disabled aria-label="Уменьшить: ${name}">−</button><button type="button" disabled aria-label="Увеличить: ${name}">+</button></div>
    </div>`;
}

export class UpgradesScreen {
    readonly element = document.createElement('section');

    constructor() {
        this.element.className = 'character-frame upgrades-frame';
        this.element.hidden = true;
        this.element.setAttribute('aria-label', 'Улучшения');
        this.element.innerHTML = `
            <div class="upgrade-points"><button disabled aria-label="Добавить очки улучшения">+</button><span class="upgrade-point-emblem" aria-hidden="true">▲</span><b aria-label="Очки пока недоступны">—</b><span>Очки улучшения</span></div>
            <section class="upgrade-section" aria-labelledby="implants-heading">
                <h2 id="implants-heading">Имплантанты: <span>0 / —</span></h2>
                <div class="upgrade-cards">${implantSymbols.map((symbol, i) => card(`<svg viewBox="0 0 64 64" aria-hidden="true">${symbol}</svg>`, `Имплант ${i + 1}`, i)).join('')}</div>
            </section>
            <section class="upgrade-section" aria-labelledby="arsenal-heading">
                <h2 id="arsenal-heading">Улучшения арсенала: <span>0 / —</span></h2>
                <div class="upgrade-cards">${arsenal.map((item, i) => card(`<img data-weapon-art="${item.weapon}" src="${inventoryWeaponIcon(item.weapon)}" alt=""/>`, item.name, i + 5)).join('')}</div>
            </section>
            <p class="upgrades-note">Улучшения пока недоступны</p>`;
        refreshWeaponIconsWhenReady(this.element);
    }
}

