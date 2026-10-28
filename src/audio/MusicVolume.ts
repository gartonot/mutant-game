const STORAGE_KEY = 'mutant.music-volume.v1';
const DEFAULT_VOLUME = 0.45;
const listeners = new Set<(volume: number) => void>();

function readSavedVolume(): number {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null || raw.trim() === '') return DEFAULT_VOLUME;
        const saved: unknown = JSON.parse(raw);
        return typeof saved === 'number' && Number.isFinite(saved) && saved >= 0 && saved <= 1
            ? saved
            : DEFAULT_VOLUME;
    } catch {
        return DEFAULT_VOLUME;
    }
}

let musicVolume = readSavedVolume();

/** Shared volume for menu and battle music, between 0 and 1. */
export function getMusicVolume(): number {
    return musicVolume;
}

export function setMusicVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const next = Math.min(1, Math.max(0, volume));
    if (next === musicVolume) return;
    musicVolume = next;
    try {
        localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
        // Volume still works for this session when browser storage is unavailable.
    }
    for (const listener of listeners) listener(next);
}

/** Listen for future changes; the returned function releases the subscription. */
export function subscribeMusicVolume(listener: (volume: number) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
