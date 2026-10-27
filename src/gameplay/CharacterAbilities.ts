import type { CharacterId } from './ids';

export interface AbilityConfig { name: string; cooldownMs: number; durationMs: number }
export interface AbilityState { name: string; cooldownMs: number; remainingCooldownMs: number; remainingActiveMs: number }
export const CHARACTER_ABILITIES: Partial<Record<CharacterId, AbilityConfig>> = {
    destroyer: { name: 'Удар артиллерии', cooldownMs: 60000, durationMs: 1000 },
    assassin: { name: 'Страх жертвы', cooldownMs: 30000, durationMs: 5000 },
    mercenary: { name: 'Два оружия', cooldownMs: 45000, durationMs: 8000 },
};

/** Cooldown starts at activation and advances only with the battle simulation. */
export class CharacterAbilityClock {
    private cooldown = 0;
    private active = 0;
    constructor(private readonly config?: AbilityConfig) {}
    get state(): AbilityState | null {
        return this.config ? { name: this.config.name, cooldownMs: this.config.cooldownMs,
            remainingCooldownMs: this.cooldown, remainingActiveMs: this.active } : null;
    }
    activate(): boolean {
        if (!this.config || this.cooldown > 0) return false;
        this.cooldown = this.config.cooldownMs;
        this.active = this.config.durationMs;
        return true;
    }
    update(deltaMs: number): void {
        const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
        this.cooldown = Math.max(0, this.cooldown - delta);
        this.active = Math.max(0, this.active - delta);
    }
}
