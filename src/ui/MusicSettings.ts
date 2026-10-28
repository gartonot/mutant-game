import { getMusicVolume, setMusicVolume, subscribeMusicVolume } from '@/audio/MusicVolume';
import './music-settings.css';

/** The same modal is used by the main menu and the paused game. */
export class MusicSettings {
    private readonly dialog = document.createElement('dialog');
    private readonly events = new AbortController();
    private readonly unsubscribe: () => void;
    private opener?: HTMLElement;

    constructor() {
        this.dialog.className = 'music-settings';
        this.dialog.setAttribute('aria-labelledby', 'music-settings-title');
        this.dialog.innerHTML = `
            <div class="music-settings-heading">
                <span class="music-settings-icon" aria-hidden="true">♫</span>
                <div><small>ЗВУК</small><h2 id="music-settings-title">Настройки музыки</h2></div>
                <button class="music-settings-close" aria-label="Закрыть настройки">×</button>
            </div>
            <p>Громкость музыки в меню и в бою</p>
            <div class="music-volume-label"><label for="music-volume">Музыка</label><output for="music-volume" id="music-volume-value"></output></div>
            <div class="music-volume-controls">
                <button type="button" data-quieter aria-label="Тише">−</button>
                <input id="music-volume" type="range" min="0" max="100" step="1" />
                <button type="button" data-louder aria-label="Громче">+</button>
            </div>
            <div class="music-volume-scale"><span>Без звука</span><span>Максимум</span></div>
            <button class="music-settings-done">Готово</button>`;
        document.body.append(this.dialog);
        const slider = this.dialog.querySelector<HTMLInputElement>('#music-volume')!;
        const output = this.dialog.querySelector<HTMLOutputElement>('output')!;
        const render = (volume: number) => {
            const percent = Math.round(volume * 100);
            slider.value = String(percent);
            slider.style.setProperty('--volume', `${percent}%`);
            slider.setAttribute('aria-valuetext', percent === 0 ? 'Без звука' : `${percent}%`);
            output.value = `${percent}%`;
        };
        render(getMusicVolume());
        this.unsubscribe = subscribeMusicVolume(render);
        const { signal } = this.events;
        slider.addEventListener('input', () => setMusicVolume(Number(slider.value) / 100), { signal });
        this.dialog.querySelector('[data-quieter]')!.addEventListener('click', () => setMusicVolume(Math.max(0, getMusicVolume() - 0.05)), { signal });
        this.dialog.querySelector('[data-louder]')!.addEventListener('click', () => setMusicVolume(Math.min(1, getMusicVolume() + 0.05)), { signal });
        for (const button of this.dialog.querySelectorAll('.music-settings-close, .music-settings-done')) {
            button.addEventListener('click', () => this.close(), { signal });
        }
        this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); }, { signal });
        this.dialog.addEventListener('keydown', event => {
            // Closing settings must not also dismiss pause or resume combat.
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); this.close(); }
        }, { signal });
    }

    get isOpen(): boolean { return this.dialog.open; }

    show(): void {
        if (this.isOpen) return;
        this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        this.dialog.showModal();
        this.dialog.querySelector<HTMLInputElement>('input')!.focus();
    }

    close(): void {
        if (!this.isOpen) return;
        this.dialog.close();
        this.opener?.focus();
    }

    dispose(): void {
        this.events.abort();
        this.unsubscribe();
        this.dialog.close();
        this.dialog.remove();
    }
}
