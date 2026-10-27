import healthIcon from '@/assets/icons-runtime/upgrades/health-v2.png';
import attackSpeedIcon from '@/assets/icons-runtime/upgrades/attack-speed-v2.png';
import moveSpeedIcon from '@/assets/icons-runtime/upgrades/move-speed-v2.png';
import damageIcon from '@/assets/icons-runtime/upgrades/damage-v2.png';
import armorIcon from '@/assets/icons-runtime/upgrades/armor-v2.png';
import pistolIcon from '@/assets/icons-runtime/upgrades/arsenal-pistol-v2.png';
import automaticIcon from '@/assets/icons-runtime/upgrades/arsenal-automatic-v2.png';
import shotgunIcon from '@/assets/icons-runtime/upgrades/arsenal-shotgun-v2.png';
import heavyIcon from '@/assets/icons-runtime/upgrades/arsenal-heavy-v2.png';
import energyIcon from '@/assets/icons-runtime/upgrades/arsenal-energy-v2.png';
import { EMPTY_IMPLANTS, IMPLANT_STEP, IMPLANT_LIMIT, validateImplants, applyImplants } from '@/gameplay/implants';
import { EMPTY_ARSENAL, ARSENAL_STEP, ARSENAL_LIMIT, validateArsenal, arsenalBonuses } from '@/gameplay/arsenal';
import type { ArsenalAllocation } from '@/gameplay/arsenal';
import { BASE_STATS } from '@/gameplay/stats';
import type { ImplantAllocation } from '@/gameplay/implants';
import './upgrades.css';
import './rewards.css';

// Implant and arsenal allocations use independent point budgets.
const implantSymbols = [
    '<circle cx="32" cy="35" r="13"/><path d="M16 8v16M25 5v14M39 5v14M48 8v16M13 34a19 19 0 0 0 38 0"/>',
    '<path d="M12 48C8 17 43 7 51 27M17 52C10 28 37 16 46 32M24 53C17 36 34 27 39 38M31 51l3-9"/>',
    '<circle cx="35" cy="28" r="14"/><path d="M23 19C10 25 9 41 13 51M28 26C18 33 16 45 20 53M34 35l-7 18"/>',
    '<path d="M12 14l20 18-20 18M30 14l20 18-20 18"/>',
    '<circle cx="32" cy="32" r="19"/><path d="M7 17h50M7 47h50"/>',
];
const confirmedImplants: Record<number, { id: keyof ImplantAllocation; name: string; description: string; source: string }> = {
    0: { id: 'health', name: 'Здоровье', description: 'Каждый плюс: +5 к прокачке и +10 ХП выбранному герою на игру.', source: healthIcon },
    1: { id: 'attackSpeed', name: 'Скорость стрельбы', description: 'Каждый плюс: +5 к прокачке и +2% скорости стрельбы выбранного героя.', source: attackSpeedIcon },
    2: { id: 'damage', name: 'Урон', description: 'Каждый плюс: +5 к прокачке и +5% урона выбранного героя.', source: damageIcon },
    3: { id: 'moveSpeed', name: 'Скорость бега', description: 'Каждый плюс: +5 к прокачке и +3% скорости бега выбранного героя.', source: moveSpeedIcon },
    4: { id: 'armor', name: 'Броня', description: 'Каждый плюс: +5 к прокачке и снижение входящего урона на 2%.', source: armorIcon },
};
const arsenal: { id: keyof ArsenalAllocation; name: string; source: string }[] = [
    { id: 'sidearm', name: 'Пистолеты', source: pistolIcon },
    { id: 'automatic', name: 'Автоматы', source: automaticIcon },
    { id: 'shotgun', name: 'Дробовики', source: shotgunIcon },
    { id: 'special', name: 'Тяжёлые', source: heavyIcon },
    { id: 'scientific', name: 'Энергетическое оружие', source: energyIcon },
];

function card(icon: string, name: string, color: number, description = name, artwork = false): string {
    return `<div class="upgrade-card" role="group" aria-label="${name}">
        <div class="upgrade-icon upgrade-color-${color}${artwork ? ' upgrade-icon-artwork' : ''}" title="${name}: ${description}">${icon}</div>
        <span class="upgrade-value" aria-label="Уровень улучшения: 0">0</span>
        <div class="upgrade-controls"><button type="button" disabled aria-label="Уменьшить: ${name}">−</button><button type="button" disabled aria-label="Увеличить: ${name}">+</button></div>
    </div>`;
}

export class UpgradesScreen {
    readonly element = document.createElement('section');
    private readonly tooltip = document.createElement('aside');
    private readonly events = new AbortController();
    private activePosition?: number;

    private allocation: ImplantAllocation = this.restore();
    private arsenalAllocation: ArsenalAllocation = this.restoreArsenal();
    get arsenal(): ArsenalAllocation { return { ...this.arsenalAllocation }; }
    get implants(): ImplantAllocation { return { ...this.allocation }; }

