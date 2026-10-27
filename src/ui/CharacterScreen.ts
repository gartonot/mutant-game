import { CHARACTER_PRESENTATIONS as characters, LOCKED_CHARACTER_PRESENTATIONS as lockedCharacters } from './CharacterPresentations';
import { EquipmentScreen } from './EquipmentScreen';
import { UpgradesScreen } from './UpgradesScreen';
import './characters.css';

const lock = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M6 11V7a6 6 0 0 1 12 0v4" fill="none" stroke="currentColor" stroke-width="3"/><rect x="2" y="10" width="20" height="17" rx="3" fill="currentColor"/><path d="M12 16v6" stroke="#153044" stroke-width="3"/></svg>';

export class CharacterScreen {
    private readonly events = new AbortController();
    private root = document.createElement('main');
    private selected = 2;
    private previewLocked = false;
    private equipment: EquipmentScreen;
    private upgrades = new UpgradesScreen();
    get selectedLoadout() { return this.equipment.draft.get(this.selectedCharacter); }
    get selectedCharacter() { return characters[this.selected].id; }

    constructor(private onClose: () => void, private onPlay: () => void) {
        this.root.className = 'character-screen';
        this.root.hidden = true;
        document.body.append(this.root);
        this.root.innerHTML = `
            <section class="preparation" aria-label="Подготовка к бою">
                <nav class="preparation-tabs" aria-label="Подготовка">
                    <button class="preparation-tab active" data-tab="character" aria-current="page">Персонаж</button>
                    <button class="preparation-tab" data-tab="equipment">Снаряжение</button>
                    <button class="preparation-tab" data-tab="upgrades">Улучшения</button>
                </nav>
                <div class="character-frame">
                    <div class="character-dossier">
                        <div class="character-portrait"><img class="hero-portrait" alt=""/><span class="portrait-role"></span></div>
                        <section class="character-details" aria-labelledby="character-name">
                            <h1 id="character-name"></h1>
                            <div class="character-info" tabindex="0" role="region" aria-label="Характеристики и история персонажа">
                                <div class="character-stats"></div>
                                <div class="character-ability"></div>
                                <h2>История персонажа</h2><div class="character-story"></div>
                            </div>
                        </section>
                    </div>
                    <div class="roster" role="group" aria-label="Выбор персонажа">
                        ${characters.map((c, i) => `<button class="character-card" data-character="${i}" aria-label="${c.name}" aria-pressed="false"><img src="${c.image}" alt=""/><span>${c.name}</span></button>`).join('')}
                        ${lockedCharacters.map((c, i) => `<button class="character-card character-preview" data-preview="${i}" aria-label="${c.name}, закрыт — посмотреть описание" aria-pressed="false"><img src="${c.image}" alt=""/><span>${c.name}</span><span class="character-lock">${lock}</span></button>`).join('')}
                    </div>
                </div>
                <footer class="preparation-footer"><button class="preparation-back">Главное меню</button><button class="preparation-play">Играть</button><span class="preparation-mode">Выживание</span></footer>
            </section>`;
        this.equipment = new EquipmentScreen(() => this.updatePlay());
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
        this.root.querySelector('.preparation-back')!.addEventListener('click', () => { this.hide(); this.onClose(); });
        this.root.querySelector('.preparation-play')!.addEventListener('click', () => { if (this.previewLocked || !this.equipment.draft.canPlay(this.selectedCharacter)) return; this.hide(); this.onPlay(); });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !this.root.hidden) { this.hide(); this.onClose(); }
        }, { signal: this.events.signal });
        this.select(this.selected);
    }

    show() {
        this.root.hidden = false;
        this.openTab('character');
        this.select(this.selected);
        this.root.querySelector<HTMLButtonElement>(`[data-character="${this.selected}"]`)!.focus();
    }

    hide() { this.root.hidden = true; }

    dispose(): void {
        this.events.abort();
        this.equipment.dispose();
        this.root.remove();
    }

    private openTab(tab: string) {
        this.root.querySelector<HTMLElement>('.character-frame:not(.equipment-frame):not(.upgrades-frame)')!.hidden = tab !== 'character';
        this.equipment.element.hidden = tab !== 'equipment';
        this.upgrades.element.hidden = tab !== 'upgrades';
        this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => {
            const active = button.dataset.tab === tab;
            button.classList.toggle('active', active);
            if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
        });
    }

    private updatePlay() {
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

    private renderPortrait(c: Omit<typeof characters[number], 'id'> & { abilityDescription?: string; previewNote?: string }) {
        const portrait = this.root.querySelector<HTMLImageElement>('.hero-portrait')!;
        portrait.src = c.image;
        portrait.alt = c.name;
        this.root.querySelector('.portrait-role')!.textContent = c.role;
        this.root.querySelector('#character-name')!.textContent = c.name;
        this.root.querySelector('.character-stats')!.innerHTML = c.bonuses.map(b => `<p class="positive">${b}</p>`).join('') + (c.penalty ? `<p class="negative">${c.penalty}</p>` : '');
        this.root.querySelector('.character-ability')!.innerHTML = `${c.ability ? `Способность: ${c.ability} <kbd>F</kbd>` : ''}${c.abilityDescription ? `<p class="character-ability-description">${c.abilityDescription}</p>` : ''}${this.previewLocked ? `<p class="character-preview-note">${c.previewNote ?? 'Персонаж закрыт. Характеристики и способность показаны для ознакомления.'}</p>` : ''}`;
        this.root.querySelector('.character-ability')!.insertAdjacentHTML('beforeend', '<p class=\"character-preview-note\">Сейчас выбор меняет внешность. Бонусы и способности пока не действуют.</p>');
        this.root.querySelector<HTMLElement>('.character-info h2')!.hidden = c.story.length === 0;
        this.root.querySelector('.character-story')!.innerHTML = c.story.map(p => `<p>${p}</p>`).join('');
        this.root.querySelector('.character-info')!.scrollTop = 0;
    }

}

