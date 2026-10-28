import { subscribeSounds, subscribeLaserSound, subscribeFlameSound, subscribePlasmaChargeSound } from './SoundEvents';
import type { SoundId, PlasmaChargeSound } from './SoundEvents';
import pistol from '@/assets/audio/sfx/pistol.wav?url';
import shotgun from '@/assets/audio/sfx/shotgun.wav?url';
import automatic from '@/assets/audio/sfx/automatic.wav?url';
import m16 from '@/assets/audio/sfx/m16.wav?url';
import ak47 from '@/assets/audio/sfx/ak47.wav?url';
import crossbow from '@/assets/audio/sfx/crossbow.wav?url';
import bazooka from '@/assets/audio/sfx/bazooka.wav?url';
import lightning from '@/assets/audio/sfx/lightning.wav?url';
import impulse from '@/assets/audio/sfx/impulse.wav?url';
import explosion from '@/assets/audio/sfx/explosion.wav?url';
import plasmaExplosion from '@/assets/audio/sfx/plasma-explosion.wav?url';
import iceExplosion from '@/assets/audio/sfx/ice-explosion.wav?url';
import disc from '@/assets/audio/sfx/disc.wav?url';
import skull from '@/assets/audio/sfx/skull.wav?url';
import boneBreak from '@/assets/audio/sfx/bone-break.wav?url';
import laser from '@/assets/audio/sfx/laser.wav?url';
import flame from '@/assets/audio/sfx/flame.wav?url';
import plasma from '@/assets/audio/sfx/plasma.wav?url';
import gauss from '@/assets/audio/sfx/gauss.wav?url';
import acid from '@/assets/audio/sfx/acid.wav?url';
import gaussCharge from '@/assets/audio/sfx/gauss-charge.wav?url';

const URLS: Record<SoundId, string> = { pistol, shotgun, automatic, m16, ak47, crossbow, bazooka, lightning, impulse, explosion, disc, skull, 'bone-break': boneBreak, laser, flame, plasma, gauss, 'gauss-charge': gaussCharge, 'plasma-explosion': plasmaExplosion, 'ice-explosion': iceExplosion, acid };

/** Decoded one-shots may overlap; old events are never replayed after loading or pause. */
export class CombatAudio {
    private context?: AudioContext;
    private output?: GainNode;
    private readonly buffers = new Map<SoundId, AudioBuffer>();
    private readonly voices = new Set<AudioBufferSourceNode>();
    private readonly abort = new AbortController();
    private readonly unsubscribe = subscribeSounds(sound => this.play(sound));
    private readonly unsubscribeLaser = subscribeLaserSound(active => this.setSustained('laser', active));
    private readonly unsubscribeFlame = subscribeFlameSound(active => this.setSustained('flame', active));
    private readonly sustainedVoices = new Map<SoundId, AudioBufferSourceNode>();
    private readonly unsubscribeCharge = subscribePlasmaChargeSound(state => this.setCharge(state));
    private chargeVoice?: AudioBufferSourceNode;
    private active = false;
    private disposed = false;
    private loading: Promise<unknown> = Promise.resolve();
    private volume = .15;

