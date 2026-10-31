import { CHARACTER_PRESENTATIONS as characters, LOCKED_CHARACTER_PRESENTATIONS as lockedCharacters } from './CharacterPresentations';
import { EquipmentScreen } from './EquipmentScreen';
import { UpgradesScreen } from './UpgradesScreen';
import { CHARACTER_DEFINITIONS } from '@/gameplay/characters';
import { BASE_STATS, resolveStats } from '@/gameplay/stats';
import { applyImplants } from '@/gameplay/implants';
import type { ImplantAllocation } from '@/gameplay/implants';
import type { CharacterId } from '@/gameplay/ids';
import type { Loadout } from '@/gameplay/loadout';
import { abilityIconStyle, ensureAbilityIcons, abilityArtworkReady } from '@/rendering/AbilityIcons';
import { PortraitPreloader } from './PortraitPreloader';
import { rosterArtwork, rosterArtworkReady } from './RosterArtwork';
import { PORTRAIT_PREVIEWS } from '@/assets/selection-preview-data';
import { CHARACTER_ABILITIES } from '@/gameplay/CharacterAbilities';
import './characters.css';
import './preparation-redesign.css';
import './arsenal-redesign.css';
import './upgrade-drawers.css';

const lock = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M6 11V7a6 6 0 0 1 12 0v4" fill="none" stroke="currentColor" stroke-width="3"/><rect x="2" y="10" width="20" height="17" rx="3" fill="currentColor"/><path d="M12 16v6" stroke="#153044" stroke-width="3"/></svg>';

export class CharacterScreen {
    private readonly events = new AbortController();
    private root = document.createElement('main');
    private selected = 2;
    private previewLocked = false;
    private readonly portraits = new PortraitPreloader([...characters, ...lockedCharacters].map(c => c.image));
    private rosterReady: Promise<boolean> = Promise.resolve(false);
    private preparation?: Promise<boolean>;
    private portraitRevision = 0;
    private equipment: EquipmentScreen;
    private previewImplants?: ImplantAllocation;
    private tabAnimations: Animation[] = [];
    private tabSnapshot?: HTMLElement;
    private tabBackdrop?: HTMLElement;
    private tabRosterSnapshot?: HTMLElement;
    private upgrades = new UpgradesScreen(() => {
        if (!this.previewLocked) this.renderPortrait(characters[this.selected]);
        this.updatePlay();
    }, allocation => {
        this.previewImplants = allocation;
        this.updateArsenalSidebar();
    }, open => {
        this.equipment.element.inert = open;
        this.root.querySelector<HTMLElement>('.preparation-footer')!.inert = open;
    });
    get selectedLoadout() { return { ...this.equipment.draft.get(this.selectedCharacter), implants: this.upgrades.implants, arsenal: this.upgrades.arsenal }; }
    get selectedCharacter() { return characters[this.selected].id; }

