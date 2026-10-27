import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateConsumables } from '../src/gameplay/Consumables';
import type { ConsumableSelection } from '../src/gameplay/Consumables';
import { EquipmentDraft, loadoutKey } from '../src/gameplay/EquipmentDraft';
import { defaultLoadout } from '../src/gameplay/characters';
import { validateLoadout, WEAPON_SLOTS } from '../src/gameplay/loadout';
import { GOLD_PICKUP_KINDS } from '../src/gameplay/PickupVariants';

test('consumables offer every silver and gold bonus while excluding duplicate kinds', () => {
    for (const kind of GOLD_PICKUP_KINDS) {
        for (const tier of ['silver', 'gold'] as const) {
            const draft = new EquipmentDraft();
            assert.equal(draft.canEquipConsumable('mercenary', kind, tier), true);
            assert.equal(draft.equipConsumable('mercenary', kind, tier), 0);
            assert.equal(draft.canEquipConsumable('mercenary', kind, 'silver'), false);
            assert.equal(draft.canEquipConsumable('mercenary', kind, 'gold'), false);
            assert.throws(() => draft.assignConsumable('mercenary', 1, { kind, tier }));
            assert.equal(draft.get('mercenary').consumables!.length, 1);
        }
    }
});

test('consumable slots retain holes and refill the first free unlocked position', () => {
    const draft = new EquipmentDraft();
    for (const [index, kind] of GOLD_PICKUP_KINDS.slice(0, 4).entries()) {
        assert.equal(draft.equipConsumable('mercenary', kind, 'silver'), index);
    }
    assert.equal(draft.canEquipConsumable('mercenary', 'shield', 'gold'), false);
    assert.throws(() => draft.assignConsumable('mercenary', 4, { kind: 'shield', tier: 'gold' }));
    draft.assignConsumable('mercenary', 1, null);
    assert.deepEqual(draft.get('mercenary').consumables!.map(entry => entry.slotIndex), [0, 2, 3]);
    assert.equal(draft.equipConsumable('mercenary', 'shield', 'gold'), 1);
    const futureDraft = new EquipmentDraft(WEAPON_SLOTS, 6);
    for (const [index, kind] of GOLD_PICKUP_KINDS.slice(0, 6).entries()) {
        assert.equal(futureDraft.equipConsumable('mercenary', kind, 'gold'), index);
    }
    assert.equal(futureDraft.canPlay('mercenary'), true);
    assert.throws(() => new EquipmentDraft(WEAPON_SLOTS, 7));
});

test('consumable validation guards battle inputs and locked slots', () => {
    const valid = { slotIndex: 0, kind: 'shield', tier: 'gold' } as const;
    for (const entries of [
        [valid, { ...valid, slotIndex: 1, tier: 'silver' }],
        [valid, { ...valid, kind: 'health' }],
        [{ ...valid, slotIndex: 4 }], [{ ...valid, slotIndex: -1 }],
        [{ ...valid, slotIndex: 1.5 }], [{ ...valid, kind: 'ammo' }],
        [{ ...valid, tier: 'bronze' }],
    ]) {
        assert.throws(() => validateLoadout({ ...defaultLoadout('mercenary'), consumables: entries as ConsumableSelection[] }));
    }
    assert.doesNotThrow(() => validateConsumables([{ ...valid, slotIndex: 5 }], 6));
    for (const unlocked of [-1, 7, 2.5, NaN]) assert.throws(() => validateConsumables([], unlocked));
});

test('consumable snapshots are isolated from draft and character selections', () => {
    const draft = new EquipmentDraft();
    const selection = { kind: 'health', tier: 'silver' } as const;
    draft.assignConsumable('mercenary', 2, selection);
    const snapshot = draft.get('mercenary');
    (snapshot.consumables![0] as { tier: string }).tier = 'gold';
    assert.equal(draft.get('mercenary').consumables![0].tier, 'silver');
    assert.deepEqual(draft.get('assassin').consumables ?? [], []);
    draft.assignConsumable('mercenary', 2, null);
    assert.equal(snapshot.consumables!.length, 1);
});

test('loadout identity ignores entry insertion order but includes slot mapping and variants', () => {
    const base = defaultLoadout('mercenary');
    const entries: ConsumableSelection[] = [
        { slotIndex: 0, kind: 'health', tier: 'silver' },
        { slotIndex: 3, kind: 'shield', tier: 'gold' },
    ];
    const key = loadoutKey({ ...base, consumables: entries });
    assert.equal(key, loadoutKey({ ...base, consumables: [...entries].reverse() }));
    assert.notEqual(key, loadoutKey({ ...base, consumables: entries.map(entry => ({ ...entry, slotIndex: 3 - entry.slotIndex })) }));
    assert.notEqual(key, loadoutKey({ ...base, consumables: entries.map(entry => ({ ...entry, tier: 'silver' })) }));
    assert.equal(loadoutKey(base), loadoutKey({ ...base, consumables: [], consumableSlotsUnlocked: 4 }));
});