    unlock(): void {
        if (this.disposed) return;
        if (!this.context) {
            if (typeof AudioContext === 'undefined') return;
            const context = this.context = new AudioContext();
            const output = this.output = context.createGain();
            output.gain.value = this.volume;
            const limiter = context.createDynamicsCompressor();
            limiter.threshold.value = -12;
            limiter.knee.value = 8;
            limiter.ratio.value = 8;
            limiter.attack.value = .002;
            limiter.release.value = .12;
            output.connect(limiter).connect(context.destination);
            this.loading = Promise.all(Object.entries(URLS).map(([sound, url]) =>
                fetch(url, { signal: this.abort.signal }).then(response => {
                    if (!response.ok) throw new Error('Audio unavailable');
                    return response.arrayBuffer();
                }).then(data => context.decodeAudioData(data)).then(buffer => {
                    // Balance the loud blast against weapon shots before the shared master volume.
                    if (sound === 'explosion') {
                        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                            const samples = buffer.getChannelData(channel);
                            for (let i = 0; i < samples.length; i++) samples[i] *= .5;
                        }
                    }
                    if (!this.disposed) this.buffers.set(sound as SoundId, buffer);
                }).catch(() => { /* A missing sound must not interrupt gameplay. */ })
            ));
        }
        if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    }

    /** Explicit previews wait for decoding instead of losing their first click. */
    async prepare(sound: SoundId): Promise<boolean> {
        this.unlock();
        await this.loading;
        if (this.disposed || !this.context) return false;
        if (this.context.state === 'suspended') await this.context.resume().catch(() => {});
        return this.context.state === 'running' && this.buffers.has(sound);
    }

    setVolume(volume: number): void {
        if (!Number.isFinite(volume)) return;
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.output) this.output.gain.value = this.volume;
    }

    setActive(active: boolean): void {
        this.active = active;
        if (!active) {
            this.setCharge(null);
            this.setSustained('laser', false);
            this.setSustained('flame', false);
            for (const voice of this.voices) { voice.stop(); voice.disconnect(); }
            this.voices.clear();
        }
    }

    private setSustained(sound: 'laser' | 'flame', active: boolean): void {
        if (!active) {
            const voice = this.sustainedVoices.get(sound);
            if (voice) { voice.stop(); voice.disconnect(); this.sustainedVoices.delete(sound); }
            return;
        }
        const context = this.context, buffer = this.buffers.get(sound);
        if (this.sustainedVoices.has(sound) || !this.active || this.disposed || !context || context.state !== 'running' || !buffer || !this.output) return;
        const voice = context.createBufferSource();
        this.sustainedVoices.set(sound, voice);
        voice.buffer = buffer;
        voice.loop = true;
        if (sound === 'laser') { voice.loopStart = .2; voice.loopEnd = 3.8; }
        if (sound === 'flame') { voice.loopStart = .25; voice.loopEnd = 5.5; }
        voice.connect(this.output);
        voice.start();
    }

    private setCharge(state: PlasmaChargeSound): void {
        if (!state) {
            if (this.chargeVoice) { this.chargeVoice.stop(); this.chargeVoice.disconnect(); this.chargeVoice = undefined; }
            return;
        }
        const context = this.context, buffer = this.buffers.get('gauss-charge');
        if (!this.active || this.disposed || !context || context.state !== 'running' || !buffer || !this.output || state.durationMs <= 0) return;
        if (this.chargeVoice) {
            this.chargeVoice.playbackRate.value = buffer.duration * 1000 / state.durationMs;
            return;
        }
        const voice = this.chargeVoice = context.createBufferSource();
        voice.buffer = buffer;
        voice.playbackRate.value = buffer.duration * 1000 / state.durationMs;
        voice.connect(this.output);
        voice.start(0, Math.max(0, Math.min(.999, state.progress)) * buffer.duration);
    }

    private play(sound: SoundId): void {
        const context = this.context, buffer = this.buffers.get(sound);
        if (!this.active || this.disposed || !context || context.state !== 'running' || !buffer || !this.output) return;
        if (this.voices.size >= 24) {
            const oldest = this.voices.values().next().value!;
            oldest.stop(); oldest.disconnect(); this.voices.delete(oldest);
        }
        const voice = context.createBufferSource();
        voice.buffer = buffer;
        voice.connect(this.output);
        this.voices.add(voice);
        voice.onended = () => { this.voices.delete(voice); voice.disconnect(); };
        voice.start();
    }

    dispose(): void {
        this.disposed = true;
        this.setActive(false);
        this.unsubscribe();
        this.unsubscribeLaser();
        this.unsubscribeFlame();
        this.unsubscribeCharge();
        this.abort.abort();
        this.buffers.clear();
        if (this.context) void this.context.close().catch(() => {});
    }
}
