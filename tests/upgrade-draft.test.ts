import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UpgradeDraft } from '../src/ui/UpgradeDraft';

test('upgrade drawers isolate previews from battle snapshots and cancel on reopen', () => {
    const draft = new UpgradeDraft();
    draft.open('implants');
    assert.equal(draft.change('health', 5), true);
    assert.equal(draft.draftImplants.health, 5);
    assert.equal(draft.implants.health, 0);
    draft.cancel();
    draft.open('implants');
    assert.equal(draft.draftImplants.health, 0);
    assert.equal(draft.remaining, 100);
    draft.change('health', 5);
    assert.equal(draft.save(), 'implants');
    assert.equal(draft.implants.health, 5);
    draft.open('implants');
    assert.equal(draft.draftImplants.health, 5);
    assert.equal(draft.remaining, 95);
    const snapshot = draft.implants as { health: number };
    snapshot.health = 80;
    assert.equal(draft.implants.health, 5);
});

test('weapon and implant budgets remain independent at their full limits', () => {
    const draft = new UpgradeDraft();
    draft.open('weapons');
    for (let i = 0; i < 10; i++) assert.equal(draft.change('automatic', 5), true);
    assert.equal(draft.remaining, 0);
    assert.equal(draft.change('shotgun', 5), false);
    assert.equal(draft.change('automatic', -5), true);
    assert.equal(draft.remaining, 5);
    draft.change('shotgun', 5);
    draft.save();
    draft.open('implants');
    assert.equal(draft.remaining, 100);
    for (let i = 0; i < 20; i++) assert.equal(draft.change('health', 5), true);
    assert.equal(draft.change('damage', 5), false);
    draft.save();
    assert.equal(Object.values(draft.arsenal).reduce((a, b) => a + b), 50);
    assert.equal(Object.values(draft.implants).reduce((a, b) => a + b), 100);
});

test('legacy implant saves retain their allocation and normalize absent fields', () => {
    const old = { health: 10, attackSpeed: 5, moveSpeed: 0 };
    const draft = new UpgradeDraft(old);
    assert.deepEqual(draft.implants, { ...old, damage: 0, armor: 0 });
    draft.open('implants');
    assert.equal(draft.remaining, 85);
    assert.equal(draft.change('damage', 5), true);
    assert.equal(draft.change('armor', 5), true);
    draft.save();
    assert.equal(draft.implants.damage, 5);
    assert.equal(draft.implants.armor, 5);
});

test('invalid steps, unknown upgrades and negative allocations cannot alter a draft', () => {
    const draft = new UpgradeDraft();
    assert.equal(draft.change('health', 5), false);
    draft.open('implants');
    for (const [id, delta] of [['health', -5], ['health', 10], ['health', 3], ['automatic', 5], ['__proto__', 5]] as const) {
        assert.equal(draft.change(id, delta), false);
    }
    assert.equal(draft.total, 0);
    draft.open('weapons');
    assert.equal(draft.change('health', 5), false);
    assert.equal(draft.total, 0);
});
