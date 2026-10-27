import { achievements, bonusesOf, formatBonus, formatTime, levelOf, progressOf } from '@/progression/Achievements';
import type { Achievement, Bonuses, RunStats, Totals } from '@/progression/Achievements';
import './rewards.css';

function icon(achievement: Achievement, level: number) {
    const tier = level >= 4 ? 'gold' : level >= 2 ? 'blue' : 'silver';
    return `<span class="award-icon ${tier} ${level === 0 ? 'locked' : ''}" data-award-icon="${achievement.icon}" aria-hidden="true"><b>${level}</b></span>`;
}
function progressRow(achievement: Achievement, totals: Totals) {
    const { level, target, value, unit, complete } = progressOf(achievement, totals);
    const text = complete ? 'Максимальный уровень' : `${value} / ${target}${unit}`;
    return `<button class="award-progress" data-achievement="${achievement.id}" aria-label="${achievement.name}, уровень ${level}, прогресс ${value} из ${target}" aria-describedby="award-tooltip">${icon(achievement, level)}<span class="award-progress-info"><strong>${achievement.name}</strong><progress max="${target}" value="${value}"></progress><small>${text}</small></span></button>`;
}
function earnedTile(achievement: Achievement, totals: Totals) {
    const level = levelOf(achievement, totals);
    return `<button class="award-tile" data-achievement="${achievement.id}" aria-label="${achievement.name}, уровень ${level}" aria-describedby="award-tooltip">${icon(achievement, level)}<span>${achievement.name}</span></button>`;
}

export class RewardsScreen {
    private readonly events = new AbortController();
    private root = document.querySelector<HTMLElement>('#rewards-screen')!;
    private tooltip = document.querySelector<HTMLElement>('#award-tooltip')!;
    private totals: Totals | undefined;
    private activeButton: HTMLElement | undefined;