    constructor(private onClose: () => void, private onPlay: () => void, private playLabel: (loadout: Loadout) => string = () => 'Играть', private onArtworkReady: (character: CharacterId) => void = () => {}) {
        // Start the selected portrait before inserting the roster's image requests.
        this.portraits.prime(characters[this.selected].image);
        this.root.className = 'character-screen';
        this.root.hidden = true;
        document.body.append(this.root);
        this.root.innerHTML = `
            <section class="preparation" aria-label="Подготовка к бою">
                <header class="preparation-header"><span class="preparation-logo" aria-hidden="true"><span class="preparation-logo-letter">М</span></span><nav class="preparation-tabs" aria-label="Подготовка">
                    <button class="preparation-tab active" data-tab="character" aria-current="page">Персонаж</button>
                    <button class="preparation-tab" data-tab="equipment">Арсенал</button>
                </nav><span class="preparation-caption">Подготовка к бою</span><button class="preparation-close" aria-label="Главное меню">×</button></header>
                <div class="character-frame character-selection-frame">
                    <div class="character-dossier">
                        <div class="character-portrait"><img class="hero-portrait-preview" fetchpriority="high" decoding="async" alt=""/><img class="hero-portrait" fetchpriority="high" decoding="async" alt=""/><span class="portrait-role"></span></div>
                        <section class="character-details" aria-labelledby="character-name">
                            <h1 id="character-name"></h1>
                            <p class="character-role"></p>
                            <div class="character-info" tabindex="0" role="region" aria-label="Характеристики и история персонажа">
                                <div class="character-features"><div class="character-stats"></div>
                                <div class="character-ability"></div></div>
                                <div class="character-stats-disclosure"></div>
                                <div class="character-history"><h2 class="character-story-title">История</h2><div class="character-story"></div></div>
                            </div>
                        </section>
                    </div>
                </div>
                <footer class="preparation-footer"><button class="preparation-play">В бой</button></footer>
                <section class="roster-wrap" aria-label="Выбор персонажа"><h2 class="roster-heading">Выбор персонажа</h2><div class="roster" role="group" aria-label="Выбор персонажа">
                        ${characters.map((c, i) => `<button class="character-card" data-character="${i}" aria-label="${c.name}" aria-pressed="false">${rosterArtwork(c.id)}<span>${c.name}</span></button>`).join('')}
                        ${lockedCharacters.map((c, i) => `<button class="character-card character-preview" data-preview="${i}" aria-label="${c.name}, закрыт — посмотреть описание" aria-pressed="false">${rosterArtwork(c.id)}<span>${c.name}</span><span class="character-lock">${lock}</span></button>`).join('')}
                    </div></section>
            </section>`;
        this.rosterReady = rosterArtworkReady();
        this.equipment = new EquipmentScreen(() => this.updatePlay(), section => {
            const trigger = this.equipment.element.querySelector<HTMLElement>(`[data-upgrade="${section}"]`);
            this.equipment.closeDrawer();
            this.upgrades.open(section, trigger ?? undefined);
        });
        this.root.querySelector('.preparation-footer')!.before(this.equipment.element);
        this.root.querySelector('.preparation-footer')!.before(this.upgrades.element);
        this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.addEventListener('click', () => this.openTab(button.dataset.tab!)));
        this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.addEventListener('click', () => this.select(Number(button.dataset.character))));
        this.root.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button => button.addEventListener('click', () => {
            this.previewLocked = true;
            this.renderPortrait(lockedCharacters[Number(button.dataset.preview)]);
            this.updatePlay();
            this.root.querySelectorAll('[data-character]').forEach(button => button.setAttribute('aria-pressed', 'false'));
            this.root.querySelectorAll('[data-preview]').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
        }));
        this.root.querySelector('.preparation-close')!.addEventListener('click', () => { this.hide(); this.onClose(); });
        this.root.querySelector('.preparation-play')!.addEventListener('click', () => { if (this.previewLocked || !this.equipment.draft.canPlay(this.selectedCharacter)) return; this.onPlay(); });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !event.defaultPrevented && !this.root.hidden && !document.querySelector('dialog[open]')) { this.hide(); this.onClose(); }
        }, { signal: this.events.signal });
        this.select(this.selected);
        window.addEventListener('resize', () => this.cancelTabTransition(), { signal: this.events.signal });
        // Card artwork is small enough to prepare alongside the main menu, before either tab is opened.
        this.equipment.prepareArtwork();
        void this.upgrades.prepareArtwork();
    }

    prepare(): Promise<boolean> {
        if (this.preparation) return this.preparation;
        this.rosterReady = rosterArtworkReady();
        // Other full portraits are optional; leave connections for the selected hero and equipment.
        this.preparation = Promise.all([this.portraits.prepareAll(1), this.rosterReady, abilityArtworkReady()])
            .then(results => {
                const ready = results.every(Boolean);
                if (!ready) this.preparation = undefined;
                return ready;
            }).catch(() => { this.preparation = undefined; return false; });
        return this.preparation;
    }

    prepareCurrent(): Promise<boolean> {
        this.rosterReady = rosterArtworkReady();
        return Promise.all([this.portraits.select(characters[this.selected].image, Promise.resolve(), false),
            this.rosterReady, abilityArtworkReady()]).then(results => results.every(Boolean));
    }

    prepareEquipment(): Promise<boolean> { return this.equipment.prepareArtwork(); }

    show() {
        this.root.hidden = false;
        this.openTab('character', false);
        this.select(this.selected);
        this.root.querySelector<HTMLButtonElement>(`[data-character="${this.selected}"]`)!.focus();
    }

    hide() { this.cancelTabTransition(); this.equipment.closeDrawer(); this.upgrades.closeDrawer(); this.root.hidden = true; this.portraits.pause(); ++this.portraitRevision; }

    dispose(): void {
        this.cancelTabTransition();
        this.events.abort();
        ++this.portraitRevision;
        this.portraits.dispose();
        this.equipment.dispose();
        this.upgrades.dispose();
        this.root.remove();
    }

    private openTab(tab: string, animate = true) {
        const previous = this.root.dataset.preparationTab;
        if (previous === tab) return;
        this.cancelTabTransition();
        this.equipment.closeDrawer();
        this.upgrades.closeDrawer();
        if (previous === 'character') this.captureArsenalPortraitGeometry();
        const motion = animate && previous && !this.root.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const footerFrom = motion ? this.root.querySelector<HTMLElement>('.preparation-footer')!.getBoundingClientRect() : undefined;
        if (motion) {
            const source = previous === 'character' ? this.root.querySelector<HTMLElement>('.character-selection-frame')! : this.equipment.element;
            const rect = source.getBoundingClientRect();
            const snapshot = source.cloneNode(true) as HTMLElement;
            snapshot.removeAttribute('id');
            snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            snapshot.setAttribute('aria-hidden', 'true');
            snapshot.inert = true;
            Object.assign(snapshot.style, { position: 'fixed', inset: 'auto', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', zIndex: '4', pointerEvents: 'none' });
            this.root.append(snapshot);
            for (const selector of ['.arsenal-sidebar', '.equipment-catalog', '.character-info']) {
                const original = source.querySelector(selector);
                const copy = snapshot.querySelector(selector);
                if (original && copy) copy.scrollTop = original.scrollTop;
            }
            this.tabSnapshot = snapshot;
            if (previous === 'character') {
                // Keep an independent copy visible after the real roster leaves layout.
                const roster = this.root.querySelector<HTMLElement>('.roster-wrap')!;
                const box = roster.getBoundingClientRect();
                const copy = roster.cloneNode(true) as HTMLElement;
                copy.setAttribute('aria-hidden', 'true');
                copy.inert = true;
                Object.assign(copy.style, {
                    position: 'fixed', left: `${box.left}px`, top: `${box.top}px`,
                    width: `${box.width}px`, height: `${box.height}px`, margin: '0',
                    zIndex: '6', pointerEvents: 'none',
                });
                this.root.append(copy);
                copy.querySelector('.roster')!.scrollLeft = roster.querySelector('.roster')!.scrollLeft;
                this.tabRosterSnapshot = copy;
            }
        }
        this.root.dataset.preparationTab = tab;
        this.root.querySelector<HTMLElement>('.roster-wrap')!.hidden = tab !== 'character';
        this.root.querySelector<HTMLElement>('.character-selection-frame')!.hidden = tab !== 'character';
        this.equipment.element.hidden = tab !== 'equipment';
        if (tab === 'equipment') { this.equipment.prepareArtwork(); this.updateArsenalSidebar(); }
        this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
            const active = button.dataset.tab === tab;
            button.classList.toggle('active', active);
            if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
        });
        if (this.tabSnapshot) this.animateTabTransition(tab, footerFrom);
    }

    private cancelTabTransition(): void {
        this.tabAnimations.forEach(animation => animation.cancel());
        this.tabAnimations = [];
        this.tabSnapshot?.remove();
        this.tabSnapshot = undefined;
        this.tabBackdrop?.remove();
        this.tabBackdrop = undefined;
        this.tabRosterSnapshot?.remove();
        this.tabRosterSnapshot = undefined;
    }

    private animateTabTransition(tab: string, footerFrom?: DOMRect): void {
        const snapshot = this.tabSnapshot!;
        const ease = 'cubic-bezier(.22, 1, .36, 1)';
        const portraitDuration = tab === 'equipment' ? 400 : 700;
        const play = (element: Element | null, frames: Keyframe[], duration: number, delay = 0, easing = ease) => {
            if (!element) return;
            this.tabAnimations.push(element.animate(frames, { duration, delay, easing, fill: 'both' }));
        };
        if (footerFrom) {
            const footer = this.root.querySelector<HTMLElement>('.preparation-footer')!;
            const footerTo = footer.getBoundingClientRect();
            // Move the real button and its bar above the fading scene snapshot.
            play(footer, [
                { transform: `translate(${footerFrom.left - footerTo.left}px, ${footerFrom.top - footerTo.top}px)`, zIndex: 7 },
                { transform: 'translate(0, 0)', zIndex: 7 },
            ], 560, tab === 'character' ? 120 : 0, 'cubic-bezier(.4, 0, .2, 1)');
        }
        const moveText = (source: HTMLElement, target: HTMLElement, duration: number, delay = 0) => {
            // Text size follows the font ratio, never the aspect ratio of its
            // full-width layout box. Keep both axes identical throughout.
            const scale = parseFloat(getComputedStyle(source).fontSize) / parseFloat(getComputedStyle(target).fontSize);
            const box = target.getBoundingClientRect();
            const sourceRange = document.createRange(), targetRange = document.createRange();
            sourceRange.selectNodeContents(source);
            targetRange.selectNodeContents(target);
            const from = sourceRange.getBoundingClientRect(), to = targetRange.getBoundingClientRect();
            const dx = from.left - box.left - (to.left - box.left) * scale;
            const dy = from.top - box.top - (to.top - box.top) * scale;
            source.style.visibility = 'hidden';
            play(target, [
                { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: 'top left', width: `${box.width}px` },
                { transform: 'translate(0, 0) scale(1)', transformOrigin: 'top left', width: `${box.width}px` },
            ], duration, delay, 'cubic-bezier(.4, 0, .2, 1)');
        };
        if (tab === 'equipment') {
            if (this.tabRosterSnapshot) {
                const distance = window.innerHeight - this.tabRosterSnapshot.getBoundingClientRect().top;
                play(this.tabRosterSnapshot, [
                    { transform: 'translateY(0)' },
                    { transform: `translateY(${distance}px)` },
                ], 560, 0, 'cubic-bezier(.4, 0, .2, 1)');
            }
            const sidebar = this.equipment.sidebar;
            const statisticsEndMs = 560;
            const featuresEndMs = statisticsEndMs;
            // Keep the moving panel background below the outgoing portrait.
            // Raising the opaque sidebar itself would cut the hero in half.
            const sidebarRect = sidebar.getBoundingClientRect();
            const backdrop = document.createElement('div');
            backdrop.setAttribute('aria-hidden', 'true');
            Object.assign(backdrop.style, {
                position: 'fixed', left: `${sidebarRect.left}px`, top: `${sidebarRect.top}px`,
                width: `${sidebarRect.width}px`, height: `${sidebarRect.height}px`,
                background: getComputedStyle(sidebar).background, pointerEvents: 'none', zIndex: '3',
            });
            this.root.append(backdrop);
            this.tabBackdrop = backdrop;
            play(backdrop, [
                { transform: `translateX(${-sidebarRect.right - 24}px)` },
                { transform: 'translateX(0)' },
            ], statisticsEndMs, 0, 'cubic-bezier(.4, 0, .2, 1)');
            // Shared content stays opaque and travels from its source geometry.
            const shared = [
                ['.character-details h1', '.arsenal-hero-name'],
                ['.character-details > .character-role', '.arsenal-hero-role'],
                ['.character-features', '.arsenal-features'],
                ['.character-stats-disclosure', '.arsenal-statistics'],
            ];
            for (const [sourceSelector, targetSelector] of shared) {
                const source = snapshot.querySelector<HTMLElement>(sourceSelector)!;
                const target = sidebar.querySelector<HTMLElement>(targetSelector)!;
                if (!target.getClientRects().length) continue;
                if (targetSelector === '.arsenal-hero-name' || targetSelector === '.arsenal-hero-role') {
                    moveText(source, target, 460);
                    continue;
                }
                const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
                const dx = from.left - to.left, dy = from.top - to.top;
                const isStatistics = targetSelector === '.arsenal-statistics';
                const isFeatures = targetSelector === '.arsenal-features';
                // Statistics and features travel together and settle together.
                const duration = isStatistics ? statisticsEndMs : isFeatures ? featuresEndMs : 820;
                const stagingX = isFeatures ? -to.right - 24 : 0;
                if (isFeatures) {
                    // Do not animate the relocation across the screen. Prepare
                    // the incoming block offscreen and reveal it only by sliding
                    // through the viewport edge, always at full opacity.
                    play(source, [{ opacity: 1 }, { opacity: 0 }], 180);
                    const offscreen = `translate(${stagingX}px, 0)`;
                    play(target, [
                        { transform: offscreen, transformOrigin: 'top left', width: `${to.width}px`, opacity: 1, offset: 0 },
                        { transform: 'translate(0, 0)', transformOrigin: 'top left', width: `${to.width}px`, opacity: 1, offset: 1 },
                    ], duration, 0, 'cubic-bezier(.4, 0, .2, 1)');
                    continue;
                }
                source.style.visibility = 'hidden';
                if (isStatistics) {
                    play(target, [
                        { transform: `translate(${dx}px, ${dy}px)`, width: `${to.width}px` },
                        { transform: 'translate(0, 0)', width: `${to.width}px` },
                    ], duration, 0, 'cubic-bezier(.4, 0, .2, 1)');
                    continue;
                }
            }
            // Allow the moving text to cross the sidebar above the portrait.
            play(sidebar, [{ overflow: 'visible', position: 'relative', zIndex: 5, background: 'transparent' },
                { overflow: 'visible', position: 'relative', zIndex: 5, background: 'transparent' }], Math.max(820, featuresEndMs) + 40);
            play(snapshot.querySelector('.character-history'), [
                { transform: 'translateX(0)', opacity: 1, offset: 0 },
                { transform: 'translateX(-18vw)', opacity: .85, offset: .7 },
                { transform: 'translateX(-24vw)', opacity: 0, offset: 1 },
            ], 520, 0, 'cubic-bezier(.4, 0, .2, 1)');
            play(snapshot, [
                { transform: 'translateX(0)', opacity: 1, offset: 0 },
                { transform: 'translateX(-3vw)', opacity: 1, offset: .5 },
                { transform: 'translateX(-4vw)', opacity: 0, offset: 1 },
            ], portraitDuration, 0, 'ease-in-out');
            // Both layers drift together to the arsenal's resting position.
            play(snapshot.querySelector('.character-portrait'), [
                { transform: 'translateX(0)', offset: 0 },
                { transform: 'translateX(calc(3vw + 6 * var(--prep-unit)))', offset: .5 },
                { transform: 'translateX(calc(4vw + 12 * var(--prep-unit)))', offset: 1 },
            ], portraitDuration, 0, 'ease-in-out');
            this.tabAnimations.push(this.equipment.element.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(calc(12 * var(--prep-unit)))' },
            ], { duration: portraitDuration, easing: 'ease-in-out', fill: 'both', pseudoElement: '::after' }));
            play(this.equipment.element.querySelector('.arsenal-main'), [
                { transform: 'translateX(36px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 },
            ], 400, 160);
        } else {
            const frame = this.root.querySelector<HTMLElement>('.character-selection-frame')!;
            const duration = 760;
            const portraitReturnFrames: Keyframe[] = [
                { transform: 'translateX(calc(12 * var(--prep-unit)))' },
                { transform: 'translateX(0)' },
            ];
            play(frame.querySelector('.character-portrait'), portraitReturnFrames, portraitDuration, 0, 'ease-in-out');
            this.tabAnimations.push(snapshot.animate(portraitReturnFrames, {
                duration: portraitDuration, easing: 'ease-in-out', fill: 'both', pseudoElement: '::after',
            }));
            // The outgoing snapshot needs the same background-only feather as
            // the incoming panel; masking the sidebar would also fade its text.
            const sidebar = snapshot.querySelector<HTMLElement>('.arsenal-sidebar')!;
            const rect = sidebar.getBoundingClientRect();
            const backdrop = document.createElement('div');
            backdrop.setAttribute('aria-hidden', 'true');
            Object.assign(backdrop.style, {
                position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
                width: `${rect.width}px`, height: `${rect.height}px`,
                background: getComputedStyle(sidebar).background,
                pointerEvents: 'none', zIndex: '1',
            });
            // Keep the scene's solid base while it fades. The portrait gradients
            // end in this color; a transparent base exposes their rectangular bounds.
            sidebar.style.zIndex = '2';
            snapshot.append(backdrop);
            this.tabBackdrop = backdrop;
            play(sidebar, [{ background: 'transparent' }, { background: 'transparent' }], duration + 40);
            play(backdrop, [
                { transform: 'translateX(0)' },
                { transform: `translateX(${-rect.right - 24}px)` },
            ], duration, 0, 'cubic-bezier(.4, 0, .2, 1)');
            const shared = [
                ['.arsenal-hero-name', '.character-details h1'],
                ['.arsenal-hero-role', '.character-details > .character-role'],
                ['.arsenal-statistics', '.character-stats-disclosure'],
            ];
            for (const [sourceSelector, targetSelector] of shared) {
                const source = snapshot.querySelector<HTMLElement>(sourceSelector)!;
                const target = frame.querySelector<HTMLElement>(targetSelector)!;
                if (!source.getClientRects().length || !target.getClientRects().length) continue;
                if (sourceSelector === '.arsenal-hero-name' || sourceSelector === '.arsenal-hero-role') {
                    moveText(source, target, 460);
                    continue;
                }
                const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
                source.style.visibility = 'hidden';
                play(target, [
                    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, width: `${to.width}px` },
                    { transform: 'translate(0, 0)', width: `${to.width}px` },
                ], 640, 80, 'cubic-bezier(.4, 0, .2, 1)');
            }
            play(frame.querySelector('.character-details'), [{ zIndex: 5 }, { zIndex: 5 }], duration + 40);
            play(frame.querySelector('.character-info'), [{ overflow: 'visible' }, { overflow: 'visible' }], duration + 40);
            const features = snapshot.querySelector('.arsenal-features');
            if (features?.getClientRects().length) {
                const rect = features.getBoundingClientRect();
                play(features, [{ transform: 'translateX(0)' }, { transform: `translateX(${-rect.right - 24}px)` }], 300, 0, 'cubic-bezier(.4, 0, .2, 1)');
            }
            play(frame.querySelector('.character-features'), [
                { transform: 'translateX(-40px)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 },
            ], 400, 300, 'cubic-bezier(.4, 0, .2, 1)');
            play(snapshot.querySelector('.arsenal-main'), [
                { transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(36px)', opacity: 0 },
            ], 340, 0, 'ease-in-out');
            play(snapshot, [{ opacity: 1 }, { opacity: 1, offset: .3 }, { opacity: 0 }], duration, 0, 'ease-in-out');
            play(frame.querySelector('.character-history'), [
                { transform: 'translateX(-24vw)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 },
            ], 520, 200, 'cubic-bezier(.4, 0, .2, 1)');
            const roster = this.root.querySelector<HTMLElement>('.roster-wrap')!;
            const rosterDistance = window.innerHeight - roster.getBoundingClientRect().top;
            play(roster, [
                { transform: `translateY(${rosterDistance}px)`, position: 'relative', zIndex: 6 },
                { transform: 'translateY(0)', position: 'relative', zIndex: 6 },
            ], 560, 120, 'cubic-bezier(.4, 0, .2, 1)');
        }
        // A superseded transition must never clean up the new transition's layer.
        void Promise.all(this.tabAnimations.map(animation => animation.finished)).then(() => {
            if (this.tabSnapshot === snapshot) this.cancelTabTransition();
        }).catch(() => {});
    }

    private updatePlay() {
        const label = this.playLabel(this.selectedLoadout);
        const play = this.root.querySelector<HTMLButtonElement>('.preparation-play')!;
        play.textContent = label === 'Играть' || label === 'Начать новый бой' ? 'В бой' : label;
        play.setAttribute('aria-label', label);
        this.root.querySelector<HTMLButtonElement>('.preparation-play')!.disabled = this.previewLocked || !this.equipment.draft.canPlay(this.selectedCharacter);
        this.root.querySelector<HTMLButtonElement>('[data-tab="equipment"]')!.disabled = this.previewLocked;
    }

    private select(index: number) {
        this.previewLocked = false;
        this.selected = index;
        this.equipment.setCharacter(this.selectedCharacter);
        this.updatePlay();
        const c = characters[index];
        this.renderPortrait(c);
        this.root.querySelectorAll('[data-preview]').forEach(card => card.setAttribute('aria-pressed', 'false'));
        this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.character) === index)));
    }

    private renderPortrait(c: Omit<typeof characters[number], 'id'> & { id?: CharacterId; abilityDescription?: string; previewNote?: string }) {
        const portrait = this.root.querySelector<HTMLImageElement>('.hero-portrait')!;
        const preview = this.root.querySelector<HTMLImageElement>('.hero-portrait-preview')!;
        const cached = this.portraits.isReady(c.image);
        if (!cached) preview.src = c.id ? PORTRAIT_PREVIEWS[c.id] : c.thumbnail ?? c.image;
        portrait.style.opacity = cached ? '1' : '0';
        if (portrait.getAttribute('src') !== c.image) portrait.src = c.image;
        const revision = ++this.portraitRevision;
        const abilityReady = ensureAbilityIcons();
        const interfaceReady = Promise.all([this.rosterReady, abilityReady]);
        const selectedReady = this.portraits.select(c.image, interfaceReady, false);
        void selectedReady.then(ready => {
            if (ready && revision === this.portraitRevision) portrait.style.opacity = '1';
        });
        void Promise.all([selectedReady, interfaceReady]).then(([ready]) => {
            if (ready && revision === this.portraitRevision && !this.root.hidden && !this.previewLocked && c.id) this.onArtworkReady(c.id);
        });
        portrait.alt = c.name;
        this.root.querySelector('.portrait-role')!.textContent = c.role;
        this.root.querySelector('#character-name')!.textContent = c.name;
        this.root.querySelector('.character-role')!.textContent = c.role;
        const definition = c.id ? CHARACTER_DEFINITIONS[c.id] : undefined;
        const isEquipmentTrait = (b: string) => /патрон|Базука|Автомат|Двустволка|Огнемёт|АК-47|Плазмо|Пулемёт|Электропушка/.test(b);
        const traits = [...c.bonuses].sort((a, b) => Number(isEquipmentTrait(b)) - Number(isEquipmentTrait(a))).map(b => {
            const pending = /рейтинга/.test(b)
                || (/Невидимость/.test(b) && definition?.ability.status !== 'active');
            const status = pending ? ' — пока не действует' : '';
            const equipment = isEquipmentTrait(b);
            return `<p class="${pending ? 'character-pending-trait' : equipment ? 'character-equipment-trait' : 'positive'}">${b}${status}</p>`;
        }).join('');
        this.root.querySelector('.character-stats')!.innerHTML = `${traits || c.penalty ? '<h2>Особенности</h2>' : ''}${traits}${c.penalty ? `<p class="negative">${c.penalty}</p>` : ''}`;
        this.root.querySelector('.character-stats-disclosure')!.innerHTML = this.statisticsMarkup(c.id, this.upgrades.implants);
        const icon = abilityIconStyle(c.id);
        const ability = c.id ? CHARACTER_ABILITIES[c.id] : undefined;
        const description = c.abilityDescription?.replace(/\s*Перезарядка\s*[—:]\s*\d+\s*секунд?\.?/u, '');
        this.root.querySelector('.character-ability')!.innerHTML = `${c.ability ? `<div class="character-ability-heading">${icon ? `<span class="character-ability-icon" aria-hidden="true" style="${icon}"></span>` : ''}<div><span class="character-ability-eyebrow">Активная способность</span><div class="character-ability-name">${c.ability}</div></div></div>` : ''}${description ? `<p class="character-ability-description">${description}</p>` : ''}${definition?.ability.status === 'active' ? `<p class="character-ability-timing">Активация: <kbd>F</kbd>${ability ? `<span aria-label="Перезарядка">↻ ${(ability.cooldownMs / 1000).toLocaleString('ru-RU')} сек.</span>` : ''}</p>` : c.ability ? '<p class="character-preview-note">Способность пока не действует.</p>' : ''}${c.previewNote ? `<p class="character-preview-note">${c.previewNote}</p>` : this.previewLocked ? '<p class="character-preview-note">Персонаж закрыт. Характеристики и способность показаны для ознакомления.</p>' : ''}`;
        this.root.querySelector<HTMLElement>('.character-story-title')!.hidden = c.story.length === 0;
        this.root.querySelector('.character-story')!.innerHTML = c.story.map(p => `<p>${p}</p>`).join('');
        this.root.querySelector('.character-info')!.scrollTop = 0;
        this.updateArsenalSidebar();
    }

    private statisticsMarkup(character: CharacterId | undefined, allocation: ImplantAllocation): string {
        const definition = character ? CHARACTER_DEFINITIONS[character] : undefined;
        const base = definition ? resolveStats(definition.baseStats, definition.modifiers) : undefined;
        const stats = base ? applyImplants(base, allocation) : undefined;
        const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
        const multiplier = (value: number) => `×${number(value)}`;
        const gain = (value: number, unit = '%') => value > .000001 ? ` <span class="character-stat-gain">(+${number(value)}${unit})</span>` : '';
        const rows = stats && base ? [
            ['Здоровье (HP)', number(base.maxHp) + gain(stats.maxHp - base.maxHp, '')],
            ['Скорость бега', multiplier(base.speed / BASE_STATS.speed) + gain((stats.speed / base.speed - 1) * 100)],
            ['Скорость стрельбы', multiplier(base.attackSpeed) + gain((stats.attackSpeed / base.attackSpeed - 1) * 100)],
            ['Урон оружием', multiplier(base.damage) + gain((stats.damage / base.damage - 1) * 100)],
            ['Броня — снижение урона (%)', number(base.damageReduction * 100) + gain((stats.damageReduction - base.damageReduction) * 100, '')],
            ['Радиус взрывов', multiplier(base.explosionRadius)],
            ['Регенерация (HP / сек)', number(base.regeneration)],
            ['Время бонусов на земле', multiplier(base.bonusGroundDuration)],
            ['Длительность бонусов', multiplier(base.bonusDuration)],
        ] : [];
        return stats ? `<h2>Характеристики</h2><dl class="character-resolved-stats">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>` : '';    }

    private captureArsenalPortraitGeometry(): void {
        const portrait = this.root.querySelector<HTMLElement>('.character-selection-frame .character-portrait')!;
        const rect = portrait.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const style = getComputedStyle(portrait);
        this.equipment.element.style.setProperty('--arsenal-portrait-width', `${rect.width}px`);
        this.equipment.element.style.setProperty('--arsenal-portrait-height', `${rect.height}px`);
        this.equipment.element.style.setProperty('--arsenal-portrait-opacity', style.opacity);
    }

    private updateArsenalSidebar(): void {
        const source = this.root.querySelector('.character-selection-frame')!;
        const sidebar = this.equipment.sidebar;
        this.captureArsenalPortraitGeometry();
        const portrait = source.querySelector<HTMLImageElement>('.hero-portrait')!;
        this.equipment.element.style.setProperty('--arsenal-portrait-image', `url(${JSON.stringify(portrait.src)})`);
        sidebar.replaceChildren();
        const name = document.createElement('h1');
        name.className = 'arsenal-hero-name';
        name.textContent = source.querySelector('#character-name')!.textContent;
        const role = document.createElement('p');
        role.className = 'arsenal-hero-role';
        role.textContent = source.querySelector('.character-role')!.textContent;
        const features = document.createElement('div');
        features.className = 'arsenal-features';
        features.append(source.querySelector('.character-stats')!.cloneNode(true), source.querySelector('.character-ability')!.cloneNode(true));
        const ability = features.querySelector('.character-ability');
        const timing = ability?.querySelector('.character-ability-timing');
        const icon = ability?.querySelector('.character-ability-icon');
        const key = timing?.querySelector('kbd');
        if (icon && key) {
            const iconWrap = document.createElement('div'); iconWrap.className = 'arsenal-ability-icon-wrap';
            icon.replaceWith(iconWrap); iconWrap.append(icon, key);
            key.classList.add('arsenal-ability-key'); key.setAttribute('aria-label', 'Клавиша активации F');
        }
        if (timing) {
            const cooldown = timing.querySelector('span');
            timing.replaceChildren(...(cooldown ? [cooldown] : []));
            ability?.querySelector('.character-ability-name')?.after(timing);
        }
        const statistics = document.createElement('div');
        statistics.className = 'arsenal-statistics';
        if (this.previewImplants) statistics.innerHTML = this.statisticsMarkup(this.selectedCharacter, this.previewImplants);
        else statistics.append(source.querySelector('.character-stats-disclosure')!.cloneNode(true));
        statistics.querySelectorAll('dt').forEach(label => {
            if (label.textContent === 'Броня — снижение урона (%)') label.textContent = 'Снижение урона (%)';
        });
        sidebar.append(name, role, statistics, features);
        this.equipment.bindAbilityTooltip();
    }

}
