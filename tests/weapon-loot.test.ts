import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_DROP_WEAPONS, AMMO_CATEGORIES, rollWeaponDrop, type AmmoCategory } from '../src/gameplay/WeaponLoot';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import type { WeaponId } from '../src/gameplay/ids';

function weaponAt(category: number, weapon: number, available: readonly WeaponId[] = ALL_DROP_WEAPONS,
    acquiredCategories: readonly AmmoCategory[] = []) {
    const rolls = [.059, category, weapon];
    return rollWeaponDrop(() => rolls.shift()!, available, acquiredCategories);
}

test('weapon drops have a separate six percent chance and exclude the pistol', () => {
    assert.equal(rollWeaponDrop(() => .06), null);
    assert.equal(rollWeaponDrop(() => .99), null);
    assert.equal(weaponAt(0, 0, []), null);
    assert.equal(weaponAt(0, 0, ['pistol']), null);
    assert.equal(ALL_DROP_WEAPONS.includes('pistol'), false);
});

test('shotgun and automatic categories each drop more often than special and scientific', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 32; i++) {
        const id = weaponAt((i + .5) / 32, 0)!;
        const category = WEAPON_DEFINITIONS[id].category;
        counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    assert.deepEqual(Object.fromEntries(counts), { shotgun: 10, automatic: 10, special: 6, scientific: 6 });
});

test('every currently available weapon is reachable with uniform choice within its category', () => {
    const categoryRolls = [.5 / 3.2, 1.5 / 3.2, 2.3 / 3.2, 2.9 / 3.2];
    const reached = new Set<WeaponId>();
    AMMO_CATEGORIES.forEach((category, categoryIndex) => {
        const weapons = ALL_DROP_WEAPONS.filter(id => WEAPON_DEFINITIONS[id].category === category);
        weapons.forEach((id, i) => {
            const selected = weaponAt(categoryRolls[categoryIndex], (i + .5) / weapons.length);
            assert.equal(selected, id);
            reached.add(selected!);
        });
    });
    assert.deepEqual(reached, new Set(ALL_DROP_WEAPONS));
});

test('progression allowlists remove locked weapons and empty categories; duplicates add no weight', () => {
    for (let i = 0; i <= 100; i++) {
        assert.equal(weaponAt(i / 100, i / 100, ['pistol', 'double-barrel', 'double-barrel']), 'double-barrel');
    }
    assert.equal(weaponAt(0, 0, ['rifle', 'tesla']), 'rifle');
    assert.equal(weaponAt(1, 1, ['rifle', 'tesla']), 'tesla');
});

test('acquired slots exclude every weapon of that category while empty slots still drop', () => {
    for (const acquired of AMMO_CATEGORIES) {
        for (let i = 0; i <= 100; i++) {
            const id = weaponAt(i / 100, i / 100, ALL_DROP_WEAPONS, [acquired]);
            assert.ok(id);
            assert.notEqual(WEAPON_DEFINITIONS[id].category, acquired);
        }
        const onlyAcquired = ALL_DROP_WEAPONS.filter(id => WEAPON_DEFINITIONS[id].category === acquired);
        assert.equal(weaponAt(0, 0, onlyAcquired, [acquired]), null);
    }
});

test('all acquired categories leave no weapon drops', () => {
    assert.equal(weaponAt(0, 0, ALL_DROP_WEAPONS, AMMO_CATEGORIES), null);
    assert.equal(weaponAt(1, 1, ALL_DROP_WEAPONS, AMMO_CATEGORIES), null);
});