    constructor(private onClose: () => void) {
        const { signal } = this.events;
        window.addEventListener('resize', () => this.positionTooltip(), { signal });
        this.root.addEventListener('scroll', () => this.positionTooltip(), { capture: true, signal });
        document.addEventListener('pointerdown', (event) => {
            const target = event.target;
            if (target instanceof Element && !target.closest('[data-achievement]')) this.hideTooltip();
        }, { signal });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || this.root.hidden) return;
            if (this.tooltip.classList.contains('visible')) this.hideTooltip();
            else this.close();
        }, { signal });
    }

    dispose(): void {
        this.events.abort();
        this.hideTooltip();
        this.root.hidden = true;
        this.root.replaceChildren();
    }

    private frame(title: string, content: string) {
        this.root.innerHTML = `<section class="rewards-frame" aria-labelledby="rewards-title"><h2 id="rewards-title" class="frame-title">${title}</h2><div class="rewards-body">${content}</div><button class="metal-button rewards-close">${title === 'Достижения' ? 'Главное меню' : 'Продолжить'}</button></section>`;
        this.root.hidden = false;
        this.root.querySelector<HTMLButtonElement>('.rewards-close')!.addEventListener('click', () => this.close());
        this.root.querySelectorAll<HTMLElement>('[data-achievement]').forEach((button) => {
            button.addEventListener('pointerenter', () => this.showTooltip(button));
            button.addEventListener('pointerleave', () => this.hideTooltip());
            button.addEventListener('focus', () => {
                if (button.matches(':focus-visible')) this.showTooltip(button);
            });
            button.addEventListener('blur', () => {
                if (this.activeButton === button) this.hideTooltip();
            });
        });
        this.root.scrollTop = 0;
        this.root.querySelector<HTMLButtonElement>('.rewards-close')!.focus({ preventScroll: true });
    }

    showAchievements(totals: Totals, storageAvailable: boolean) {
        this.totals = totals;
        const earned = achievements.filter((achievement) => levelOf(achievement, totals) > 0);
        const bonuses = bonusesOf(totals);
        const bonusItems = (Object.keys(bonuses) as (keyof Bonuses)[])
            .filter((effect) => bonuses[effect] > 0)
            .map((effect) => `<li>${formatBonus(effect, bonuses[effect])}${['health', 'damage', 'speed'].includes(effect) ? '' : ' · позже'}</li>`).join('');
        this.frame('Достижения', `<div class="achievement-layout"><aside class="player-summary"><h3 class="panel-tab">Моя статистика</h3><div class="summary-interior"><div class="player-profile">${icon(achievements[0], 0)}<strong>Игрок</strong></div><dl><div><dt>Сыграно боёв</dt><dd>${totals.games}</dd></div><div><dt>Уничтожено мутантов</dt><dd>${totals.kills}</dd></div><div><dt>Время в выживании</dt><dd>${formatTime(totals.seconds)}</dd></div><div><dt>Лучшее время</dt><dd>${formatTime(totals.bestSeconds)}</dd></div><div><dt>Пережито волн</dt><dd>${totals.waves}</dd></div></dl><h3 class="green-heading">Бонусы наград</h3><ul class="bonus-list">${bonusItems || '<li>Награды пока не получены.</li>'}</ul>${!storageAvailable ? '<p class="storage-notice" role="status">Браузер не разрешил сохранение. Прогресс доступен до закрытия страницы.</p>' : ''}</div></aside><section class="awards-panel"><h3 class="panel-tab">Мои награды</h3><div class="awards-interior"><h3 class="green-heading">Полученные награды (${earned.length})</h3>${earned.length ? `<div class="award-grid">${earned.map((achievement) => earnedTile(achievement, totals)).join('')}</div>` : '<p class="empty-awards">Пока нет полученных наград.</p>'}<h3 class="green-heading">Продвижение в наградах</h3><div class="award-progress-grid">${achievements.map((achievement) => progressRow(achievement, totals)).join('')}</div></div></section></div>`);
    }

    showResults(run: RunStats, before: Totals, after: Totals, storageAvailable: boolean, victory = false) {
        this.totals = after;
        const earned = achievements.filter((achievement) => levelOf(achievement, after) > levelOf(achievement, before));
        const progressed = achievements.filter((achievement) => after[achievement.metric] > before[achievement.metric]);
        this.frame(victory ? 'Победа!' : 'Статистика игры', `<section class="results-interior"><div class="run-summary"><span>Уничтожено мутантов <b>${run.kills}</b></span><span>Время выживания <b>${formatTime(run.seconds)}</b></span><span>Пережито волн <b>${run.waves}</b></span><span>Меткость <b>${run.shots ? `${run.accuracy}%` : '—'}</b></span></div><h3 class="green-heading">Полученные награды</h3>${earned.length ? `<div class="award-grid">${earned.map((achievement) => earnedTile(achievement, after)).join('')}</div><p class="reward-note">Новые уровни наград сохранены.</p>` : '<p class="empty-awards">Новых уровней наград в этом бою нет.</p>'}<h3 class="green-heading">Продвижение в наградах</h3><div class="award-progress-grid results-progress">${progressed.map((achievement) => progressRow(achievement, after)).join('')}</div>${!storageAvailable ? '<p class="storage-notice" role="status">Не удалось сохранить прогресс в браузере.</p>' : ''}</section>`);
    }

    close() {
        this.hideTooltip();
        this.root.hidden = true;
        this.onClose();
    }

    private showTooltip(button: HTMLElement) {
        const achievement = achievements.find((item) => item.id === button.dataset.achievement)!;
        if (!this.totals) return;
        this.activeButton = button;
        const { level, target, value: current, unit, complete } = progressOf(achievement, this.totals);
        const amount = achievement.perLevel * level;
        const currentBonus = formatBonus(achievement.effect, amount);
        const trackingNote = achievement.tracking === 'pending' ? '<small>Подсчёт подключим после добавления соответствующей игровой механики.</small>' : '';
        const bonusNote = ['health', 'damage', 'speed'].includes(achievement.effect) ? 'Бонусы применяются в начале нового боя.' : 'Механика этого бонуса появится позже.';
        this.tooltip.innerHTML = `<div class="tooltip-heading">${icon(achievement, level)}<div><strong>${achievement.name}</strong><span>${level} уровень${!complete ? ` · ${current} / ${target}${unit}` : ' · Максимум'}</span></div></div>${!complete ? `<progress max="${target}" value="${current}"></progress>` : ''}<p>${achievement.requirement}</p><div class="tooltip-bonus">${achievement.bonus}</div><small>Текущий бонус: ${currentBonus}.<br>${bonusNote}</small>${trackingNote}`;
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            for (const child of this.tooltip.children) {
                child.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
            }
        }
        this.tooltip.classList.add('visible');
        this.tooltip.setAttribute('aria-hidden', 'false');
        this.positionTooltip();
    }

    private positionTooltip() {
        if (!this.activeButton || !this.tooltip.classList.contains('visible')) return;
        const anchor = this.activeButton.getBoundingClientRect();
        this.tooltip.style.maxHeight = 'calc(100svh - 20px)';
        const width = this.tooltip.offsetWidth;
        let height = this.tooltip.offsetHeight;
        let left: number;
        let top: number;
        if (anchor.right + 12 + width <= window.innerWidth - 10) {
            left = anchor.right + 12;
            top = anchor.top;
        } else if (anchor.left - width - 12 >= 10) {
            left = anchor.left - width - 12;
            top = anchor.top;
        } else {
            left = anchor.left + (anchor.width - width) / 2;
            const below = window.innerHeight - anchor.bottom - 22;
            const above = anchor.top - 22;
            const placeBelow = below >= height || below >= above;
            this.tooltip.style.maxHeight = `${Math.max(100, placeBelow ? below : above)}px`;
            height = this.tooltip.offsetHeight;
            top = placeBelow ? anchor.bottom + 12 : anchor.top - height - 12;
        }
        this.tooltip.style.left = `${Math.max(10, Math.min(left, window.innerWidth - width - 10))}px`;
        this.tooltip.style.top = `${Math.max(10, Math.min(top, window.innerHeight - height - 10))}px`;
    }

    private hideTooltip() {
        this.activeButton = undefined;
        this.tooltip.classList.remove('visible');
        this.tooltip.setAttribute('aria-hidden', 'true');
    }
}


