import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleArtwork } from '../src/app/BattleArtwork';

test('Play shares menu preparation and waits for all artwork', async () => {
    let finish!: (value: boolean[]) => void;
    let heroes = 0, weapons = 0;
    const prepare = createBattleArtwork({
        hero: async () => { heroes++; return true; },
        weapons: () => { weapons++; return new Promise(resolve => { finish = resolve; }); },
        enemies: async () => [true], ability: async () => {},
    });
    const warm = prepare('mercenary');
    assert.equal(prepare('mercenary'), warm);
    let ready = false;
    void warm.then(() => { ready = true; });
    await Promise.resolve();
    assert.equal(ready, false);
    finish([true]);
    await warm;
    assert.equal(prepare('mercenary'), warm);
    assert.equal(heroes, 1);
    assert.equal(weapons, 1);
});

test('a failed warm-up is retryable and switching heroes prepares the new hero', async () => {
    let success = false;
    const requested: string[] = [];
    const prepare = createBattleArtwork({
        hero: async id => { requested.push(id); return success; },
        weapons: async () => [true], enemies: async () => [true], ability: async () => {},
    });
    await assert.rejects(prepare('mercenary'));
    success = true;
    await prepare('mercenary');
    await prepare('assassin');
    assert.deepEqual(requested, ['mercenary', 'mercenary', 'assassin']);
});