    constructor(private readonly onChange: () => void = () => {}) {
        this.element.className = 'character-frame upgrades-frame';
        this.element.hidden = true;
        this.element.setAttribute('aria-label', 'Улучшения');
        this.element.innerHTML = `
            <div class="upgrade-points"><button disabled aria-label="Добавить очки улучшения">+</button><span class="upgrade-point-emblem" aria-hidden="true">▲</span><b aria-label="Очки пока недоступны">—</b><span>Очки улучшения</span></div>
            <section class="upgrade-section" aria-labelledby="implants-heading">
                <h2 id="implants-heading">Имплантанты: <span>0 / —</span></h2>
                <div class="upgrade-cards">${implantSymbols.map((symbol, i) => {
                    const implant = confirmedImplants[i];
                    return implant
                        ? card(`<img src="${implant.source}" alt=""/>`, implant.name, i, implant.description, true)
                        : card(`<svg viewBox="0 0 64 64" aria-hidden="true">${symbol}</svg>`, `Имплант ${i + 1}`, i);
                }).join('')}</div>
            </section>
            <section class="upgrade-section" aria-labelledby="arsenal-heading">
                <h2 id="arsenal-heading">Улучшения арсенала: <span>0 / —</span></h2>
                <div class="upgrade-cards">${arsenal.map((item, i) => card(`<img src="${item.source}" alt=""/>`, item.name, i + 5, item.name, true)).join('')}</div>
            </section>`;
        this.tooltip.id = 'implant-tooltip';
        this.tooltip.className = 'award-tooltip implant-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.setAttribute('aria-hidden', 'true');
        document.body.append(this.tooltip);
        window.addEventListener('resize', () => this.hideTooltip(), { signal: this.events.signal });
        window.addEventListener('scroll', () => this.hideTooltip(), { capture: true, signal: this.events.signal });
        document.addEventListener('pointerdown', event => {
            if (event.target instanceof Node && !this.element.contains(event.target)) this.hideTooltip();
        }, { signal: this.events.signal });
        this.element.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.activePosition !== undefined) {
                event.stopPropagation();
                this.hideTooltip();
            }
        });
        const cards = this.element.querySelectorAll<HTMLElement>('.upgrade-card');
        cards.forEach((currentCard, position) => {
            const item = confirmedImplants[position] ?? arsenal[position - implantSymbols.length];
            const icon = currentCard.querySelector<HTMLElement>('.upgrade-icon')!;
            icon.removeAttribute('title');
            icon.tabIndex = 0;
            icon.setAttribute('aria-label', item.name);
            const show = () => this.showTooltip(position);
            currentCard.addEventListener('pointerenter', show);
            currentCard.addEventListener('pointerdown', show);
            currentCard.addEventListener('pointerleave', () => this.hideTooltip());
            currentCard.addEventListener('focusin', show);
            currentCard.addEventListener('focusout', event => {
                if (!(event.relatedTarget instanceof Node) || !currentCard.contains(event.relatedTarget)) this.hideTooltip();
            });
        });
        for (const [position, implant] of Object.entries(confirmedImplants)) {
            const currentCard = cards[Number(position)];
            const buttons = currentCard.querySelectorAll('button');
            buttons.forEach((button, index) => button.addEventListener('click', () => {
                const next = { ...this.allocation, [implant.id]: (this.allocation[implant.id] ?? 0) + (index ? IMPLANT_STEP : -IMPLANT_STEP) };
                try { validateImplants(next); } catch { return; }
                this.allocation = next;
                try { localStorage.setItem('mutant.implants.v1', JSON.stringify(next)); } catch { /* Session remains playable without storage. */ }
                this.refresh();
                this.onChange();
            }));
        }
        arsenal.forEach((item, position) => {
            const buttons = cards[position + implantSymbols.length].querySelectorAll('button');
            buttons.forEach((button, index) => button.addEventListener('click', () => {
                const next = { ...this.arsenalAllocation, [item.id]: this.arsenalAllocation[item.id] + (index ? ARSENAL_STEP : -ARSENAL_STEP) };
                try { validateArsenal(next); } catch { return; }
                this.arsenalAllocation = next;
                try { localStorage.setItem('mutant.arsenal.v1', JSON.stringify(next)); } catch { /* Keep session allocation if storage is unavailable. */ }
                this.refresh();
                this.onChange();
            }));
        });
        this.refresh();
    }

    hideTooltip(): void {
        this.activePosition = undefined;
        this.element.querySelectorAll('[aria-describedby="implant-tooltip"]').forEach(node => node.removeAttribute('aria-describedby'));
        this.tooltip.classList.remove('visible');
        this.tooltip.setAttribute('aria-hidden', 'true');
    }

    dispose(): void {
        this.events.abort();
        this.tooltip.remove();
    }

    private showTooltip(position: number): void {
        this.activePosition = position;
        this.element.querySelectorAll('[aria-describedby="implant-tooltip"]').forEach(node => node.removeAttribute('aria-describedby'));
        const currentCard = this.element.querySelectorAll('.upgrade-card')[position];
        currentCard.querySelectorAll('.upgrade-icon, button').forEach(node => node.setAttribute('aria-describedby', this.tooltip.id));
        const implant = confirmedImplants[position];
        const stats = applyImplants(BASE_STATS, this.allocation);
        const percent = (value: number) => Math.round(value * 100);
        const bonuses: Record<keyof ImplantAllocation, string> = {
            health: `+${stats.maxHp - BASE_STATS.maxHp} ХП`,
            attackSpeed: `+${percent(stats.attackSpeed / BASE_STATS.attackSpeed - 1)}% к скорости стрельбы`,
            damage: `+${percent(stats.damage / BASE_STATS.damage - 1)}% к урону`,
            moveSpeed: `+${percent(stats.speed / BASE_STATS.speed - 1)}% к скорости бега`,
            armor: `Снижение входящего урона: ${percent(stats.damageReduction)}%`,
        };
        const arsenalItem = arsenal[position - implantSymbols.length];
        const item = implant ?? arsenalItem;
        const weaponBonus = !implant ? arsenalBonuses(this.arsenalAllocation[arsenalItem.id]) : undefined;
        const bonus = implant
            ? `<div class="tooltip-bonus">${bonuses[implant.id]}</div>`
            : `<div class="tooltip-bonus">+${percent(weaponBonus!.attackSpeed)}% к скорострельности<br/>+${percent(weaponBonus!.damage)}% к урону${arsenalItem.id === 'sidearm' ? '' : `<br/>+${percent(weaponBonus!.ammo)}% к начальному запасу патронов`}</div>`;
        this.tooltip.innerHTML = `<div class="tooltip-heading"><img src="${item.source}" alt=""/><strong>${item.name}</strong></div>${bonus}`;
        this.tooltip.classList.add('visible');
        this.tooltip.setAttribute('aria-hidden', 'false');
        const anchor = currentCard.getBoundingClientRect();
        const tip = this.tooltip.getBoundingClientRect();
        const left = anchor.right + tip.width + 12 <= window.innerWidth - 10
            ? anchor.right + 12 : anchor.left - tip.width - 12;
        this.tooltip.style.left = `${Math.max(10, Math.min(left, window.innerWidth - tip.width - 10))}px`;
        this.tooltip.style.top = `${Math.max(10, Math.min(anchor.top, window.innerHeight - tip.height - 10))}px`;
    }

    private restoreArsenal(): ArsenalAllocation {
        try {
            const saved = JSON.parse(localStorage.getItem('mutant.arsenal.v1') ?? 'null');
            validateArsenal(saved);
            return Object.fromEntries(arsenal.map(item => [item.id, saved[item.id]])) as ArsenalAllocation;
        } catch { return { ...EMPTY_ARSENAL }; }
    }

    private restore(): ImplantAllocation {
        try {
            const saved = JSON.parse(localStorage.getItem('mutant.implants.v1') ?? 'null');
            validateImplants(saved);
            return { health: saved.health, attackSpeed: saved.attackSpeed, moveSpeed: saved.moveSpeed, damage: saved.damage ?? 0, armor: saved.armor ?? 0 };
        } catch { return { ...EMPTY_IMPLANTS }; }
    }

    private refresh(): void {
        const arsenalTotal = Object.values(this.arsenalAllocation).reduce((sum, value) => sum + value, 0);
        this.element.querySelector('#arsenal-heading span')!.textContent = `${arsenalTotal} / ${ARSENAL_LIMIT}`;
        const arsenalCards = this.element.querySelectorAll<HTMLElement>('.upgrade-section:last-of-type .upgrade-card');
        arsenal.forEach((item, index) => {
            const points = this.arsenalAllocation[item.id];
            const value = arsenalCards[index].querySelector('.upgrade-value')!;
            value.textContent = String(points);
            value.setAttribute('aria-label', `Прокачка: ${points}`);
            const buttons = arsenalCards[index].querySelectorAll('button');
            buttons[0].disabled = points === 0;
            buttons[1].disabled = arsenalTotal >= ARSENAL_LIMIT;
        });
        const total = Object.values(this.allocation).reduce((sum, value) => sum + value, 0);
        this.element.querySelector('#implants-heading span')!.textContent = `${total} / ${IMPLANT_LIMIT}`;
        const remaining = this.element.querySelector('.upgrade-points b')!;
        remaining.textContent = `${IMPLANT_LIMIT - total} / ${ARSENAL_LIMIT - arsenalTotal}`;
        remaining.setAttribute('aria-label', `Свободные очки: импланты ${IMPLANT_LIMIT - total}, арсенал ${ARSENAL_LIMIT - arsenalTotal}`);
        remaining.setAttribute('title', 'Свободные очки: импланты / арсенал');
        const cards = this.element.querySelectorAll<HTMLElement>('.upgrade-section:first-of-type .upgrade-card');
        for (const [position, implant] of Object.entries(confirmedImplants)) {
            const card = cards[Number(position)];
            const value = card.querySelector('.upgrade-value')!;
            const points = this.allocation[implant.id] ?? 0;
            value.textContent = String(points);
            value.setAttribute('aria-label', `Прокачка: ${points}`);
            const buttons = card.querySelectorAll('button');
            buttons[0].disabled = points === 0;
            buttons[1].disabled = total >= IMPLANT_LIMIT;
        }
        if (this.activePosition !== undefined) this.showTooltip(this.activePosition);
    }
}
