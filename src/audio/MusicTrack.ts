import { getMusicVolume, subscribeMusicVolume } from './MusicVolume';

/** A looping soundtrack, independent of the simulation clock. */
export class MusicTrack {
    private readonly audio: HTMLAudioElement;
    private readonly unsubscribeVolume: () => void;
    private pending = false;
    private generation = 0;
    private disposed = false;

    constructor(url: string, kind: 'menu' | 'battle') {
        this.audio = document.createElement('audio');
        this.audio.src = url;
        this.audio.loop = true;
        this.audio.preload = kind === 'battle' ? 'none' : 'auto';
        this.audio.volume = getMusicVolume();
        this.unsubscribeVolume = subscribeMusicVolume((volume) => {
            this.audio.volume = volume;
        });
        this.audio.hidden = true;
        this.audio.dataset.musicTrack = kind;
        document.body.append(this.audio);
    }

    play(): void {
        if (this.disposed || this.pending || !this.audio.paused) return;
        const generation = this.generation;
        this.pending = true;
        // A later player gesture retries autoplay rejection. Pausing during loading
        // can also reject with AbortError; neither should interrupt the game.
        void this.audio.play().catch(() => {}).finally(() => {
            if (generation === this.generation) this.pending = false;
        });
    }

    pause(): void {
        this.generation++;
        this.pending = false;
        this.audio.pause();
    }

    stop(): void {
        this.pause();
        this.audio.currentTime = 0;
    }

    dispose(): void {
        this.disposed = true;
        this.unsubscribeVolume();
        this.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.audio.remove();
    }
}
