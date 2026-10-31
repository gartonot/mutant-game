import type { CharacterId } from '@/gameplay/ids';

type Sources = {
    hero: (id: CharacterId) => Promise<boolean>;
    weapons: () => Promise<boolean[]>;
    enemies: () => Promise<boolean[]>;
    ability: (id: CharacterId) => Promise<void>;
};

/** Menu warm-up and Play share exactly the same work. Failed attempts remain retryable. */
export function createBattleArtwork(sources: Sources) {
    const pending = new Map<CharacterId, Promise<void>>();
    return (id: CharacterId): Promise<void> => {
        const cached = pending.get(id);
        if (cached) return cached;
        const ready = Promise.all([
            sources.hero(id), sources.weapons(), sources.enemies(), sources.ability(id),
        ]).then(([hero, weapons, enemies]) => {
            if (!hero || !weapons.every(Boolean) || !enemies.every(Boolean)) throw new Error('Battle artwork unavailable');
        }).catch(error => {
            pending.delete(id);
            throw error;
        });
        pending.set(id, ready);
        return ready;
    };
}
