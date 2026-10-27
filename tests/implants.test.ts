import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameSession } from '../src/app/GameSession';
import { createCharacter } from '../src/gameplay/CharacterFactory';
import { defaultLoadout } from '../src/gameplay/characters';
import { loadoutKey } from '../src/gameplay/EquipmentDraft';
import { applyImplants, EMPTY_IMPLANTS, validateImplants } from '../src/gameplay/implants';
import { validateLoadout } from '../src/gameplay/loadout';
import type { Loadout } from '../src/gameplay/loadout';
import { BASE_STATS } from '../src/gameplay/stats';
import { Enemy } from '../src/entities/enemy/Enemy';
import { resolvePlayerContact } from '../src/systems/spatial/playerContact';

test('armor adds two percentage points per step and shares the full implant budget', () => {
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, armor: 5 }).damageReduction, .02);
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, armor: 100 }).damageReduction, .4);
    validateImplants({ health: 20, attackSpeed: 20, moveSpeed: 20, damage: 20, armor: 20 });
    assert.throws(() => validateImplants({ health: 20, attackSpeed: 20, moveSpeed: 20, damage: 20, armor: 25 }), /limit/);
    for (const invalid of [-5, 1, 4.5, NaN, Infinity, undefined, null, '5']) {
        assert.throws(() => validateImplants({ ...EMPTY_IMPLANTS, armor: invalid as number }));
    }
    const legacy = { health: 5, attackSpeed: 10, moveSpeed: 15, damage: 20 };
    assert.deepEqual(applyImplants(BASE_STATS, legacy), applyImplants(BASE_STATS, { ...legacy, armor: 0 }));
    const base = defaultLoadout('mercenary');
    assert.equal(loadoutKey({ ...base, implants: legacy }), loadoutKey({ ...base, implants: { ...legacy, armor: 0 } }));
    assert.notEqual(loadoutKey({ ...base, implants: legacy }), loadoutKey({ ...base, implants: { ...legacy, armor: 5 } }));
});

test('armor reduces actual enemy contact damage once without reducing healing', () => {
    const { player } = createCharacter({ ...defaultLoadout('mercenary'), implants: { ...EMPTY_IMPLANTS, armor: 5 } });
    assert.equal(player.damageReduction, .02);
    player.x = 100; player.y = 100;
    const enemy = new Enemy(100, 100);
    resolvePlayerContact(player, enemy, false, 0, 1000, 1000);
    assert.equal(player.currentHp, 100 - enemy.damage * .98);
    assert.equal(player.damageTaken, enemy.damage * .98);
    player.heal(1);
    assert.equal(player.currentHp, 101 - enemy.damage * .98);
    player.takeDamage(1000);
    assert.equal(player.currentHp, 0);
    assert.equal(player.damageTaken, 101);
    const maximum = createCharacter({ ...defaultLoadout('mercenary'), implants: { ...EMPTY_IMPLANTS, armor: 100 } }).player;
    maximum.takeDamage(100);
    assert.equal(maximum.currentHp, 40);
    assert.equal(maximum.damageTaken, 60);
    const legacy = createCharacter(defaultLoadout('mercenary')).player;
    legacy.takeDamage(10);
    assert.equal(legacy.currentHp, 90);
});

test('implant allocations enforce five-point steps and one shared hundred-point budget', () => {
    validateImplants({ health: 40, attackSpeed: 35, moveSpeed: 25 });
    validateImplants({ health: 100, attackSpeed: 0, moveSpeed: 0 });
    for (const invalid of [-5, 1, 4.5, NaN, Infinity, undefined]) {
        assert.throws(() => validateImplants({ ...EMPTY_IMPLANTS, health: invalid as number }));
    }
    assert.throws(() => validateImplants({ health: 40, attackSpeed: 35, moveSpeed: 30 }), /limit/);
    assert.throws(() => validateLoadout({ ...defaultLoadout('mercenary'), implants: { health: 50, attackSpeed: 50, moveSpeed: 5 } }), /limit/);
});

