import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsWeapon, placeStartingWeapons, validateLoadout } from '../src/gameplay/loadout';
import { defaultLoadout } from '../src/gameplay/characters';
import { EquipmentDraft } from '../src/gameplay/EquipmentDraft';
import { WEAPON_IDS } from '../src/gameplay/ids';
import type { CharacterId, WeaponId } from '../src/gameplay/ids';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { WeaponState } from '../src/gameplay/WeaponState';

test('starting grants use compatible slots independently of grant order and custom slot IDs', () => {
    assert.deepEqual(placeStartingWeapons(['rifle', 'pistol', 'plasma-cannon', 'shotgun']), [
        { slotId: '3', weaponId: 'rifle' }, { slotId: '1', weaponId: 'pistol' },
        { slotId: '5', weaponId: 'plasma-cannon' }, { slotId: '2', weaponId: 'shotgun' },
    ]);
    const slots = [
        { id: 'primary', allowedCategories: ['automatic'] },
        { id: 'backup', fixedWeapon: 'pistol' },
    ] as const;
    const draft = new EquipmentDraft(slots);
    assert.deepEqual(defaultLoadout('mercenary', slots).weapons, [{ slotId: 'backup', weaponId: 'pistol' }]);
    assert.equal(draft.equip('mercenary', 'rifle'), 'primary');
    assert.equal(draft.canPlay('mercenary'), true);
    assert.throws(() => placeStartingWeapons(['rifle', 'ak47']));
});

test('fixed slots share compatibility rules with drafts and loadout validation', () => {
    const slots = [{ id: 'fixed', fixedWeapon: 'pistol' }, { id: 'open' }] as const;
    assert.equal(acceptsWeapon(slots[0], 'rifle'), false);
    assert.equal(acceptsWeapon(slots[0], 'pistol'), true);
    const draft = new EquipmentDraft(slots);
    assert.equal(draft.slotFor('rifle').id, 'open');
    assert.equal(draft.equip('mercenary', 'rifle'), 'open');
    assert.throws(() => draft.assign('mercenary', 'fixed', 'rifle'));
    assert.throws(() => validateLoadout(defaultLoadout('mercenary'), [{ id: '1' }, { id: '1' }]));
});

test('catalog boundaries reject inherited keys and unknown character identities', () => {
    assert.deepEqual(new Set(WEAPON_IDS), new Set(Object.keys(WEAPON_DEFINITIONS)));
    for (const invalid of ['toString', '__proto__', 'missing']) {
        assert.equal(acceptsWeapon({ id: 'open' }, invalid as WeaponId), false);
        assert.throws(() => createWeapon(invalid as WeaponId), /Unknown weapon/);
        assert.throws(() => defaultLoadout(invalid as CharacterId), /Unknown character/);
        assert.throws(() => validateLoadout({ ...defaultLoadout('mercenary'), character: invalid as CharacterId }), /Unknown character/);
    }
});

test('spawned effects preserve balance and do not share mutable catalog data', () => {
    const weapon = createWeapon('flamethrower', 2);
    const shots = weapon.tryFire(0, 0, 0, 0)!;
    assert.equal(shots[0].effect?.burnDps, 8);
    assert.equal(WEAPON_DEFINITIONS.flamethrower.effect?.burnDps, 4);
    assert.notEqual(shots[0].effect, shots[1].effect);
    const plasma = createWeapon('plasma-auto').tryFire(0, 0, 0, 0)![0];
    assert.deepEqual(plasma.effect, WEAPON_DEFINITIONS['plasma-auto'].effect);
    assert.notEqual(plasma.effect, WEAPON_DEFINITIONS['plasma-auto'].effect);
});

test('invalid cadence updates cannot poison ammunition or the next valid shot', () => {
    const state = new WeaponState({ kind: 'finite', initial: 2, capacity: 2, perShot: 1 }, 100);
    for (const interval of [NaN, Infinity, -1, 0]) assert.throws(() => state.consumeShot(0, interval));
    assert.throws(() => state.delay(NaN));
    assert.equal(state.ammoRemaining, 2);
    assert.equal(state.consumeShot(0), true);
    assert.equal(state.consumeShot(100), true);
});
