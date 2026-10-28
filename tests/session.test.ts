import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameSession } from '../src/app/GameSession';
import { defaultLoadout } from '../src/gameplay/characters';
import type { Loadout } from '../src/gameplay/loadout';

class FakeWorld {
    resets = 0;
    disposals = 0;
    resumes = 0;
    selected = -1;
    hp = 37;
    ammo = 19;
    controller = {
        resetInput: () => { this.resets++; },
        dispose: () => { this.disposals++; },
        switchToWeapon: (index: number) => { this.selected = index; },
    };
    getPlayerController() { return this.controller; }
    resume() { this.resumes++; }
}
function fixture() {
    const loadouts: Loadout[] = [];
    const session = new GameSession(loadout => { loadouts.push(loadout); return new FakeWorld(); });
    return { session, loadouts };
}

test('session resumes the same loadout without resetting health or ammunition', () => {
    const { session, loadouts } = fixture();
    assert.equal(session.phase, 'menu');
    const loadout = defaultLoadout('mercenary');
    const world = session.start(loadout);
    assert.equal(session.active, true);
    session.showMenu();
    assert.equal(session.playing, false);
    assert.equal(world.disposals, 0);
    assert.equal(session.start(structuredClone(loadout)), world);
    assert.equal(loadouts.length, 1);
    assert.equal(world.hp, 37);
    assert.equal(world.ammo, 19);
    assert.equal(world.selected, 0);
    assert.equal(world.resets, 3);
});

test('continuation label can distinguish a retained run without mutating it', () => {
    const { session } = fixture();
    const loadout = defaultLoadout('mercenary');
    assert.equal(session.canContinue(loadout), false);
    const world = session.start(loadout);
    session.showMenu();
    assert.equal(session.canContinue(structuredClone(loadout)), true);
    assert.equal(session.canContinue(defaultLoadout('assassin')), false);
    assert.equal(session.world, world);
    assert.equal(world.disposals, 0);
    session.dispose();
    assert.equal(session.canContinue(loadout), false);
});

test('pause/resume is idempotent and clears input at each valid transition', () => {
    const { session } = fixture();
    assert.equal(session.pause(), false);
    assert.equal(session.resume(), false);
    assert.equal(session.restart(), false);
    const world = session.start(defaultLoadout('assassin'));
    assert.equal(session.pause(), true);
    assert.equal(session.pause(), false);
    assert.equal(session.active, false);
    assert.equal(session.playing, true);
    assert.equal(session.paused, true);
    assert.equal(session.resume(), true);
    assert.equal(session.resume(), false);
    assert.equal(world.resets, 3);
    assert.equal(world.resumes, 2);
});

test('new character or loadout releases old input and owns exactly one world', () => {
    const { session } = fixture();
    const first = session.start(defaultLoadout('mercenary'));
    const second = session.start(defaultLoadout('destroyer'));
    assert.equal(first.disposals, 1);
    const changed = defaultLoadout('destroyer');
    const third = session.start({ ...changed, weapons: [...changed.weapons, { slotId: '3', weaponId: 'rifle' }] });
    assert.equal(second.disposals, 1);
    assert.equal(third.disposals, 0);
    session.dispose(); session.dispose();
    assert.equal(third.disposals, 1);
    assert.equal(session.world, undefined);
    assert.equal(session.phase, 'menu');
});

test('restart uses the retained loadout snapshot and waits for UI resume', () => {
    const { session, loadouts } = fixture();
    const loadout = defaultLoadout('mercenary');
    const original = session.start(loadout);
    // Neither callers nor a future factory may mutate the retained restart configuration.
    (loadout as { character: string }).character = 'assassin';
    (loadouts[0] as { character: string }).character = 'destroyer';
    assert.equal(session.restart(), false);
    session.pause();
    assert.equal(session.restart(), true);
    assert.equal(loadouts[1].character, 'mercenary');
    assert.notEqual(session.world, original);
    assert.equal(original.disposals, 1);
    assert.equal(session.paused, true);
    session.resume();
    assert.equal(session.active, true);
});

test('factory failure leaves the previous paused run intact', () => {
    let fail = false;
    const session = new GameSession(() => { if (fail) throw Error('invalid future content'); return new FakeWorld(); });
    const first = session.start(defaultLoadout('mercenary'));
    session.pause(); fail = true;
    assert.throws(() => session.restart(), /invalid future content/);
    assert.equal(session.world, first);
    assert.equal(first.disposals, 0);
    assert.equal(session.paused, true);
    assert.throws(() => session.start(defaultLoadout('assassin')), /invalid future content/);
    assert.equal(session.world, first);
    assert.equal(first.disposals, 0);
});
