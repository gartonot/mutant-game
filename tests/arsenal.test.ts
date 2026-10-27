import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arsenalBonuses, ARSENAL_CATEGORIES, ARSENAL_LIMIT, ARSENAL_STEP, EMPTY_ARSENAL, validateArsenal } from '../src/gameplay/arsenal';
import type { ArsenalAllocation } from '../src/gameplay/arsenal';
import { defaultLoadout } from '../src/gameplay/characters';
import { loadoutKey } from '../src/gameplay/EquipmentDraft';
import { validateLoadout } from '../src/gameplay/loadout';
import type { Loadout } from '../src/gameplay/loadout';
import { createCharacter } from '../src/gameplay/CharacterFactory';
import { EMPTY_IMPLANTS } from '../src/gameplay/implants';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { GameSession } from '../src/app/GameSession';

test('arsenal grants two percent fire rate, four percent damage and twenty-five percent ammo per step', () => {
    assert.deepEqual(arsenalBonuses(0), { attackSpeed: 0, damage: 0, ammo: 0 });
    assert.deepEqual(arsenalBonuses(5), { attackSpeed: .02, damage: .04, ammo: .25 });
    assert.deepEqual(arsenalBonuses(50), { attackSpeed: .2, damage: .4, ammo: 2.5 });
    for (const value of [-5, 1, 4.5, 55, NaN, Infinity, undefined, null, '5']) {
        assert.throws(() => arsenalBonuses(value as number));
    }
});

test('arsenal uses five-point steps and a separate shared fifty-point budget', () => {
    assert.equal(ARSENAL_STEP, 5);
    assert.equal(ARSENAL_LIMIT, 50);
    validateArsenal(EMPTY_ARSENAL);
    validateArsenal({ sidearm: 10, automatic: 10, shotgun: 10, special: 10, scientific: 10 });
    for (const category of ARSENAL_CATEGORIES) {
        validateArsenal({ ...EMPTY_ARSENAL, [category]: 50 });
        assert.throws(() => validateArsenal({ ...EMPTY_ARSENAL, [category]: 55 }), /limit/);
        for (const value of [-5, 1, 4.5, NaN, Infinity, undefined, null, '5']) {
            assert.throws(() => validateArsenal({ ...EMPTY_ARSENAL, [category]: value } as ArsenalAllocation));
        }
    }
    validateLoadout({ ...defaultLoadout('mercenary'), arsenal: { ...EMPTY_ARSENAL, sidearm: 50 },
        implants: { health: 100, attackSpeed: 0, moveSpeed: 0 } });
    assert.throws(() => validateLoadout({ ...defaultLoadout('mercenary'), arsenal: { ...EMPTY_ARSENAL, sidearm: 50, shotgun: 5 } }), /limit/);
});

test('arsenal rejects missing or unknown fields and malformed allocations', () => {
    const { scientific: _, ...incomplete } = EMPTY_ARSENAL;
    for (const value of [null, undefined, [], {}, incomplete, { ...EMPTY_ARSENAL, unknown: 0 }]) {
        assert.throws(() => validateArsenal(value as ArsenalAllocation));
    }
});

test('loadout identity includes category allocations with canonical absent zeros', () => {
    const base = defaultLoadout('mercenary');
    assert.equal(loadoutKey(base), loadoutKey({ ...base, arsenal: EMPTY_ARSENAL }));
    for (const category of ARSENAL_CATEGORIES) {
        assert.notEqual(loadoutKey(base), loadoutKey({ ...base, arsenal: { ...EMPTY_ARSENAL, [category]: 5 } }));
    }
    assert.notEqual(loadoutKey({ ...base, arsenal: { ...EMPTY_ARSENAL, sidearm: 5 } }),
        loadoutKey({ ...base, arsenal: { ...EMPTY_ARSENAL, automatic: 5 } }));
    assert.equal(loadoutKey({ ...base, arsenal: { ...EMPTY_ARSENAL, special: 5 } }),
        loadoutKey({ ...base, arsenal: { scientific: 0, special: 5, shotgun: 0, automatic: 0, sidearm: 0 } }));
});

test('arsenal changes only matching weapons and stacks with hero implants', () => {
    const loadout: Loadout = { ...defaultLoadout('mercenary'), weapons: [
        { slotId: '1', weaponId: 'pistol' }, { slotId: '3', weaponId: 'rifle' }],
        implants: { ...EMPTY_IMPLANTS, attackSpeed: 5, damage: 5 },
        arsenal: { ...EMPTY_ARSENAL, automatic: 5 } };
    const { weapons } = createCharacter(loadout);
    const pistol = weapons[0]!;
    const rifle = weapons[2]!;
    assert.equal(pistol.state.ammoRemaining, Infinity);
    assert.equal(pistol.state.shotIntervalMs, 600 / 1.02);
    assert.equal(pistol.tryFire(0, 0, 0, 0)![0].damage, 1.05);
    assert.equal(rifle.state.ammoRemaining, 150);
    assert.equal(rifle.state.shotIntervalMs, 300 / (1.02 * 1.02));
    assert.equal(rifle.tryFire(0, 0, 0, 0)![0].damage, 2.5 * (1.05 * 1.04));
    assert.equal(rifle.state.ammoRemaining, 149);
});

test('maximum arsenal ammo is usable, rounded to whole rounds and isolated from catalog and other weapons', () => {
    const catalog = JSON.stringify(WEAPON_DEFINITIONS);
    const { weapons } = createCharacter({ ...defaultLoadout('mercenary'), weapons: [
        { slotId: '1', weaponId: 'pistol' }, { slotId: '3', weaponId: 'rifle' }],
        arsenal: { ...EMPTY_ARSENAL, automatic: 50 } });
    const rifle = weapons[2]!;
    assert.equal(rifle.state.ammoRemaining, 420);
    assert.ok(rifle.tryFire(0, 0, 0, 0));
    rifle.state.addAmmo(1);
    assert.equal(rifle.state.ammoRemaining, 420);
    assert.equal(createWeapon('rifle').state.ammoRemaining, 120);
    assert.equal(createWeapon('grenade-launcher', 1, 1, undefined, 1, 1.25).state.ammoRemaining, 13);
    assert.equal(createWeapon('pistol', 1, 1, undefined, 1, 3.5).state.ammoRemaining, Infinity);
    assert.equal(JSON.stringify(WEAPON_DEFINITIONS), catalog);
});

test('session preserves arsenal across restart and replaces worlds when allocation changes', () => {
    const base = defaultLoadout('mercenary');
    const created: Loadout[] = [];
    const session = new GameSession(loadout => {
        created.push(loadout);
        return { resume() {}, getPlayerController: () => ({ resetInput() {}, switchToWeapon() {}, dispose() {} }) };
    });
    const first = session.start(base);
    session.showMenu();
    assert.equal(session.start({ ...base, arsenal: EMPTY_ARSENAL }), first);
    const arsenal = { ...EMPTY_ARSENAL, sidearm: 5 };
    assert.notEqual(session.start({ ...base, arsenal }), first);
    arsenal.sidearm = 10;
    session.pause();
    assert.equal(session.restart(), true);
    assert.equal(created.at(-1)!.arsenal!.sidearm, 5);
});
