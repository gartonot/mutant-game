import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UpgradeDraft } from '../src/ui/UpgradeDraft';
import { EMPTY_ARSENAL } from '../src/gameplay/arsenal';

test('upgrade drawers isolate previews from battle snapshots and cancel on reopen', () => {
    const draft = new UpgradeDraft();
    draft.open('implants');
    assert.equal(draft.change('health', 5), true);
    assert.equal(draft.draftImplants.health, 5);
    assert.equal(draft.implants.health, 0);
    draft.cancel();
    draft.open('implants');
    assert.equal(draft.draftImplants.health, 0);
    assert.equal(draft.remaining, 70);
    draft.change('health', 5);
    assert.equal(draft.save(), 'implants');
    assert.equal(draft.implants.health, 5);
    draft.open('implants');
    assert.equal(draft.draftImplants.health, 5);
    assert.equal(draft.remaining, 65);
    const snapshot = draft.implants as { health: number };
    snapshot.health = 80;
    assert.equal(draft.implants.health, 5);
});

test('both drawers draw from the same balance and retain their section limits', () => {
    const draft = new UpgradeDraft({ health: 15, attackSpeed: 0, moveSpeed: 0 }, { ...EMPTY_ARSENAL, automatic: 45 });
    draft.open('weapons');
    assert.equal(draft.remaining, 10);
    assert.equal(draft.canIncrease, true);
    assert.equal(draft.change('automatic', 5), true);
    assert.equal(draft.remaining, 5);
    assert.equal(draft.canIncrease, false);
    assert.equal(draft.change('shotgun', 5), false);
    draft.save();
    draft.open('implants');
    assert.equal(draft.remaining, 5);
    assert.equal(draft.canIncrease, true);
    assert.equal(draft.change('health', 5), true);
    assert.equal(draft.remaining, 0);
    assert.equal(draft.canIncrease, false);
    assert.equal(draft.change('damage', 5), false);
    draft.save();
    draft.open('weapons');
    assert.equal(draft.change('automatic', -5), true);
    draft.save();
    draft.open('implants');
    assert.equal(draft.change('damage', 5), true);
    assert.equal(draft.remaining, 0);
});

test('legacy implant saves retain their allocation and normalize absent fields', () => {
    const old = { health: 10, attackSpeed: 5, moveSpeed: 0 };
    const draft = new UpgradeDraft(old);
    assert.deepEqual(draft.implants, { ...old, damage: 0, armor: 0 });
    draft.open('implants');
    assert.equal(draft.remaining, 55);
    assert.equal(draft.change('damage', 5), true);
    assert.equal(draft.change('armor', 5), true);
    draft.save();
    assert.equal(draft.implants.damage, 5);
    assert.equal(draft.implants.armor, 5);
});

test('over-budget legacy allocations survive a reopen and permit refunds until points become available', () => {
    const draft = new UpgradeDraft({ health: 50, attackSpeed: 0, moveSpeed: 0 }, { ...EMPTY_ARSENAL, shotgun: 30 });
    draft.open('weapons');
    assert.equal(draft.remaining, 0);
    assert.equal(draft.draftArsenal.shotgun, 30);
    assert.equal(draft.change('sidearm', 5), false);
    assert.equal(draft.change('shotgun', -5), true);
    assert.equal(draft.remaining, 0);
    draft.open('implants');
    assert.equal(draft.arsenal.shotgun, 30);
    assert.equal(draft.draftImplants.health, 50);
    assert.equal(draft.change('health', -5), true);
    assert.equal(draft.change('health', -5), true);
    assert.equal(draft.remaining, 0);
    assert.equal(draft.change('armor', 5), false);
    assert.equal(draft.change('health', -5), true);
    assert.equal(draft.remaining, 5);
    draft.save();

    const reloaded = new UpgradeDraft(draft.implants, draft.arsenal);
    reloaded.open('weapons');
    assert.equal(reloaded.remaining, 5);
    assert.equal(reloaded.change('sidearm', 5), true);
    assert.equal(reloaded.remaining, 0);
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
