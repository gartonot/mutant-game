import { EquipmentDraft } from '@/gameplay/EquipmentDraft';
import { CONSUMABLE_SLOT_COUNT, DEFAULT_CONSUMABLE_SLOTS_UNLOCKED } from '@/gameplay/Consumables';
import { GOLD_PICKUP_KINDS } from '@/gameplay/PickupVariants';
import type { GoldPickupKind, PickupTier } from '@/gameplay/PickupVariants';
import { getPickupBlast } from '@/gameplay/PickupBlasts';
import { bonusArtUrl } from '@/rendering/BonusArt';
import type { CharacterId, WeaponCategory } from '@/gameplay/ids';
import { WEAPON_SLOTS } from '@/gameplay/loadout';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import { inventoryWeaponIcon as weaponIcon, refreshWeaponIconsWhenReady } from '@/rendering/InventoryWeaponArt';
import './equipment.css';
import { EquipmentFlight } from './EquipmentFlight';

const categories: Record<WeaponCategory, string> = {
    sidearm: 'Пистолеты', automatic: 'Автоматы', shotgun: 'Дробовики', special: 'Особое оружие', scientific: 'Энергетическое',
};

const bonusNames: Record<GoldPickupKind, string> = {
    health: 'Аптечка', rapidFire: 'Скорострельность', moveSpeed: 'Скорость',
    doubleDamage: 'Урон', shield: 'Щит', iceBlast: 'Ледяная волна', fireBlast: 'Огненная волна',
};
const bonusTiers: readonly PickupTier[] = ['silver', 'gold'];
const tierName = (tier: PickupTier) => tier === 'gold' ? 'Золотой' : 'Серебряный';

function bonusDescription(kind: GoldPickupKind, tier: PickupTier): string {
    const gold = tier === 'gold';
    switch (kind) {
        case 'health': return `Восстанавливает до ${gold ? 100 : 50} ХП за 0,4 с, не выше максимума.`;
        case 'rapidFire': return `Скорострельность ×${gold ? 4 : 2} на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'moveSpeed': return `Скорость движения ×${gold ? 3 : '1,5'} на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'doubleDamage': return `Урон ×${gold ? 4 : 2} на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'shield': return `Снижает получаемый урон на ${gold ? 75 : 50}% на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'iceBlast': {
            const blast = getPickupBlast(kind, tier);
            return `Наносит ${blast.damage} урона врагам в радиусе ${blast.radius} и снижает их скорость на ${(1 - blast.slowFactor) * 100}% на ${blast.slowMs / 1000} с.`;
        }
        case 'fireBlast': {
            const blast = getPickupBlast(kind, tier);
            return `Наносит ${blast.damage} урона всем врагам в радиусе ${blast.radius}.`;
        }
    }
}

