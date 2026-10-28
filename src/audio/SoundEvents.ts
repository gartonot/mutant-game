import type { WeaponId } from '@/gameplay/ids';

export type SoundId = 'pistol' | 'shotgun' | 'automatic' | 'm16' | 'ak47' | 'crossbow' | 'bazooka' | 'lightning' | 'impulse' | 'disc' | 'explosion' | 'skull' | 'bone-break' | 'laser' | 'flame' | 'plasma' | 'gauss' | 'gauss-charge' | 'ice-explosion' | 'acid' | 'plasma-explosion';
const listeners = new Set<(sound: SoundId) => void>();
export type PlasmaChargeSound = { progress: number; durationMs: number } | null;
const chargeListeners = new Set<(state: PlasmaChargeSound) => void>();
export function setPlasmaChargeSound(state: PlasmaChargeSound): void {
    for (const listener of chargeListeners) listener(state);
}
export function subscribePlasmaChargeSound(listener: (state: PlasmaChargeSound) => void): () => void {
    chargeListeners.add(listener);
    return () => { chargeListeners.delete(listener); };
}
const flameListeners = new Set<(active: boolean) => void>();
export function setFlameSoundActive(active: boolean): void {
    for (const listener of flameListeners) listener(active);
}
export function subscribeFlameSound(listener: (active: boolean) => void): () => void {
    flameListeners.add(listener);
    return () => { flameListeners.delete(listener); };
}
const laserListeners = new Set<(active: boolean) => void>();
export function setLaserSoundActive(active: boolean): void {
    for (const listener of laserListeners) listener(active);
}
export function subscribeLaserSound(listener: (active: boolean) => void): () => void {
    laserListeners.add(listener);
    return () => { laserListeners.delete(listener); };
}

export function emitSound(sound: SoundId): void {
    for (const listener of listeners) listener(sound);
}

export function subscribeSounds(listener: (sound: SoundId) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function weaponSound(id: WeaponId): SoundId {
    switch (id) {
        case 'rifle': case 'machine-gun': return 'automatic';
        case 'm16': return 'm16';
        case 'ak47': return 'ak47';
        case 'shotgun': case 'double-barrel': return 'shotgun';
        case 'crossbow': return 'crossbow';
        case 'grenade-launcher': return 'bazooka';
        case 'tesla': return 'lightning';
        case 'impulse': return 'impulse';
        case 'disc-launcher': return 'disc';
        case 'skull-launcher': return 'skull';
        case 'laser': return 'laser';
        case 'flamethrower': return 'flame';
        case 'plasma-auto': return 'plasma';
        case 'plasma-cannon': return 'gauss';
        case 'acid-gun': return 'acid';
        default: return 'pistol';
    }
}
