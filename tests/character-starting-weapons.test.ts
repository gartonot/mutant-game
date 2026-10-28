import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultLoadout } from '../src/gameplay/characters';
import { createCharacter } from '../src/gameplay/CharacterFactory';
import { EquipmentDraft } from '../src/gameplay/EquipmentDraft';
import { EMPTY_ARSENAL } from '../src/gameplay/arsenal';
import type { CharacterId, WeaponId } from '../src/gameplay/ids';

test('hero starting grants carry the agreed ammunition without changing later loot', () => {
    const grants: [CharacterId, WeaponId, number][] = [
        ['destroyer', 'grenade-launcher', 5], ['mercenary', 'rifle', 120],
        ['half-mutant', 'flamethrower', 100], ['telepath', 'ak47', 120],
        ['witcher', 'ak47', 120], ['cyborg', 'plasma-auto', 120],
        ['goliath', 'machine-gun', 100], ['fanatic', 'tesla', 25],
        ['nuclear', 'tesla', 25], ['hunter', 'double-barrel', 24],
        ['silver-hunter', 'double-barrel', 24], ['plasma-nuclear', 'plasma-cannon', 5],
    ];
    for (const [hero, id, count] of grants) {
        const run = createCharacter(defaultLoadout(hero));
        assert.equal(run.weapons.find(w => w?.id === id)?.state.ammoRemaining, count, hero);
        assert.equal(run.weapons[0]?.state.ammoRemaining, Infinity, hero);
    }
    const run = createCharacter(defaultLoadout('goliath'));
    assert.equal(run.createRunWeapon('machine-gun').state.ammoRemaining, 300);
});

test('arsenal scales hero starting ammo and custom category choice survives switching characters', () => {
    const draft = new EquipmentDraft();
    draft.assign('goliath', '3', 'ak47');
    draft.get('telepath');
    assert.equal(createCharacter(draft.get('goliath')).weapons[2]?.id, 'ak47');
    assert.equal(createCharacter(draft.get('goliath')).weapons[2]?.state.ammoRemaining, 70);
    const upgraded = createCharacter({ ...defaultLoadout('goliath'), arsenal: { ...EMPTY_ARSENAL, automatic: 50 } });
    assert.equal(upgraded.weapons[2]?.state.ammoRemaining, 350);
    assert.ok(upgraded.weapons[2]!.state.ammoCapacity >= 350);
    assert.equal(upgraded.createRunWeapon('machine-gun').state.ammoRemaining, 1050);
});