test('implant steps add flat health and linearly scale shooting and running speed', () => {
    const result = applyImplants(BASE_STATS, { health: 10, attackSpeed: 15, moveSpeed: 20 });
    assert.equal(result.maxHp, 120);
    assert.equal(result.attackSpeed, 1.06);
    assert.equal(result.speed, 5 * 1.12);
    assert.deepEqual(applyImplants(BASE_STATS), BASE_STATS);
    assert.equal(BASE_STATS.maxHp, 100);
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, health: 100 }).maxHp, 300);
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, attackSpeed: 100 }).attackSpeed, 1.4);
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, moveSpeed: 100 }).speed, 8);
});

test('character factory applies implants relative to hero passives and fills the enlarged health pool', () => {
    const implants = { health: 5, attackSpeed: 5, moveSpeed: 5 };
    const witcher = createCharacter({ ...defaultLoadout('witcher'), implants });
    assert.equal(witcher.player.maxHp, 80);
    assert.equal(witcher.player.currentHp, 80);
    assert.equal(witcher.player.speed, 5.5 * 1.03);
    const assassin = createCharacter({ ...defaultLoadout('assassin'), implants });
    assert.equal(assassin.stats.attackSpeed, 1.3 * 1.02);
    assert.equal(assassin.stats.maxHp, 90);
});

test('damage implants add five percent per step relative to resolved hero damage', () => {
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, damage: 5 }).damage, 1.05);
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, damage: 15 }).damage, 1.15);
    assert.equal(applyImplants(BASE_STATS, { ...EMPTY_IMPLANTS, damage: 100 }).damage, 2);
    assert.equal(applyImplants({ ...BASE_STATS, damage: 1.5 }, { ...EMPTY_IMPLANTS, damage: 20 }).damage, 1.5 * 1.2);
    const hero = createCharacter({ ...defaultLoadout('mercenary'), implants: { ...EMPTY_IMPLANTS, damage: 5 } });
    assert.equal(hero.stats.damage, 1.05);
    assert.equal(BASE_STATS.damage, 1);
});

test('damage uses the shared implant budget and rejects invalid explicit values', () => {
    validateImplants({ health: 25, attackSpeed: 25, moveSpeed: 25, damage: 25 });
    assert.throws(() => validateImplants({ health: 25, attackSpeed: 25, moveSpeed: 25, damage: 30 }), /limit/);
    for (const invalid of [-5, 1, 4.5, NaN, Infinity, undefined, null, '5']) {
        assert.throws(() => validateImplants({ ...EMPTY_IMPLANTS, damage: invalid as number }));
    }
    const legacy = { health: 5, attackSpeed: 10, moveSpeed: 15 };
    assert.deepEqual(applyImplants(BASE_STATS, legacy), applyImplants(BASE_STATS, { ...legacy, damage: 0 }));
    const base = defaultLoadout('mercenary');
    assert.equal(loadoutKey({ ...base, implants: legacy }), loadoutKey({ ...base, implants: { ...legacy, damage: 0 } }));
    assert.notEqual(loadoutKey({ ...base, implants: legacy }), loadoutKey({ ...base, implants: { ...legacy, damage: 5 } }));
});

test('session resumes canonical zero implants, replaces changed allocations and retains restart points', () => {
    const base = defaultLoadout('mercenary');
    assert.equal(loadoutKey(base), loadoutKey({ ...base, implants: EMPTY_IMPLANTS }));
    const created: Loadout[] = [];
    const session = new GameSession(loadout => {
        created.push(loadout);
        return { resume() {}, getPlayerController: () => ({ resetInput() {}, switchToWeapon() {}, dispose() {} }) };
    });
    const first = session.start(base);
    session.showMenu();
    assert.equal(session.start({ ...base, implants: EMPTY_IMPLANTS }), first);
    const implants = { health: 5, attackSpeed: 0, moveSpeed: 0 };
    const second = session.start({ ...base, implants });
    assert.notEqual(first, second);
    implants.health = 10;
    session.pause();
    session.restart();
    assert.equal(created.at(-1)!.implants!.health, 5);
    assert.notEqual(loadoutKey({ ...base, implants: { health: 5, attackSpeed: 0, moveSpeed: 0 } }),
        loadoutKey({ ...base, implants: { health: 0, attackSpeed: 5, moveSpeed: 0 } }));
});
