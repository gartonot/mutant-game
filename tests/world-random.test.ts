import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameWorld } from '../src/systems/GameWorld';
import { Player } from '../src/entities/player/Player';
import type { PlayerController } from '../src/systems/Player/PlayerController';
import type { WaveSystem } from '../src/systems/WaveSystem/WaveSystem';

test('world passes injected RNG to waves and allows a separate wave stream', () => {
    const controller = { getPlayer: () => new Player() } as PlayerController;
    let drops = 0, waves = 0;
    const world = new GameWorld(controller, () => { drops++; return .25; }, [], [], [], undefined,
        () => { waves++; return .75; });
    const spawn = (w: GameWorld) => (w as unknown as { waveSystem: WaveSystem }).waveSystem.spawnWave()
        .map(e => ({ x: e.x, y: e.y }));
    const first = spawn(world);
    assert.ok(waves > 0);
    assert.equal(drops, 0, 'spawning cannot consume an independent loot stream');
    const same = new GameWorld(controller, () => .75);
    assert.deepEqual(spawn(same), first, 'default wave RNG must use the supplied world RNG');
    const different = new GameWorld(controller, () => .25);
    assert.notDeepEqual(spawn(different), first);
});
