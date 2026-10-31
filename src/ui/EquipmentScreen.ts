import { EquipmentDraft } from '@/gameplay/EquipmentDraft';
import { CHARACTER_DEFINITIONS } from '@/gameplay/characters';
import { CONSUMABLE_SLOT_COUNT, DEFAULT_CONSUMABLE_SLOTS_UNLOCKED, validateConsumables } from '@/gameplay/Consumables';
import type { ConsumableSelection } from '@/gameplay/Consumables';
import { GOLD_PICKUP_KINDS } from '@/gameplay/PickupVariants';
import type { GoldPickupKind, PickupTier } from '@/gameplay/PickupVariants';
import { getPickupBlast } from '@/gameplay/PickupBlasts';
import { equipmentBonusIcon as bonusArtUrl, refreshEquipmentArtwork } from './EquipmentArtwork';
import type { CharacterId, WeaponCategory, WeaponId } from '@/gameplay/ids';
import { WEAPON_SLOTS } from '@/gameplay/loadout';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import { prepareUpgradeArtwork, upgradeArtwork } from './UpgradeArtwork';
import { EquipmentFlight } from './EquipmentFlight';
import './equipment.css';

const categories: Record<WeaponCategory, string> = {
    sidearm: 'Пистолеты', automatic: 'Автоматы', shotgun: 'Дробовики', special: 'Особое оружие', scientific: 'Энергетическое',
};
const horizontalWeapons = import.meta.glob('../assets/weapons-runtime/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const weaponIcon = (id: WeaponId) => horizontalWeapons[`../assets/weapons-runtime/${id}.webp`];
const ammoIcons = import.meta.glob('../assets/icons-runtime/ammo/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ammoIcon = (category: WeaponCategory) => ammoIcons[`../assets/icons-runtime/ammo/${category === 'sidearm' ? 'infinite' : category}.png`];
const bonusNames: Record<GoldPickupKind, string> = {
    health: 'Аптечка', rapidFire: 'Скорострельность', moveSpeed: 'Скорость', doubleDamage: 'Урон', shield: 'Щит', iceBlast: 'Ледяная волна', fireBlast: 'Огненная волна',
};
const bonusTiers: readonly PickupTier[] = ['silver', 'gold'];
const tierName = (tier: PickupTier) => tier === 'gold' ? 'Золотой' : 'Серебряный';
const lock = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M6 11V7a6 6 0 0 1 12 0v4" fill="none" stroke="currentColor" stroke-width="3"/><rect x="3" y="10" width="18" height="17" rx="3" fill="currentColor"/><path d="M12 16v6" stroke="#18221b" stroke-width="3"/></svg>';

function bonusDescription(kind: GoldPickupKind, tier: PickupTier): string {
    const gold = tier === 'gold';
    switch (kind) {
        case 'health': return `Восстанавливает до ${gold ? 100 : 50} ХП за 0,4 с, не выше максимума.`;
        case 'rapidFire': return `Скорострельность ×${gold ? 4 : 2} на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'moveSpeed': return `Скорость движения ×${gold ? 3 : '1,5'} на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'doubleDamage': return `Урон ×${gold ? 4 : 2} на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'shield': return `Снижает получаемый урон на ${gold ? 75 : 50}% на 10 с. Длительность учитывает улучшения персонажа.`;
        case 'iceBlast': { const b = getPickupBlast(kind, tier); return `Наносит ${b.damage} урона врагам в радиусе ${b.radius} и снижает их скорость на ${(1 - b.slowFactor) * 100}% на ${b.slowMs / 1000} с.`; }
        case 'fireBlast': { const b = getPickupBlast(kind, tier); return `Наносит ${b.damage} урона всем врагам в радиусе ${b.radius}.`; }
    }
}
function bonusSummary(kind: GoldPickupKind, tier: PickupTier): string {
    const gold = tier === 'gold';
    switch (kind) {
        case 'health': return `${gold ? 100 : 50} ХП`;
        case 'rapidFire': return `×${gold ? 4 : 2} · 10 сек.`;
        case 'moveSpeed': return `×${gold ? 3 : '1,5'} · 10 сек.`;
        case 'doubleDamage': return `×${gold ? 4 : 2} · 10 сек.`;
        case 'shield': return `−${gold ? 75 : 50}% урона · 10 сек.`;
        case 'iceBlast': return gold ? 'Усиленная волна' : 'Урон и замедление';
        case 'fireBlast': return gold ? 'Усиленный взрыв' : 'Урон по площади';
    }
}

export class EquipmentScreen {
    private readonly events = new AbortController();
    private readonly flight = new EquipmentFlight();
    readonly element = document.createElement('section');
    readonly sidebar = document.createElement('aside');
    readonly draft = new EquipmentDraft();
    private readonly drawerLayer = document.createElement('div');
    private character: CharacterId = 'mercenary';
    private readonly tooltip = document.createElement('div');
    private renderedCharacter?: CharacterId;
    private bonusDraft?: ConsumableSelection[];
    private drawerTriggerIndex = 0;
    private finishDrawerClose?: () => void;
    private suppressedTooltip?: string;
    private tooltipTimer?: ReturnType<typeof setTimeout>;
    private readonly tooltipBindings = new WeakSet<HTMLElement>();

    constructor(private readonly onChange: () => void, private readonly onOpenUpgrade: (section: 'weapons' | 'implants') => void = () => {}) {
        this.element.className = 'equipment-frame character-frame';
        this.element.setAttribute('aria-label', 'Арсенал'); this.element.hidden = true;
        this.sidebar.className = 'arsenal-sidebar'; this.sidebar.setAttribute('aria-label', 'Персонаж и характеристики');
        this.drawerLayer.className = 'arsenal-drawer-layer'; this.drawerLayer.hidden = true;
        this.tooltip.className = 'equipment-tooltip'; this.tooltip.id = 'equipment-weapon-tooltip';
        this.tooltip.setAttribute('role', 'tooltip'); this.tooltip.hidden = true; document.body.append(this.tooltip);
        this.element.addEventListener('mouseleave', () => { this.suppressedTooltip = undefined; this.hideTooltip(); });
        const dismissClickedTooltip = (event: Event) => {
            const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-info], [data-bonus-info], [data-ability-info]') : null;
            if (!button) return;
            this.suppressedTooltip = this.tooltipKey(button);
            this.hideTooltip();
        };
        this.element.addEventListener('pointerdown', dismissClickedTooltip, true);
        this.element.addEventListener('click', dismissClickedTooltip, true);
        this.element.addEventListener('scroll', () => this.hideTooltip(), true);
        this.element.addEventListener('keydown', event => {
            if (event.key === 'Tab') this.suppressedTooltip = undefined;
            if (this.bonusDraft) {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.closeDrawer(); }
                else if (event.key === 'Tab') this.trapDrawerFocus(event);
            } else if (event.key === 'Escape' && this.tooltip.classList.contains('visible')) { event.stopPropagation(); this.hideTooltip(); }
        });
        window.addEventListener('resize', () => { this.hideTooltip(); this.flight.cancel(); }, { signal: this.events.signal });
        window.addEventListener('scroll', () => this.hideTooltip(), { capture: true, signal: this.events.signal });
        document.addEventListener('pointerdown', event => {
            if (this.bonusDraft && event.target instanceof Node && !this.drawerLayer.querySelector('.arsenal-drawer')?.contains(event.target)) this.closeDrawer();
        }, { signal: this.events.signal });
    }
    prepareArtwork(): Promise<boolean> {
        if (this.renderedCharacter !== this.character) this.render();
        return Promise.all([refreshEquipmentArtwork(this.element), prepareUpgradeArtwork()]).then(results => results.every(Boolean));
    }
    setCharacter(character: CharacterId): void { this.closeDrawer(false); this.character = character; if (!this.element.hidden) this.render(); }
    closeDrawer(animate = true): void {
        this.flight.cancel();
        this.finishDrawerClose?.();
        const wasOpen = !!this.bonusDraft; this.bonusDraft = undefined;
        const panel = this.drawerLayer.querySelector<HTMLElement>('.bonus-drawer');
        const dim = this.drawerLayer.querySelector<HTMLElement>('.arsenal-drawer-dim');
        const motions: Animation[] = [];
        const finish = () => {
            motions.forEach(motion => motion.cancel());
            this.drawerLayer.hidden = true; this.drawerLayer.replaceChildren();
            this.drawerLayer.removeAttribute('inert'); this.drawerLayer.style.pointerEvents = '';
            this.finishDrawerClose = undefined;
        };
        if (wasOpen && animate && panel && this.element.getClientRects().length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.finishDrawerClose = finish;
            this.drawerLayer.setAttribute('inert', ''); this.drawerLayer.style.pointerEvents = 'none';
            const style = getComputedStyle(panel);
            const from = { transform: style.transform, opacity: style.opacity };
            const dimOpacity = dim ? getComputedStyle(dim).opacity : '1';
            panel.getAnimations().forEach(motion => motion.cancel());
            dim?.getAnimations().forEach(motion => motion.cancel());
            const slide = panel.animate([from, { transform: 'translateX(100%)', opacity: 0 }],
                { duration: 300, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' });
            motions.push(slide);
            if (dim) motions.push(dim.animate([{ opacity: dimOpacity }, { opacity: 0 }],
                { duration: 300, easing: 'ease-out', fill: 'forwards' }));
            void slide.finished.then(() => { if (this.finishDrawerClose === finish) finish(); }, () => {});
        } else finish();
        delete this.element.dataset.drawer;
        this.element.querySelector<HTMLElement>('.arsenal-main')?.removeAttribute('inert'); this.sidebar.removeAttribute('inert'); this.hideTooltip();
        if (wasOpen && this.element.getClientRects().length) this.element.querySelector<HTMLButtonElement>(`[data-open-bonuses="${this.drawerTriggerIndex}"]`)?.focus({ preventScroll: true });
    }
    dispose(): void { this.closeDrawer(false); this.flight.cancel(); this.events.abort(); this.tooltip.remove(); this.element.remove(); }
    private get unlockedSlots(): number { return this.draft.get(this.character).consumableSlotsUnlocked ?? DEFAULT_CONSUMABLE_SLOTS_UNLOCKED; }

    private render(): void {
        this.renderedCharacter = this.character;
        const weaponAppearance = new Map<string, { opacity: string; filter: string }>();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.element.querySelectorAll<HTMLElement>('[data-weapon]').forEach(card => {
            const style = getComputedStyle(card); weaponAppearance.set(card.dataset.weapon!, { opacity: style.opacity, filter: style.filter });
        });
        this.flight.cancel();
        const scrollTop = this.element.querySelector('.equipment-catalog')?.scrollTop ?? 0;
        const loadout = this.draft.get(this.character), consumables = loadout.consumables ?? [], unlocked = this.unlockedSlots;
        this.hideTooltip();
        const order = ['rifle', 'shotgun', 'flamethrower', 'plasma-cannon', 'm16', 'machine-gun', 'ak47', 'plasma-auto', 'laser', 'skull-launcher', 'plasma-grenade', 'double-barrel', 'grenade-launcher', 'tesla', 'impulse', 'acid-gun', 'crossbow', 'disc-launcher'];
        const visibleWeapons = Object.values(WEAPON_DEFINITIONS).filter(w => w.id !== 'pistol').sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        this.element.innerHTML = `<div class="arsenal-main"><div class="equipment-top">
            <section class="equipment-box arsenal-weapon-box"><h2>Твоё оружие</h2><div class="equipment-slots" role="group" aria-label="Слоты оружия">${WEAPON_SLOTS.filter(s => !s.fixedWeapon).map(slot => {
                const entry = loadout.weapons.find(e => e.slotId === slot.id), weapon = entry && WEAPON_DEFINITIONS[entry.weaponId];
                return `<button class="equipment-slot" data-slot="${slot.id}" ${weapon ? `data-info="${weapon.id}"` : ''} aria-label="Слот ${slot.id}: ${weapon?.name ?? `Пусто, ${slot.label}`}">${weapon ? `<img data-horizontal-weapon-art="${weapon.id}" src="${weaponIcon(weapon.id)}" alt=""/>` : `<img class="equipment-slot-type" src="${ammoIcon(slot.allowedCategories![0])}" alt="" aria-hidden="true"/><span class="empty-slot">+</span>`}</button>`;
            }).join('')}</div></section>
            <section class="equipment-box arsenal-bonus-box"><h2>Бонусы</h2><div class="bonus-slots" role="group" aria-label="Выбрать бонусы">${Array.from({ length: unlocked }, (_, i) => {
                const entry = consumables.find(e => e.slotIndex === i);
                return `<button class="bonus-placeholder bonus-slot" data-open-bonuses="${i}" ${entry ? `data-tier="${entry.tier}"` : ''} aria-label="Выбрать бонусы: слот ${i + 1}, ${entry ? bonusNames[entry.kind] : 'пусто'}">${entry ? `<img data-bonus-art="${entry.tier}:${entry.kind}" src="${bonusArtUrl(entry.kind, entry.tier)}" alt=""/>` : '<span aria-hidden="true">+</span>'}</button>`;
            }).join('')}</div></section>
            <section class="arsenal-upgrade-box"><h2>Улучшения</h2><div class="arsenal-upgrade-buttons">
                <button class="arsenal-upgrade-button" data-upgrade="weapons"><span class="arsenal-upgrade-mosaic">${upgradeArtwork('arsenal-energy-v2')}${upgradeArtwork('arsenal-automatic-v2')}${upgradeArtwork('arsenal-heavy-v2')}</span><span>Оружие</span></button>
                <button class="arsenal-upgrade-button" data-upgrade="implants"><span class="arsenal-upgrade-mosaic">${upgradeArtwork('health-v2')}${upgradeArtwork('move-speed-v2')}${upgradeArtwork('armor-v2')}</span><span>Импланты</span></button>
            </div></section>
        </div><div class="equipment-currency"><span class="equipment-gear" aria-hidden="true">⚙</span><span>Очки снаряжения <b>—</b></span><button disabled>Обменять</button><small>Обмен пока недоступен</small></div>
        <div class="equipment-catalog" role="group" aria-label="Каталог оружия"><h3 class="equipment-catalog-heading">Оружие</h3>${visibleWeapons.map(weapon => {
            const equipped = loadout.weapons.some(e => e.weaponId === weapon.id), disabled = !equipped && !this.draft.canEquip(this.character, weapon.id);
            return `<button class="equipment-item" data-weapon="${weapon.id}" data-finish="${weapon.category === 'scientific' ? 'blue' : ['rifle', 'shotgun'].includes(weapon.id) ? 'steel' : 'olive'}" data-info="${weapon.id}" aria-pressed="${equipped}" aria-disabled="${disabled}" aria-label="${equipped ? 'Снять' : 'Выбрать'} ${weapon.name}${disabled ? ': оружие данного типа уже выбрано' : ''}"><img data-horizontal-weapon-art="${weapon.id}" src="${weaponIcon(weapon.id)}" alt=""/><span class="equipment-item-label"><img class="equipment-ammo-icon" src="${ammoIcon(weapon.category)}" alt=""/><span>${weapon.name}</span></span></button>`;
        }).join('')}</div><span class="equipment-sr-status" role="status">Выбрано ${loadout.weapons.length - 1} из 4 дополнительных оружий. Бонусов: ${consumables.length} из ${unlocked}</span></div>`;
        this.element.prepend(this.sidebar); this.element.append(this.drawerLayer);
        this.element.querySelectorAll<HTMLButtonElement>('[data-open-bonuses]').forEach(b => b.addEventListener('click', () => this.openBonusDrawer(Number(b.dataset.openBonuses))));
        this.element.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b => b.addEventListener('click', () => { this.closeDrawer(); this.onOpenUpgrade(b.dataset.upgrade as 'weapons' | 'implants'); }));
        this.element.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(button => button.addEventListener('click', () => {
            const slotId = button.dataset.slot!, entry = this.draft.get(this.character).weapons.find(e => e.slotId === slotId); if (!entry) return;
            const source = this.flight.capture(button); this.draft.assign(this.character, slotId, null); this.render(); this.onChange();
            this.element.querySelector<HTMLButtonElement>(`[data-slot="${slotId}"]`)!.focus({ preventScroll: true }); this.hideTooltip();
            this.flight.play(source, this.element.querySelector(`[data-weapon="${entry.weaponId}"]`), this.element);
        }));
        visibleWeapons.forEach(weapon => this.element.querySelector<HTMLButtonElement>(`[data-weapon="${weapon.id}"]`)!.addEventListener('click', () => {
            let addedSlot: string | undefined; const equipped = this.draft.get(this.character).weapons.find(e => e.weaponId === weapon.id);
            const source = this.flight.capture(this.element.querySelector(equipped ? `[data-slot="${equipped.slotId}"]` : `[data-weapon="${weapon.id}"]`)!);
            if (equipped) this.draft.assign(this.character, equipped.slotId, null); else if (this.draft.canEquip(this.character, weapon.id)) addedSlot = this.draft.equip(this.character, weapon.id); else return;
            this.render(); this.onChange(); this.element.querySelector<HTMLButtonElement>(`[data-weapon="${weapon.id}"]`)!.focus({ preventScroll: true }); this.hideTooltip();
            this.flight.play(source, this.element.querySelector(addedSlot !== undefined ? `[data-slot="${addedSlot}"]` : `[data-weapon="${weapon.id}"]`), this.element);
        }));
        this.element.querySelector('.equipment-catalog')!.scrollTop = scrollTop;
        this.element.querySelectorAll<HTMLElement>('[data-weapon]').forEach(card => {
            const previous = weaponAppearance.get(card.dataset.weapon!); if (!previous) return;
            const style = getComputedStyle(card); if (Math.abs(Number(previous.opacity) - Number(style.opacity)) >= .001) card.animate([previous, { opacity: style.opacity, filter: style.filter }], { duration: 320, easing: 'ease-in-out' });
        });
        this.bindTooltips(this.element); void refreshEquipmentArtwork(this.element);
    }

    private openBonusDrawer(triggerIndex: number): void {
        this.finishDrawerClose?.();
        this.drawerTriggerIndex = triggerIndex; this.bonusDraft = (this.draft.get(this.character).consumables ?? []).map(e => ({ ...e }));
        this.element.dataset.drawer = 'bonuses'; this.element.querySelector('.arsenal-main')?.setAttribute('inert', ''); this.sidebar.setAttribute('inert', '');
        this.hideTooltip(); this.drawerLayer.hidden = false; this.renderBonusDrawer();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.drawerLayer.querySelector<HTMLElement>('.bonus-drawer')?.animate([
                { transform: 'translateX(100%)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 },
            ], { duration: 380, easing: 'cubic-bezier(.22,.7,.2,1)' });
            this.drawerLayer.querySelector<HTMLElement>('.arsenal-drawer-dim')?.animate([
                { opacity: 0 }, { opacity: 1 },
            ], { duration: 300, easing: 'ease-out' });
        }
        this.drawerLayer.querySelector<HTMLElement>('#bonus-drawer-heading')?.focus({ preventScroll: true });
    }
    private renderBonusDrawer(focusSelector?: string): void {
        const entries = this.bonusDraft; if (!entries) return; this.hideTooltip(); const unlocked = this.unlockedSlots;
        this.flight.cancel();
        const scrollTop = this.drawerLayer.querySelector('.bonus-drawer-catalog')?.scrollTop ?? 0;
        this.drawerLayer.innerHTML = `<button class="arsenal-drawer-dim" aria-label="Отменить изменения бонусов" tabindex="-1"></button><section class="arsenal-drawer bonus-drawer" role="dialog" aria-modal="true" aria-labelledby="bonus-drawer-heading">
        <h2 id="bonus-drawer-heading" tabindex="-1">Бонусы</h2><div class="bonus-drawer-set"><span>Твой набор</span><span class="bonus-drawer-counter" role="status">Выбрано ${entries.length} / ${unlocked}</span></div>
        <div class="bonus-drawer-slots" role="group" aria-label="Слоты бонусов, клавиши 1–6">${Array.from({ length: CONSUMABLE_SLOT_COUNT }, (_, i) => {
            const entry = entries.find(e => e.slotIndex === i), locked = i >= unlocked;
            return `<button class="bonus-placeholder bonus-slot${locked ? ' locked' : ''}" data-bonus-slot="${i}" ${entry ? `data-bonus-info="${entry.kind}" data-tier="${entry.tier}"` : ''} ${locked ? 'disabled' : ''} aria-label="Бонус ${i + 1}: ${locked ? 'заблокирован' : entry ? `${bonusNames[entry.kind]}, ${tierName(entry.tier).toLowerCase()}. Нажми, чтобы снять` : 'пусто'}"><span class="bonus-slot-number">${i + 1}</span>${locked ? `<span class="bonus-slot-lock">${lock}</span>` : entry ? `<img data-bonus-art="${entry.tier}:${entry.kind}" src="${bonusArtUrl(entry.kind, entry.tier)}" alt=""/>` : '<span aria-hidden="true">+</span>'}</button>`;
        }).join('')}</div><h3 class="bonus-drawer-catalog-heading">Доступные бонусы</h3><div class="bonus-drawer-catalog" role="group" aria-label="Доступные бонусы">${bonusTiers.flatMap(tier => GOLD_PICKUP_KINDS.map(kind => {
            const equipped = entries.some(e => e.kind === kind && e.tier === tier), blocked = !equipped && (entries.length >= unlocked || entries.some(e => e.kind === kind));
            return `<button class="equipment-item equipment-bonus-item" data-bonus="${kind}" data-tier="${tier}" data-bonus-info="${kind}" aria-pressed="${equipped}" aria-disabled="${blocked}" aria-label="${equipped ? 'Снять' : 'Выбрать'} ${bonusNames[kind]}, ${tierName(tier).toLowerCase()}"><img data-bonus-art="${tier}:${kind}" src="${bonusArtUrl(kind, tier)}" alt=""/><span class="equipment-bonus-name">${bonusNames[kind]}</span><span class="equipment-bonus-tier">${equipped ? 'Выбрано' : ''}</span><span class="equipment-bonus-summary">${bonusSummary(kind, tier)}</span></button>`;
        })).join('')}</div><footer class="arsenal-drawer-footer"><button class="arsenal-drawer-save">Сохранить</button></footer></section>`;
        this.drawerLayer.querySelector('.arsenal-drawer-dim')!.addEventListener('click', () => this.closeDrawer());
        this.drawerLayer.querySelector('.arsenal-drawer-save')!.addEventListener('click', () => this.saveBonuses());
        this.drawerLayer.querySelectorAll<HTMLButtonElement>('[data-bonus-slot]').forEach(button => button.addEventListener('click', () => {
            const index = Number(button.dataset.bonusSlot); if (index >= unlocked) return;
            const entry = entries.find(e => e.slotIndex === index); if (!entry) return;
            const source = this.flight.capture(button);
            this.bonusDraft = entries.filter(e => e.slotIndex !== index); this.renderBonusDrawer(`[data-bonus-slot="${index}"]`);
            this.hideTooltip();
            this.flight.play(source, this.drawerLayer.querySelector(`[data-bonus="${entry.kind}"][data-tier="${entry.tier}"]`), this.drawerLayer);
        }));
        this.drawerLayer.querySelectorAll<HTMLButtonElement>('[data-bonus]').forEach(button => button.addEventListener('click', () => {
            const kind = button.dataset.bonus as GoldPickupKind, tier = button.dataset.tier as PickupTier, equipped = entries.find(e => e.kind === kind && e.tier === tier);
            const source = this.flight.capture(equipped ? this.drawerLayer.querySelector(`[data-bonus-slot="${equipped.slotIndex}"]`)! : button);
            let addedSlot: number | undefined;
            if (equipped) this.bonusDraft = entries.filter(e => e !== equipped); else {
                const slotIndex = Array.from({ length: unlocked }, (_, i) => i).find(i => !entries.some(e => e.slotIndex === i)); if (slotIndex === undefined) return;
                const next = [...entries, { slotIndex, kind, tier }].sort((a, b) => a.slotIndex - b.slotIndex);
                try { validateConsumables(next, unlocked); } catch { return; } this.bonusDraft = next; addedSlot = slotIndex;
            }
            this.renderBonusDrawer(`[data-bonus="${kind}"][data-tier="${tier}"]`);
            this.hideTooltip();
            this.flight.play(source, this.drawerLayer.querySelector(addedSlot !== undefined ? `[data-bonus-slot="${addedSlot}"]` : `[data-bonus="${kind}"][data-tier="${tier}"]`), this.drawerLayer);
        }));
        this.drawerLayer.querySelector('.bonus-drawer-catalog')!.scrollTop = scrollTop;
        this.bindTooltips(this.drawerLayer); if (focusSelector) this.drawerLayer.querySelector<HTMLButtonElement>(focusSelector)?.focus({ preventScroll: true }); void refreshEquipmentArtwork(this.element);
    }
    private saveBonuses(): void {
        if (!this.bonusDraft) return; const entries = this.bonusDraft.map(e => ({ ...e })); validateConsumables(entries, this.unlockedSlots);
        for (const previous of this.draft.get(this.character).consumables ?? []) this.draft.assignConsumable(this.character, previous.slotIndex, null);
        for (const entry of entries) this.draft.assignConsumable(this.character, entry.slotIndex, entry);
        this.closeDrawer(); this.render(); this.onChange(); this.element.querySelector<HTMLButtonElement>(`[data-open-bonuses="${this.drawerTriggerIndex}"]`)?.focus({ preventScroll: true });
    }
    private trapDrawerFocus(event: KeyboardEvent): void {
        const controls = [...this.drawerLayer.querySelectorAll<HTMLButtonElement>('.arsenal-drawer button:not(:disabled)')], first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLButtonElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    bindAbilityTooltip(): void {
        this.hideTooltip();
        const ability = this.sidebar.querySelector<HTMLElement>('.character-ability');
        if (!ability?.querySelector('.character-ability-description')) return;
        ability.dataset.abilityInfo = this.character;
        ability.tabIndex = 0;
        this.bindTooltips(this.sidebar);
    }
    private bindTooltips(root: HTMLElement): void {
        root.querySelectorAll<HTMLElement>('[data-info], [data-bonus-info], [data-ability-info]').forEach(button => {
            if (this.tooltipBindings.has(button)) return;
            this.tooltipBindings.add(button);
            button.addEventListener('mouseenter', () => this.scheduleTooltip(button)); button.addEventListener('focus', () => this.scheduleTooltip(button));
            button.addEventListener('mouseleave', () => { this.suppressedTooltip = undefined; this.hideTooltip(); }); button.addEventListener('blur', () => this.hideTooltip());
        });
    }
    private scheduleTooltip(button: HTMLElement): void {
        this.hideTooltip();
        if (this.suppressedTooltip === this.tooltipKey(button)) return;
        this.tooltipTimer = setTimeout(() => {
            this.tooltipTimer = undefined;
            if (button.isConnected && button.getClientRects().length && (button.matches(':hover') || document.activeElement === button)) this.showTooltip(button);
        }, 150);
    }
    private hideTooltip(): void {
        clearTimeout(this.tooltipTimer); this.tooltipTimer = undefined;
        this.tooltip.classList.remove('visible'); this.tooltip.setAttribute('aria-hidden', 'true');
        this.element.querySelectorAll('[aria-describedby]').forEach(node => node.removeAttribute('aria-describedby'));
    }
    private tooltipKey(button: HTMLElement): string { return button.dataset.abilityInfo ? `ability:${button.dataset.abilityInfo}` : button.dataset.bonusInfo ? `bonus:${button.dataset.tier}:${button.dataset.bonusInfo}` : `weapon:${button.dataset.info}`; }
    private showTooltip(button: HTMLElement): void {
        if (this.suppressedTooltip === this.tooltipKey(button)) { this.hideTooltip(); return; }
        this.suppressedTooltip = undefined;
        this.hideTooltip(); this.tooltip.dataset.tier = button.dataset.tier ?? 'silver';
        if (button.dataset.abilityInfo) {
            const body = document.createElement('div'); body.className = 'equipment-tooltip-body';
            const title = document.createElement('strong'); title.textContent = button.querySelector('.character-ability-name')?.textContent ?? 'Активная способность';
            const description = document.createElement('p'); description.textContent = button.querySelector('.character-ability-description')?.textContent ?? '';
            body.append(title, description); this.tooltip.replaceChildren(body);
        } else if (button.dataset.bonusInfo) {
            const kind = button.dataset.bonusInfo as GoldPickupKind, tier = button.dataset.tier as PickupTier, selected = this.bonusDraft ?? this.draft.get(this.character).consumables ?? [];
            const equipped = selected.find(e => e.kind === kind && e.tier === tier), otherTier = selected.some(e => e.kind === kind && e.tier !== tier), blocked = !equipped && selected.length >= this.unlockedSlots;
            const action = equipped ? 'Выбрано · нажми, чтобы снять' : otherTier ? 'Сначала сними другую версию этого бонуса' : blocked ? 'Все доступные слоты заняты — сначала сними бонус' : 'Нажми, чтобы добавить';
            this.tooltip.innerHTML = `<div class="equipment-tooltip-body"><strong>${bonusNames[kind]} · ${tierName(tier).toLowerCase()}</strong><p>${bonusDescription(kind, tier)}</p><small>${action}</small></div>`;
        } else {
            const weapon = WEAPON_DEFINITIONS[button.dataset.info as WeaponId], equipped = this.draft.get(this.character).weapons.some(e => e.weaponId === weapon.id), blocked = !equipped && !this.draft.canEquip(this.character, weapon.id);
            const grant = CHARACTER_DEFINITIONS[this.character].startingAmmo, initialAmmo = grant?.weaponId === weapon.id ? grant.amount : weapon.ammo.kind === 'finite' ? weapon.ammo.initial : '∞';
            this.tooltip.innerHTML = `<div class="equipment-tooltip-body"><strong>${weapon.name}</strong><p>${initialAmmo} патронов до улучшений арсенала</p><p>${weapon.description ?? ''}</p><small>${equipped ? 'Нажми, чтобы снять' : blocked ? 'Оружие данного типа уже выбрано' : categories[weapon.category] + ' · нажми, чтобы выбрать'}</small></div>`;
        }
        this.tooltip.hidden = false; button.setAttribute('aria-describedby', this.tooltip.id);
        const anchor = button.getBoundingClientRect(), tip = this.tooltip.getBoundingClientRect(); this.tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tip.width - 8, anchor.left + anchor.width / 2 - tip.width / 2))}px`;
        const top = anchor.top - tip.height - 10; this.tooltip.style.top = `${Math.max(8, top >= 8 ? top : Math.min(anchor.bottom + 10, window.innerHeight - tip.height - 8))}px`;
        // Commit the hidden state before the first reveal so both directions transition.
        void this.tooltip.offsetWidth;
        this.tooltip.setAttribute('aria-hidden', 'false'); this.tooltip.classList.add('visible');
    }
}
