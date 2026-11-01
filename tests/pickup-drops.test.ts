import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rollPickup, rollPickupDrop, PICKUP_KINDS } from '../src/gameplay/PickupDrops';
import { GOLD_PICKUP_KINDS, type GoldPickupKind } from '../src/gameplay/PickupVariants';
import { AMMO_CATEGORIES, type AmmoCategory } from '../src/gameplay/WeaponLoot';

function dropAt(selection: number, unlocks: readonly GoldPickupKind[] = [], categories: readonly AmmoCategory[] = [], ammoSelection = 0) {
    const rolls = [.14, selection, ammoSelection];
    return rollPickupDrop(() => rolls.shift()!, unlocks, categories);
}

test('pistol-only runs exclude ammunition and use the halved ordinary bonus chance', () => {
    const kinds = PICKUP_KINDS.filter(kind => kind !== 'ammo');
    assert.equal(rollPickup(() => .3), null);
    assert.equal(rollPickup(() => .99), null);
    for (let index = 0; index < kinds.length; index++) {
        assert.deepEqual(dropAt((index + .5) / kinds.length), { kind: kinds[index], tier: 'silver' });
    }
    assert.equal(rollPickupDrop(() => .3, [], []), null);
    assert.deepEqual(dropAt(0, [], ['shotgun']), { kind: 'ammo', tier: 'silver', ammoCategory: 'shotgun' });
});

test('silver and gold bonuses halve their drop frequency while ammunition keeps its original frequency', () => {
    const cases = [
        { selection: 1 / 8, unlocks: [] as GoldPickupKind[], expected: { kind: 'health', tier: 'silver' }, drops: 150 },
        { selection: 1, unlocks: ['shield'] as GoldPickupKind[], expected: { kind: 'shield', tier: 'gold' }, drops: 150 },
        { selection: 0, unlocks: [] as GoldPickupKind[], expected: { kind: 'ammo', tier: 'silver', ammoCategory: 'shotgun' }, drops: 300 },
    ];
    for (const entry of cases) {
        let count = 0;
        for (let chance = 0; chance < 1000; chance++) {
            const rolls = [chance / 1000, entry.selection, 0];
            const drop = rollPickupDrop(() => rolls.shift()!, entry.unlocks, ['shotgun']);
            if (!drop) continue;
            assert.deepEqual(drop, entry.expected);
            count++;
        }
        assert.equal(count, entry.drops, entry.expected.kind);
    }
});

test('bonus chance stops at fifteen percent and ammo still drops up to thirty percent', () => {
    const rollAt = (chance: number, selection: number, gold: readonly GoldPickupKind[] = []) => {
        const rolls = [chance, selection, 0];
        return rollPickupDrop(() => rolls.shift()!, gold, ['shotgun']);
    };
    assert.deepEqual(rollAt(.1499, 1 / 8), { kind: 'health', tier: 'silver' });
    assert.equal(rollAt(.15, 1 / 8), null);
    assert.deepEqual(rollAt(.1499, 1, ['shield']), { kind: 'shield', tier: 'gold' });
    assert.equal(rollAt(.15, 1, ['shield']), null);
    assert.deepEqual(rollAt(.29, 0), { kind: 'ammo', tier: 'silver', ammoCategory: 'shotgun' });
    assert.equal(rollAt(.3, 0), null);
});

test('ammo only selects acquired categories, without weighting duplicates or changing total ammo chance', () => {
    for (let i = 0; i <= 100; i++) {
        assert.deepEqual(dropAt(0, [], ['shotgun'], i / 100), { kind: 'ammo', tier: 'silver', ammoCategory: 'shotgun' });
    }
    const categorySets: readonly (readonly AmmoCategory[])[] = [AMMO_CATEGORIES, ['automatic', 'shotgun', 'shotgun']];
    for (const categories of categorySets) {
        const canonical = AMMO_CATEGORIES.filter(category => categories.includes(category));
        for (let i = 0; i < canonical.length; i++) {
            assert.deepEqual(dropAt(0, [], categories, (i + .5) / canonical.length),
                { kind: 'ammo', tier: 'silver', ammoCategory: canonical[i] });
        }
        assert.deepEqual(dropAt(1 / 8, [], categories), { kind: 'health', tier: 'silver' });
    }
});

test('gold drops are locked by default across the entire selection range', () => {
    for (let i = 0; i <= 1000; i++) assert.equal(dropAt(i / 1000)?.tier, 'silver');
});

test('gold variants have quarter weight both before and after acquiring a weapon', () => {
    for (const categories of [[], ['shotgun']] as readonly AmmoCategory[][]) {
        const silverKinds = PICKUP_KINDS.filter(kind => kind !== 'ammo' || categories.length);
        const intervals = silverKinds.length * 4 + GOLD_PICKUP_KINDS.length;
        const counts = new Map<string, number>();
        for (let i = 0; i < intervals; i++) {
            const drop = dropAt((i + .5) / intervals, GOLD_PICKUP_KINDS, categories)!;
            const key = `${drop.kind}:${drop.tier}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const kind of silverKinds) assert.equal(counts.get(`${kind}:silver`), 4);
        for (const kind of GOLD_PICKUP_KINDS) assert.equal(counts.get(`${kind}:gold`), 1);
        assert.equal(counts.has('ammo:gold'), false);
        assert.equal(counts.has('weapon:silver'), false);
        assert.equal(counts.has('weapon:gold'), false);
    }
});

test('individual gold unlocks ignore duplicates and reject weapon/ammo gold variants', () => {
    const unlocks: GoldPickupKind[] = ['shield', 'shield'];
    assert.deepEqual(dropAt((7 - .001) / 7.25, unlocks), { kind: 'fireBlast', tier: 'silver' });
    assert.deepEqual(dropAt(7 / 7.25, unlocks), { kind: 'shield', tier: 'gold' });
    assert.deepEqual(dropAt(1, unlocks), { kind: 'shield', tier: 'gold' });
    assert.deepEqual(dropAt(1, ['ammo', 'weapon'] as unknown as GoldPickupKind[]), { kind: 'fireBlast', tier: 'silver' });
});
