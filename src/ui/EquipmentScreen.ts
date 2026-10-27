import { EquipmentDraft } from '@/gameplay/EquipmentDraft';
import type { CharacterId, WeaponCategory } from '@/gameplay/ids';
import { WEAPON_SLOTS } from '@/gameplay/loadout';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import { inventoryWeaponIcon as weaponIcon, refreshWeaponIconsWhenReady } from '@/rendering/InventoryWeaponArt';
import './equipment.css';

const categories: Record<WeaponCategory, string> = {
    sidearm: 'Пистолеты', automatic: 'Автоматы', shotgun: 'Дробовики', special: 'Особое оружие', scientific: 'Энергетическое',
};

export class EquipmentScreen {
    private readonly events = new AbortController();
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
        window.addEventListener('resize', () => this.hideTooltip(), { signal: this.events.signal });
        window.addEventListener('scroll', () => this.hideTooltip(), { capture: true, signal: this.events.signal });
        this.render();
        refreshWeaponIconsWhenReady(this.element);
    }
    setCharacter(character: CharacterId): void { this.character = character; this.render(); }
    dispose(): void {
        this.events.abort();
        this.tooltip.remove();
        this.element.remove();
    }
    private render(): void {
        const loadout = this.draft.get(this.character);
        this.hideTooltip();
        const order = ['rifle', 'shotgun', 'flamethrower', 'plasma-cannon', 'm16', 'machine-gun', 'ak47', 'plasma-auto', 'laser', 'skull-launcher', 'plasma-grenade', 'double-barrel', 'grenade-launcher'];
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
                <section class="equipment-box"><h2>Твои бонусы <small>Скоро</small></h2><div class="bonus-slots" aria-label="Бонусы пока недоступны">
                    ${Array.from({ length: 6 }, (_, i) => `<div class="bonus-placeholder ${i > 3 ? 'locked' : ''}" aria-label="Бонус ${i + 1}: ${i > 3 ? 'закрыт' : 'недоступен'}">${i > 3 ? '🔒' : '—'}</div>`).join('')}
                </div></section>
            </div>
            <div class="equipment-currency"><span class="equipment-gear" aria-hidden="true">⚙</span><span>Очки снаряжения <b>—</b></span><button disabled>Обменять</button><small>Обмен пока недоступен</small></div>
            <div class="equipment-catalog" role="group" aria-label="Каталог оружия">
                ${visibleWeapons.map(weapon => {
        const slot = this.draft.slotFor(weapon.id);
        const equipped = loadout.weapons.some(entry => entry.weaponId === weapon.id);
        const disabled = !!slot.fixedWeapon || (!equipped && !this.draft.canEquip(this.character, weapon.id));
        return `<button class="equipment-item" data-weapon="${weapon.id}" data-finish="${['rifle', 'shotgun', 'flamethrower', 'plasma-cannon', 'skull-launcher'].includes(weapon.id) ? 'steel' : 'olive'}" data-info="${weapon.id}" aria-pressed="${equipped}" aria-disabled="${disabled}" aria-label="${equipped ? 'Снять' : 'Выбрать'} ${weapon.name}"><img data-weapon-art="${weapon.id}" src="${weaponIcon(weapon.id)}" alt=""/></button>`;
    }).join('')}
            </div>
            <span class="equipment-sr-status" role="status">Выбрано ${loadout.weapons.length - 1} из 4 дополнительных оружий</span>`;
        this.element.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(button => button.addEventListener('click', () => {
            const slotId = button.dataset.slot!;
            this.draft.assign(this.character, slotId, null); this.render(); this.onChange();
            this.element.querySelector<HTMLButtonElement>(`[data-slot="${slotId}"]`)!.focus();
        }));
        visibleWeapons.forEach(weapon => this.element.querySelector(`[data-weapon="${weapon.id}"]`)!.addEventListener('click', () => {
            const equipped = this.draft.get(this.character).weapons.find(entry => entry.weaponId === weapon.id);
            if (equipped) this.draft.assign(this.character, equipped.slotId, null);
            else if (this.draft.canEquip(this.character, weapon.id)) this.draft.equip(this.character, weapon.id);
            else return;
            this.render();
        refreshWeaponIconsWhenReady(this.element); this.onChange();
            this.element.querySelector<HTMLButtonElement>(`[data-weapon="${weapon.id}"]`)!.focus();
        }));
        this.element.querySelectorAll<HTMLButtonElement>('[data-info]').forEach(button => {
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
        const weapon = WEAPON_DEFINITIONS[button.dataset.info as keyof typeof WEAPON_DEFINITIONS];
        const equipped = this.draft.get(this.character).weapons.some(entry => entry.weaponId === weapon.id);
        const blocked = !equipped && !this.draft.canEquip(this.character, weapon.id);
        this.hideTooltip();
        this.tooltip.innerHTML = `<div class="equipment-tooltip-body"><strong>${weapon.name}</strong><p>+${weapon.ammo.kind === 'finite' ? weapon.ammo.initial : '∞'} патронов</p><p>${weapon.description ?? ''}</p><small>${equipped ? 'Нажми, чтобы снять' : blocked ? 'Сначала сними оружие этого типа' : categories[weapon.category] + ' · нажми, чтобы выбрать'}</small></div>`;
        this.tooltip.hidden = false;
        button.setAttribute('aria-describedby', this.tooltip.id);
        const anchor = button.getBoundingClientRect(), tip = this.tooltip.getBoundingClientRect();
        this.tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tip.width - 8, anchor.left + anchor.width / 2 - tip.width / 2))}px`;
        const top = anchor.top - tip.height - 10;
        this.tooltip.style.top = `${Math.max(8, top >= 8 ? top : Math.min(anchor.bottom + 10, window.innerHeight - tip.height - 8))}px`;
    }
}

