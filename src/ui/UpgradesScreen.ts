import { prepareUpgradeArtwork, upgradeArtwork } from './UpgradeArtwork';
import type { UpgradeArtId } from './UpgradeArtwork';
import { UpgradeDraft } from './UpgradeDraft';
import type { UpgradeSection } from './UpgradeDraft';
import { EMPTY_IMPLANTS, IMPLANT_STEP, validateImplants, applyImplants } from '@/gameplay/implants';
import type { ImplantAllocation } from '@/gameplay/implants';
import { EMPTY_ARSENAL, ARSENAL_STEP, validateArsenal, arsenalBonuses } from '@/gameplay/arsenal';
import type { ArsenalAllocation } from '@/gameplay/arsenal';
import { BASE_STATS } from '@/gameplay/stats';
import './upgrades.css';

interface UpgradeItem { id: string; name: string; source: UpgradeArtId }
const implants: readonly UpgradeItem[] = [
    { id: 'health', name: 'Здоровье', source: 'health-v2' },
    { id: 'attackSpeed', name: 'Скорость стрельбы', source: 'attack-speed-v2' },
    { id: 'damage', name: 'Урон', source: 'damage-v2' },
    { id: 'moveSpeed', name: 'Скорость бега', source: 'move-speed-v2' },
    { id: 'armor', name: 'Броня', source: 'armor-v2' },
];
const arsenal: readonly UpgradeItem[] = [
    { id: 'sidearm', name: 'Пистолеты', source: 'arsenal-pistol-v2' },
    { id: 'automatic', name: 'Автоматы', source: 'arsenal-automatic-v2' },
    { id: 'shotgun', name: 'Дробовики', source: 'arsenal-shotgun-v2' },
    { id: 'special', name: 'Тяжёлые', source: 'arsenal-heavy-v2' },
    { id: 'scientific', name: 'Энергетическое оружие', source: 'arsenal-energy-v2' },
];
const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
const percent = (value: number) => number(Math.round(value * 10000) / 100);

export class UpgradesScreen {
    readonly element = document.createElement('section');
    private readonly events = new AbortController();
    private readonly state = new UpgradeDraft(this.restoreImplants(), this.restoreArsenal());
    private trigger?: HTMLElement;
    private finishClose?: () => void;

    get arsenal(): ArsenalAllocation { return this.state.arsenal; }
    get implants(): ImplantAllocation { return this.state.implants; }
    get isOpen(): boolean { return !this.element.hidden && !this.finishClose; }