export class EquipmentScreen {
    private readonly events = new AbortController();
    private readonly flight = new EquipmentFlight();
    readonly element = document.createElement('section');
    readonly draft = new EquipmentDraft();
    private character: CharacterId = 'mercenary';
    private readonly tooltip = document.createElement('div');
    constructor(private readonly onChange: () => void) {
        this.element.className = 'equipment-frame character-frame';
        this.element.setAttribute('aria-label', 'Снаряжение');
        this.element.hidden = true;
        this.tooltip.className = 'equipment-tooltip';
        this.tooltip.id = 'equipment-weapon-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.hidden = true;
        document.body.append(this.tooltip);
        this.element.addEventListener('mouseleave', () => this.hideTooltip());
        this.element.addEventListener('scroll', () => this.hideTooltip(), true);
        this.element.addEventListener('keydown', event => { if (event.key === 'Escape' && !this.tooltip.hidden) { event.stopPropagation(); this.hideTooltip(); } });
        window.addEventListener('resize', () => { this.hideTooltip(); this.flight.cancel(); }, { signal: this.events.signal });
        window.addEventListener('scroll', () => this.hideTooltip(), { capture: true, signal: this.events.signal });
        this.render();
    }
    prepareArtwork(): void { refreshWeaponIconsWhenReady(this.element); }
    setCharacter(character: CharacterId): void { this.character = character; this.render(); }
    dispose(): void {
        this.flight.cancel();
        this.events.abort();
        this.tooltip.remove();
        this.element.remove();
    }
    private render(): void {
        // Cards are recreated below, so CSS transitions alone cannot preserve their old appearance.
        // Capture the current animated values too, keeping quick selection changes continuous.
        const weaponAppearance = new Map<string, { opacity: string; filter: string }>();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.element.querySelectorAll<HTMLElement>('[data-weapon]').forEach(card => {
                const style = getComputedStyle(card);
                weaponAppearance.set(card.dataset.weapon!, { opacity: style.opacity, filter: style.filter });
            });
        }
        this.flight.cancel();
        const scrollTop = this.element.querySelector('.equipment-catalog')?.scrollTop ?? 0;
        const loadout = this.draft.get(this.character);
        const consumables = loadout.consumables ?? [];
        const unlocked = loadout.consumableSlotsUnlocked ?? DEFAULT_CONSUMABLE_SLOTS_UNLOCKED;
        this.hideTooltip();
        const order = ['rifle', 'shotgun', 'flamethrower', 'plasma-cannon', 'm16', 'machine-gun', 'ak47', 'plasma-auto', 'laser', 'skull-launcher', 'plasma-grenade', 'double-barrel', 'grenade-launcher', 'tesla', 'impulse', 'acid-gun', 'crossbow', 'disc-launcher'];
        const visibleWeapons = Object.values(WEAPON_DEFINITIONS).filter(weapon => weapon.id !== 'pistol')
            .sort((a, b) => (order.indexOf(a.id) < 0 ? 99 : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? 99 : order.indexOf(b.id)));
        this.element.innerHTML = `
            <div class="equipment-top">
                <section class="equipment-box"><h2>Твоё оружие</h2><div class="equipment-slots" role="group" aria-label="Слоты оружия">
                ${WEAPON_SLOTS.filter(slot => !slot.fixedWeapon).map(slot => {
        const entry = loadout.weapons.find(item => item.slotId === slot.id);
        const weapon = entry && WEAPON_DEFINITIONS[entry.weaponId];
        return `<button class="equipment-slot" data-slot="${slot.id}" ${weapon ? `data-info="${weapon.id}"` : ''} aria-label="Слот ${slot.id}: ${weapon?.name ?? 'Пусто'}">
                        ${weapon ? `<img data-weapon-art="${weapon.id}" src="${weaponIcon(weapon.id)}" alt=""/>` : '<span class="empty-slot">+</span>'}</button>`;
    }).join('')}</div></section>
                <section class="equipment-box"><h2>Твои бонусы <small>${consumables.length} / ${unlocked}</small></h2><div class="bonus-slots" role="group" aria-label="Слоты бонусов, клавиши 1–6">
                    ${Array.from({ length: CONSUMABLE_SLOT_COUNT }, (_, i) => {
            const entry = consumables.find(item => item.slotIndex === i);
            const locked = i >= unlocked;
            return `<button class="bonus-placeholder bonus-slot ${locked ? 'locked' : ''}" data-bonus-slot="${i}" ${entry ? `data-bonus-info="${entry.kind}" data-tier="${entry.tier}"` : ''} ${locked ? 'disabled' : ''} aria-label="Бонус ${i + 1}: ${locked ? 'заблокирован' : entry ? `${bonusNames[entry.kind]}, ${tierName(entry.tier).toLowerCase()}. Нажми, чтобы снять` : 'пусто'}"><span class="bonus-slot-number">${i + 1}</span>${locked ? '<span aria-hidden="true">🔒</span>' : entry ? `<img src="${bonusArtUrl(entry.kind, entry.tier)}" alt=""/>` : '<span aria-hidden="true">+</span>'}</button>`;
        }).join('')}
                </div><p class="equipment-bonus-hint">Клавиши 1–6 · одно применение за бой</p></section>
            </div>
            <div class="equipment-currency"><span class="equipment-gear" aria-hidden="true">⚙</span><span>Очки снаряжения <b>—</b></span><button disabled>Обменять</button><small>Обмен пока недоступен</small></div>
            <div class="equipment-catalog" role="group" aria-label="Каталог оружия и бонусов">
                <h3 class="equipment-catalog-heading">Оружие</h3>
                ${visibleWeapons.map(weapon => {
        const slot = this.draft.slotFor(weapon.id);
        const equipped = loadout.weapons.some(entry => entry.weaponId === weapon.id);
        const disabled = !!slot.fixedWeapon || (!equipped && !this.draft.canEquip(this.character, weapon.id));
        return `<button class="equipment-item" data-weapon="${weapon.id}" data-finish="${weapon.category === 'scientific' ? 'blue' : weapon.category === 'special' ? 'olive' : ['rifle', 'shotgun'].includes(weapon.id) ? 'steel' : 'olive'}" data-info="${weapon.id}" aria-pressed="${equipped}" aria-disabled="${disabled}" aria-label="${equipped ? 'Снять' : 'Выбрать'} ${weapon.name}"><img data-weapon-art="${weapon.id}" src="${weaponIcon(weapon.id)}" alt=""/></button>`;
    }).join('')}
                <h3 class="equipment-catalog-heading">Бонусы <small>Выбери серебряную или золотую версию каждого бонуса</small></h3>
                ${bonusTiers.flatMap(tier => GOLD_PICKUP_KINDS.map(kind => {
            const equipped = consumables.find(entry => entry.kind === kind && entry.tier === tier);
            const disabled = !equipped && !this.draft.canEquipConsumable(this.character, kind, tier);
            return `<button class="equipment-item equipment-bonus-item" data-bonus="${kind}" data-tier="${tier}" data-bonus-info="${kind}" aria-pressed="${!!equipped}" aria-disabled="${disabled}" aria-label="${equipped ? 'Снять' : 'Выбрать'} ${bonusNames[kind]}, ${tierName(tier).toLowerCase()}"><img src="${bonusArtUrl(kind, tier)}" alt=""/><span class="equipment-bonus-name">${bonusNames[kind]}</span><span class="equipment-bonus-tier">${equipped ? 'Выбрано' : tierName(tier)}</span></button>`;
        })).join('')}
            </div>
            <span class="equipment-sr-status" role="status">Выбрано ${loadout.weapons.length - 1} из 4 дополнительных оружий. Бонусов: ${consumables.length} из ${unlocked}</span>`;
        this.element.querySelectorAll<HTMLButtonElement>('[data-bonus-slot]').forEach(button => button.addEventListener('click', () => {
            const slotIndex = Number(button.dataset.bonusSlot);
            if (slotIndex >= unlocked) return;
            const entry = this.draft.get(this.character).consumables?.find(item => item.slotIndex === slotIndex);
            if (!entry) return;
            const source = this.flight.capture(button);
            this.draft.assignConsumable(this.character, slotIndex, null);
            this.render(); this.onChange();
            this.element.querySelector<HTMLButtonElement>(`[data-bonus-slot="${slotIndex}"]`)!.focus({ preventScroll: true });
            this.hideTooltip();
            this.flight.play(source, this.element.querySelector(`[data-bonus="${entry.kind}"][data-tier="${entry.tier}"]`), this.element);
        }));
        this.element.querySelectorAll<HTMLButtonElement>('[data-bonus]').forEach(button => button.addEventListener('click', () => {
            const kind = button.dataset.bonus as GoldPickupKind;
            const tier = button.dataset.tier as PickupTier;
            const equipped = this.draft.get(this.character).consumables?.find(entry => entry.kind === kind && entry.tier === tier);
            const source = this.flight.capture(equipped
                ? this.element.querySelector(`[data-bonus-slot="${equipped.slotIndex}"]`)!
                : button);
            let addedSlot: number | undefined;
            if (equipped) this.draft.assignConsumable(this.character, equipped.slotIndex, null);
            else if (this.draft.canEquipConsumable(this.character, kind, tier)) addedSlot = this.draft.equipConsumable(this.character, kind, tier);
            else return;
            this.render(); this.onChange();
            this.element.querySelector<HTMLButtonElement>(`[data-bonus="${kind}"][data-tier="${tier}"]`)!.focus({ preventScroll: true });
            if (addedSlot !== undefined) {
                this.hideTooltip();
                this.flight.play(source, this.element.querySelector(`[data-bonus-slot="${addedSlot}"]`), this.element);
            } else if (equipped) {
                this.hideTooltip();
                this.flight.play(source, this.element.querySelector(`[data-bonus="${kind}"][data-tier="${tier}"]`), this.element);
            }
        }));
        this.element.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(button => button.addEventListener('click', () => {
            const slotId = button.dataset.slot!;
            const entry = this.draft.get(this.character).weapons.find(item => item.slotId === slotId);
            if (!entry) return;
            const source = this.flight.capture(button);
            this.draft.assign(this.character, slotId, null); this.render(); this.onChange();
            refreshWeaponIconsWhenReady(this.element);
            this.element.querySelector<HTMLButtonElement>(`[data-slot="${slotId}"]`)!.focus({ preventScroll: true });
            this.hideTooltip();
            this.flight.play(source, this.element.querySelector(`[data-weapon="${entry.weaponId}"]`), this.element);
        }));
        visibleWeapons.forEach(weapon => this.element.querySelector(`[data-weapon="${weapon.id}"]`)!.addEventListener('click', () => {
            let addedSlot: string | undefined;
            const equipped = this.draft.get(this.character).weapons.find(entry => entry.weaponId === weapon.id);
            const source = this.flight.capture(this.element.querySelector(equipped
                ? `[data-slot="${equipped.slotId}"]` : `[data-weapon="${weapon.id}"]`)!);
            if (equipped) this.draft.assign(this.character, equipped.slotId, null);
            else if (this.draft.canEquip(this.character, weapon.id)) addedSlot = this.draft.equip(this.character, weapon.id);
            else return;
            this.render();
        refreshWeaponIconsWhenReady(this.element); this.onChange();
            this.element.querySelector<HTMLButtonElement>(`[data-weapon="${weapon.id}"]`)!.focus({ preventScroll: true });
            if (addedSlot !== undefined) {
                this.hideTooltip();
                this.flight.play(source, this.element.querySelector(`[data-slot="${addedSlot}"]`), this.element);
            } else if (equipped) {
                this.hideTooltip();
                this.flight.play(source, this.element.querySelector(`[data-weapon="${weapon.id}"]`), this.element);
            }
        }));
        this.element.querySelector('.equipment-catalog')!.scrollTop = scrollTop;
        this.element.querySelectorAll<HTMLElement>('[data-weapon]').forEach(card => {
            const previous = weaponAppearance.get(card.dataset.weapon!);
            if (!previous) return;
            const style = getComputedStyle(card);
            if (Math.abs(Number(previous.opacity) - Number(style.opacity)) < .001) return;
            card.animate([previous, { opacity: style.opacity, filter: style.filter }],
                { duration: 320, easing: 'ease-in-out' });
        });
        this.element.querySelectorAll<HTMLButtonElement>('[data-info], [data-bonus-info]').forEach(button => {
            const show = () => this.showTooltip(button);
            button.addEventListener('mouseenter', show);
            button.addEventListener('focus', show);
            button.addEventListener('mouseleave', () => this.hideTooltip());
            button.addEventListener('blur', () => this.hideTooltip());
        });
    }
    private hideTooltip(): void {
        this.tooltip.hidden = true;
        this.element.querySelectorAll('[aria-describedby]').forEach(node => node.removeAttribute('aria-describedby'));
    }
    private showTooltip(button: HTMLButtonElement): void {
        this.hideTooltip();
        this.tooltip.dataset.tier = button.dataset.tier ?? 'silver';
        if (button.dataset.bonusInfo) {
            const kind = button.dataset.bonusInfo as GoldPickupKind;
            const tier = button.dataset.tier as PickupTier;
            const selected = this.draft.get(this.character).consumables ?? [];
            const equipped = selected.find(entry => entry.kind === kind && entry.tier === tier);
            const otherTier = selected.some(entry => entry.kind === kind && entry.tier !== tier);
            const blocked = !equipped && !this.draft.canEquipConsumable(this.character, kind, tier);
            const action = equipped ? 'Выбрано · нажми, чтобы снять' : otherTier ? 'Сначала сними другую версию этого бонуса' : blocked ? 'Все доступные слоты заняты — сначала сними бонус' : 'Нажмите чтобы добавить';
            this.tooltip.innerHTML = `<div class="equipment-tooltip-body"><strong>${bonusNames[kind]} · ${tierName(tier).toLowerCase()}</strong><p>${bonusDescription(kind, tier)}</p><small>${action}</small></div>`;
        } else {
            const weapon = WEAPON_DEFINITIONS[button.dataset.info as keyof typeof WEAPON_DEFINITIONS];
            const equipped = this.draft.get(this.character).weapons.some(entry => entry.weaponId === weapon.id);
            const blocked = !equipped && !this.draft.canEquip(this.character, weapon.id);
            this.tooltip.innerHTML = `<div class="equipment-tooltip-body"><strong>${weapon.name}</strong><p>+${weapon.ammo.kind === 'finite' ? weapon.ammo.initial : '∞'} патронов</p><p>${weapon.description ?? ''}</p><small>${equipped ? 'Нажми, чтобы снять' : blocked ? 'Сначала сними оружие этого типа' : categories[weapon.category] + ' · нажми, чтобы выбрать'}</small></div>`;
        }
        this.tooltip.hidden = false;
        button.setAttribute('aria-describedby', this.tooltip.id);
        const anchor = button.getBoundingClientRect(), tip = this.tooltip.getBoundingClientRect();
        this.tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tip.width - 8, anchor.left + anchor.width / 2 - tip.width / 2))}px`;
        const top = anchor.top - tip.height - 10;
        this.tooltip.style.top = `${Math.max(8, top >= 8 ? top : Math.min(anchor.bottom + 10, window.innerHeight - tip.height - 8))}px`;
    }
}