    constructor(
        private readonly onChange: () => void = () => {},
        private readonly onPreview: (allocation?: ImplantAllocation) => void = () => {},
        private readonly onOpenChange: (open: boolean) => void = () => {},
    ) {
        this.element.className = 'arsenal-drawer-layer upgrade-drawer-layer';
        this.element.hidden = true;
        document.addEventListener('pointerdown', event => {
            if (this.isOpen && event.target instanceof Node && !this.element.querySelector('.upgrade-drawer')?.contains(event.target)) this.closeDrawer();
        }, { signal: this.events.signal });
        this.element.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closeDrawer();
            } else if (event.key === 'Tab') this.trapFocus(event);
        });
    }

    prepareArtwork(): Promise<boolean> { return prepareUpgradeArtwork(); }

    open(section: UpgradeSection, trigger?: HTMLElement): void {
        this.finishClose?.();
        if (this.isOpen) this.closeDrawer(false);
        this.trigger = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
        this.state.open(section);
        this.element.dataset.section = section;
        this.element.hidden = false;
        this.render();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.element.querySelector<HTMLElement>('.upgrade-drawer')?.animate([
                { transform: 'translateX(100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 },
            ], { duration: 380, easing: 'cubic-bezier(.22,.7,.2,1)' });
            this.element.querySelector<HTMLElement>('.arsenal-drawer-dim')?.animate([
                { opacity: 0 }, { opacity: 1 },
            ], { duration: 300, easing: 'ease-out' });
        }
        this.onOpenChange(true);
        if (section === 'implants') this.onPreview(this.state.draftImplants);
        this.element.querySelector<HTMLElement>('#upgrade-drawer-heading')?.focus({ preventScroll: true });
        void this.prepareArtwork();
    }

    closeDrawer(animate = true): void {
        if (this.finishClose) { if (!animate) this.finishClose(); return; }
        if (!this.isOpen) return;
        this.state.cancel();
        const panel = this.element.querySelector<HTMLElement>('.upgrade-drawer');
        const dim = this.element.querySelector<HTMLElement>('.arsenal-drawer-dim');
        const motions: Animation[] = [];
        const finish = () => {
            motions.forEach(motion => motion.cancel());
            this.element.hidden = true; this.element.replaceChildren();
            this.element.removeAttribute('inert'); this.element.style.pointerEvents = '';
            delete this.element.dataset.section; this.finishClose = undefined;
        };
        if (animate && panel && this.element.getClientRects().length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.finishClose = finish;
            this.element.setAttribute('inert', ''); this.element.style.pointerEvents = 'none';
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
            void slide.finished.then(() => { if (this.finishClose === finish) finish(); }, () => {});
        } else finish();
        this.onPreview(undefined);
        this.onOpenChange(false);
        if (this.trigger?.isConnected && this.trigger.getClientRects().length) this.trigger.focus({ preventScroll: true });
        this.trigger = undefined;
    }

    dispose(): void {
        this.closeDrawer(false);
        this.events.abort();
        this.element.remove();
    }

    private get items(): readonly UpgradeItem[] { return this.state.section === 'weapons' ? arsenal : implants; }
    private points(id: string): number {
        const allocation = this.state.section === 'weapons' ? this.state.draftArsenal : this.state.draftImplants;
        return (allocation as Record<string, number | undefined>)[id] ?? 0;
    }

    private render(): void {
        const isImplant = this.state.section === 'implants';
        const title = isImplant ? 'Импланты' : 'Оружия';
        const segmentCount = isImplant ? 20 : 10;
        this.element.innerHTML = `<button class="arsenal-drawer-dim" aria-label="Отменить изменения улучшений" tabindex="-1"></button>
            <section class="arsenal-drawer upgrade-drawer" role="dialog" aria-modal="true" aria-labelledby="upgrade-drawer-heading">
                <h2 id="upgrade-drawer-heading" tabindex="-1">${title}</h2>
                <div class="upgrade-drawer-points"><span class="upgrade-point-emblem" aria-hidden="true">▲</span><b></b></div>
                <p class="upgrade-drawer-total" role="status"></p>
                <div class="upgrade-drawer-cards">${this.items.map(item => `<section class="upgrade-card" data-upgrade-id="${item.id}" role="group" aria-label="${item.name}">
                    <div class="upgrade-icon upgrade-icon-artwork" aria-label="${item.name}">${upgradeArtwork(item.source)}</div>
                    <div class="upgrade-card-info"><h3 class="upgrade-card-name">${item.name}</h3><div class="upgrade-card-summary"></div></div>
                    <div class="upgrade-controls"><button type="button" data-change="-1" aria-label="Уменьшить: ${item.name}">−</button><span class="upgrade-value"></span><button type="button" data-change="1" aria-label="Увеличить: ${item.name}">+</button></div>
                    <div class="upgrade-segments${isImplant ? ' implant-segments' : ''}" aria-hidden="true">${Array.from({ length: segmentCount }, () => '<span></span>').join('')}</div>
                </section>`).join('')}</div>
                <footer class="arsenal-drawer-footer"><button class="arsenal-drawer-save">Сохранить</button></footer>
            </section>`;
        this.element.querySelector('.arsenal-drawer-dim')!.addEventListener('click', () => this.closeDrawer());
        this.element.querySelector('.arsenal-drawer-save')!.addEventListener('click', () => this.save());
        this.element.querySelectorAll<HTMLElement>('.upgrade-card').forEach((card, index) => {
            card.querySelectorAll<HTMLButtonElement>('[data-change]').forEach(button => button.addEventListener('click', () => {
                const step = isImplant ? IMPLANT_STEP : ARSENAL_STEP;
                if (!this.state.change(this.items[index].id, Number(button.dataset.change) * step)) return;
                this.refresh();
                if (isImplant) this.onPreview(this.state.draftImplants);
            }));
        });
        this.refresh();
    }

    private refresh(): void {
        const title = this.state.section === 'implants' ? 'Импланты' : 'Оружия';
        const total = this.state.total;
        this.element.querySelector('.upgrade-drawer-total')!.textContent = `${title}: ${total} / ${this.state.limit}`;
        const remaining = this.element.querySelector('.upgrade-drawer-points b')!;
        remaining.textContent = String(this.state.remaining);
        remaining.setAttribute('aria-label', `Доступные очки: ${this.state.remaining}`);
        this.element.querySelectorAll<HTMLElement>('.upgrade-card').forEach((card, index) => {
            const item = this.items[index], points = this.points(item.id);
            const value = card.querySelector('.upgrade-value')!;
            value.textContent = String(points);
            value.setAttribute('aria-label', `Прокачка: ${points}`);
            card.querySelector<HTMLButtonElement>('[data-change="-1"]')!.disabled = points === 0;
            card.querySelector<HTMLButtonElement>('[data-change="1"]')!.disabled = this.state.remaining === 0;
            card.querySelector('.upgrade-card-summary')!.innerHTML = this.summary(item);
            const step = this.state.section === 'weapons' ? ARSENAL_STEP : IMPLANT_STEP;
            card.querySelectorAll('.upgrade-segments > span').forEach((segment, i) => segment.classList.toggle('active', i < points / step));
        });
    }

    private summary(item: UpgradeItem): string {
        if (this.state.section === 'weapons') {
            const bonus = arsenalBonuses(this.points(item.id));
            return `<p>Темп +${percent(bonus.attackSpeed)}% · Урон +${percent(bonus.damage)}%</p>${item.id === 'sidearm' ? '' : `<p>Боезапас +${percent(bonus.ammo)}%</p>`}`;
        }
        const stats = applyImplants(BASE_STATS, this.state.draftImplants);
        const bonuses: Record<keyof ImplantAllocation, string> = {
            health: `+${number(stats.maxHp - BASE_STATS.maxHp)} HP`,
            attackSpeed: `+${percent(stats.attackSpeed / BASE_STATS.attackSpeed - 1)}%`,
            damage: `+${percent(stats.damage / BASE_STATS.damage - 1)}%`,
            moveSpeed: `+${percent(stats.speed / BASE_STATS.speed - 1)}%`,
            armor: `${percent(stats.damageReduction)}% снижения урона`,
        };
        return `<p>${bonuses[item.id as keyof ImplantAllocation]}</p>`;
    }

    private save(): void {
        const section = this.state.save();
        if (!section) return;
        const key = section === 'weapons' ? 'mutant.arsenal.v1' : 'mutant.implants.v1';
        const allocation = section === 'weapons' ? this.arsenal : this.implants;
        try { localStorage.setItem(key, JSON.stringify(allocation)); } catch { /* Session allocation remains usable without storage. */ }
        this.closeDrawer();
        this.onChange();
    }

    private trapFocus(event: KeyboardEvent): void {
        const controls = [...this.element.querySelectorAll<HTMLElement>('.upgrade-drawer button:not(:disabled), .upgrade-drawer .upgrade-icon[tabindex="0"]')];
        const first = controls[0], last = controls[controls.length - 1];
        const current = document.activeElement as HTMLElement;
        if (event.shiftKey && (current === first || !controls.includes(current))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && current === last) { event.preventDefault(); first?.focus(); }
    }

    private restoreArsenal(): ArsenalAllocation {
        try {
            const saved = JSON.parse(localStorage.getItem('mutant.arsenal.v1') ?? 'null');
            validateArsenal(saved);
            return Object.fromEntries(arsenal.map(item => [item.id, saved[item.id]])) as ArsenalAllocation;
        } catch { return { ...EMPTY_ARSENAL }; }
    }

    private restoreImplants(): ImplantAllocation {
        try {
            const saved = JSON.parse(localStorage.getItem('mutant.implants.v1') ?? 'null');
            validateImplants(saved);
            return { health: saved.health, attackSpeed: saved.attackSpeed, moveSpeed: saved.moveSpeed, damage: saved.damage ?? 0, armor: saved.armor ?? 0 };
        } catch { return { ...EMPTY_IMPLANTS }; }
    }
}
