import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WeaponState } from '../src/gameplay/WeaponState';
import { createWeapon } from '../src/entities/weapon/WeaponFactory';
import { createCharacter } from '../src/gameplay/CharacterFactory';
import { defaultLoadout, CHARACTER_DEFINITIONS } from '../src/gameplay/characters';
import { resolveStats, BASE_STATS } from '../src/gameplay/stats';
import { resolveBonuses } from '../src/gameplay/bonuses';
import { validateLoadout } from '../src/gameplay/loadout';
import { PlayerWeaponController } from '../src/systems/Player/PlayerWeaponController';
import { Grenade } from '../src/entities/bullet/Grenade';
import { EquipmentDraft, loadoutKey } from '../src/gameplay/EquipmentDraft';
import { CHARACTER_IDS } from '../src/gameplay/ids';
import { WEAPON_DEFINITIONS } from '../src/gameplay/weapons';
import { muzzlePosition, weaponMount, WEAPON_ART, WEAPON_ORDER } from '../src/rendering/WeaponGeometry';

function assertPoint(actual: { x: number; y: number }, expected: { x: number; y: number }, context: string) {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-8, `${context}: x ${actual.x} != ${expected.x}`);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-8, `${context}: y ${actual.y} != ${expected.y}`);
}

test('all fifteen characters start playable with their own identity, stats and starting weapons', () => {
    assert.equal(CHARACTER_IDS.length, 15);
    assert.equal(new Set(CHARACTER_IDS).size, 15);
    for (const id of CHARACTER_IDS) {
        const loadout = defaultLoadout(id);
        const { player, stats, weapons } = createCharacter(loadout);
        assert.equal(loadout.character, id);
        assert.equal(player.character, id);
        assert.deepEqual(stats, resolveStats(BASE_STATS, CHARACTER_DEFINITIONS[id].modifiers), id);
        assert.equal(player.currentHp, stats.maxHp, id);
        assert.equal(player.maxHp, stats.maxHp, id);
        assert.equal(player.speed, stats.speed, id);
        assert.equal(player.weapon, 'pistol', id);
        assert.deepEqual(weapons.filter(w => w !== null).map(w => w.id).sort(), [...CHARACTER_DEFINITIONS[id].startingWeapons].sort(), id);
    }
});

test('equipment edits and weapon state remain isolated across the full character roster', () => {
    const draft = new EquipmentDraft();
    for (const selected of CHARACTER_IDS) {
        const before = CHARACTER_IDS.map(id => draft.get(id));
        draft.assign(selected, '3', 'rifle');
        for (const [index, id] of CHARACTER_IDS.entries()) {
            if (id !== selected) assert.deepEqual(draft.get(id), before[index], `${selected} changed ${id}`);
        }
        assert.deepEqual(before[CHARACTER_IDS.indexOf(selected)], defaultLoadout(selected));
        const a = createCharacter(draft.get(selected));
        const b = createCharacter(draft.get(selected));
        a.weapons[2]!.tryFire(0, 0, 0, 0);
        assert.equal(a.weapons[2]!.state.ammoRemaining, b.weapons[2]!.state.ammoRemaining - 1, selected);
        draft.assign(selected, '3', null);
        assert.equal(draft.get(selected).weapons.some(entry => entry.slotId === '3'), false);
    }
});

test('every character and weapon rotates its mount and muzzle with the player', () => {
    for (const character of CHARACTER_IDS) for (const id of WEAPON_ORDER) {
        const mount = weaponMount(character, id);
        const forward = mount.x + WEAPON_ART[id].muzzle * Math.cos(mount.angle);
        const lateral = mount.y + WEAPON_ART[id].muzzle * Math.sin(mount.angle);
        const cases = [
            { angle: 0, x: 123 + forward, y: -47 + lateral },
            { angle: Math.PI / 2, x: 123 - lateral, y: -47 + forward },
            { angle: Math.PI, x: 123 - forward, y: -47 - lateral },
        ];
        for (const expected of cases) assertPoint(
            muzzlePosition(id, 123, -47, expected.angle, character), expected, `${character}/${id}/${expected.angle}`);
    }
});

test('character factory passes each character mount to shots, flashes, tracking lasers and charged plasma', () => {
    for (const character of CHARACTER_IDS) {
        const draft = new EquipmentDraft();
        draft.assign(character, '4', 'laser');
        draft.assign(character, '5', 'plasma-cannon');
        const { weapons, stats } = createCharacter(draft.get(character));
        const pistol = weapons[0]!;
        let flash: { x: number; y: number } | undefined;
        const bullet = pistol.tryFire(0, 23, -19, Math.PI, (x, y) => { flash = { x, y }; })![0];
        const pistolMuzzle = muzzlePosition('pistol', 23, -19, Math.PI, character);
        assertPoint(bullet, pistolMuzzle, `${character} pistol`);
        assert.ok(flash);
        assertPoint(flash, pistolMuzzle, `${character} flash`);

        const laser = weapons[3]!;
        const beam = laser.tryFire(0, 23, -19, 0)![0];
        assertPoint({ x: beam.previousX, y: beam.previousY }, muzzlePosition('laser', 23, -19, 0, character), `${character} laser start`);
        const ammo = laser.state.ammoRemaining;
        assert.equal(laser.tryFire(1, 80, 42, Math.PI / 2), null);
        assertPoint({ x: beam.previousX, y: beam.previousY }, muzzlePosition('laser', 80, 42, Math.PI / 2, character), `${character} laser reaim`);
        assert.equal(laser.state.ammoRemaining, ammo);

        const plasma = weapons[4]!;
        const charge = WEAPON_DEFINITIONS['plasma-cannon'].chargeMs! / stats.attackSpeed;
        assert.equal(plasma.tryFire(0, 0, 0, 0), null);
        assert.equal(plasma.tryFire(charge - 1, 0, 0, 0), null);
        const shot = plasma.tryFire(charge, -30, 66, Math.PI / 2)![0];
        assertPoint({ x: shot.previousX, y: shot.previousY }, muzzlePosition('plasma-cannon', -30, 66, Math.PI / 2, character), `${character} charged plasma`);
    }
});

test('equipment selection reaches exact category slots and stays isolated per character', () => {
    const draft = new EquipmentDraft();
    draft.assign('mercenary', '2', 'double-barrel');
    draft.assign('mercenary', '3', 'm16');
    draft.assign('mercenary', '4', 'laser');
    draft.assign('mercenary', '5', 'plasma-grenade');
    const { weapons } = createCharacter(draft.get('mercenary'));
    assert.deepEqual(weapons.map(w => w?.id), ['pistol', 'double-barrel', 'm16', 'laser', 'plasma-grenade']);
    assert.equal(weapons[2]!.state.ammoRemaining, 100);
    assert.deepEqual(draft.get('assassin'), defaultLoadout('assassin'));
    const previous = draft.get('mercenary');
    draft.assign('mercenary', '3', 'ak47');
    assert.equal(previous.weapons.find(entry => entry.slotId === '3')!.weaponId, 'm16');
    assert.equal(draft.get('mercenary').weapons.length, 5);
    assert.throws(() => draft.assign('mercenary', '4', 'm16'));
    assert.throws(() => draft.assign('mercenary', '6', 'rifle'));
    assert.throws(() => draft.assign('mercenary', '5', 'plasma-auto'));
    draft.assign('mercenary', '3', 'plasma-auto');
    assert.equal(createCharacter(draft.get('mercenary')).weapons[2]!.id, 'plasma-auto');
});

test('pistol is permanent, four optional slots can be cleared, identity ignores ordering', () => {
    const draft = new EquipmentDraft();
    const before = draft.get('mercenary');
    assert.equal(loadoutKey(before), loadoutKey({ ...before, weapons: [...before.weapons].reverse() }));
    assert.throws(() => draft.assign('mercenary', '1', null));
    assert.throws(() => draft.assign('mercenary', '1', 'rifle'));
    for (const slot of ['2', '3', '4', '5']) draft.assign('mercenary', slot, null);
    assert.equal(draft.canPlay('mercenary'), true);
    assert.deepEqual(createCharacter(draft.get('mercenary')).weapons.map(w => w?.id ?? null), ['pistol', null, null, null, null]);
    assert.throws(() => validateLoadout({ ...before, weapons: [{ slotId: '3', weaponId: 'rifle' }] }));
    assert.notEqual(loadoutKey(before), loadoutKey(draft.get('mercenary')));
});

test('finite ammunition, cooldown and refill are independent per instance', () => {
    const ammo = { kind: 'finite', initial: 2, capacity: 3, perShot: 1 } as const;
    const a = new WeaponState(ammo, 100);
    const b = new WeaponState(ammo, 100);
    assert.equal(a.consumeShot(0), true);
    assert.equal(a.consumeShot(99), false);
    assert.equal(a.ammoRemaining, 1);
    assert.equal(a.consumeShot(100), true);
    assert.equal(a.consumeShot(200), false);
    assert.equal(b.ammoRemaining, 2);
    a.addAmmo(100);
    assert.equal(a.ammoRemaining, 3);
    assert.throws(() => a.addAmmo(-1));
    assert.throws(() => new WeaponState({ ...ammo, perShot: 0 }, 100));
});

test('base pistol never runs out', () => {
    const pistol = createWeapon('pistol');
    for (let i = 0; i < 1000; i++) assert.equal(pistol.tryFire(i * 600, 0, 0, 0)?.length, 1);
    assert.equal(pistol.state.ammoRemaining, Infinity);
});

test('shotgun consumes one shell per volley; blocked shots have no effects', () => {
    const shotgun = createWeapon('shotgun');
    let flashes = 0;
    const fire = (time: number) => shotgun.tryFire(time, 0, 0, 0, () => flashes++);
    assert.deepEqual(fire(0)?.map(b => b.damage), [2.5, 5, 5, 2.5]);
    assert.equal(shotgun.state.ammoRemaining, 29);
    assert.equal(fire(1), null);
    for (let i = 1; i < 30; i++) assert.equal(fire(i * 1000)?.length, 4);
    assert.equal(fire(30000), null);
    assert.equal(flashes, 30);
});

test('projectile behavior and attack-speed scaling survive the factory', () => {
    const weapon = createWeapon('grenade-launcher', 2, 2);
    const grenade = weapon.tryFire(0, 0, 0, 0)![0];
    assert.ok(grenade instanceof Grenade);
    assert.equal(grenade.damage, 28);
    assert.equal(weapon.tryFire(699, 0, 0, 0), null);
    assert.equal(weapon.tryFire(700, 0, 0, 0)?.length, 1);
});

test('stats use additive percentages, do not mutate base and respect bounds', () => {
    const modifiers = [
        { stat: 'maxHp', operation: 'add', value: 20 },
        { stat: 'maxHp', operation: 'percent', value: .5 },
        { stat: 'maxHp', operation: 'percent', value: .5 },
    ] as const;
    assert.equal(resolveStats(BASE_STATS, modifiers).maxHp, 240);
    assert.deepEqual(resolveStats(BASE_STATS, modifiers), resolveStats(BASE_STATS, [...modifiers].reverse()));
    assert.equal(BASE_STATS.maxHp, 100);
    assert.equal(resolveStats(BASE_STATS, [{ stat: 'maxHp', operation: 'add', value: -200 }]).maxHp, 1);
});

test('bonus stacks and mutually exclusive groups are validated', () => {
    const catalog = {
        health: { id: 'health', name: 'Health', maxStacks: 2, exclusiveGroup: 'body',
            modifiers: [{ stat: 'maxHp', operation: 'add', value: 10 }] },
        armor: { id: 'armor', name: 'Armor', maxStacks: 1, exclusiveGroup: 'body', modifiers: [] },
    } as const;
    assert.equal(resolveBonuses([{ id: 'health', stacks: 2 }], catalog)[0].value, 20);
    assert.throws(() => resolveBonuses([{ id: 'health', stacks: 3 }], catalog));
    assert.throws(() => resolveBonuses([{ id: 'health', stacks: 1 }, { id: 'armor', stacks: 1 }], catalog));
    assert.throws(() => resolveBonuses([{ id: 'missing', stacks: 1 }], catalog));
});

test('loadout validates duplicate slots and category restrictions', () => {
    const loadout = defaultLoadout('mercenary');
    assert.doesNotThrow(() => validateLoadout(loadout));
    assert.throws(() => validateLoadout({ ...loadout, weapons: [loadout.weapons[0], loadout.weapons[0]] }));
    assert.throws(() => validateLoadout({ ...loadout, weapons: [{ slotId: '1', weaponId: 'rifle' }] },
        [{ id: '1', allowedCategories: ['sidearm'] }]));
});

test('character factory applies progression and bonuses once, with fresh weapon state', () => {
    const draft = new EquipmentDraft(); draft.equip('assassin', 'rifle');
    const loadout = draft.get('assassin');
    const a = createCharacter(loadout, [{ stat: 'maxHp', operation: 'add', value: 25 }]);
    const b = createCharacter(loadout);
    assert.equal(a.player.currentHp, 105);
    assert.equal(b.player.currentHp, 80);
    assert.equal(a.player.character, 'assassin');
    a.weapons[2]!.tryFire(0, 0, 0, 0);
    assert.equal(b.weapons[2]!.state.ammoRemaining, 120);
});

test('empty slots preserve hotkey positions and independent cooldowns', () => {
    const loadout = { ...defaultLoadout('mercenary'), weapons: [
        { slotId: '1', weaponId: 'pistol' }, { slotId: '3', weaponId: 'rifle' },
    ] } as const;
    const controller = new PlayerWeaponController(createCharacter(loadout).weapons, () => 0);
    assert.equal(controller.selectedIndex, 0);
    controller.switchToWeapon(1);
    assert.equal(controller.selectedIndex, 0);
    assert.ok(controller.tryShoot(0, 0, 0));
    controller.switchToWeapon(2);
    assert.ok(controller.tryShoot(0, 0, 0));
    controller.switchToWeapon(0);
    assert.equal(controller.tryShoot(0, 0, 0), null);
});


test('hero starting weapons occupy categories and alternatives stay blocked until removed', () => {
    const draft = new EquipmentDraft();
    assert.deepEqual(createCharacter(defaultLoadout('assassin')).weapons.map(w => w?.id ?? null), ['pistol', null, null, null, null]);
    assert.deepEqual(createCharacter(defaultLoadout('mercenary')).weapons.map(w => w?.id ?? null), ['pistol', null, 'rifle', null, null]);
    assert.deepEqual(createCharacter(defaultLoadout('destroyer')).weapons.map(w => w?.id ?? null), ['pistol', null, null, 'grenade-launcher', null]);
    draft.assign('mercenary', '3', null);
    assert.equal(draft.equip('mercenary', 'm16'), '3');
    assert.equal(draft.canEquip('mercenary', 'ak47'), false);
    assert.throws(() => draft.equip('mercenary', 'ak47'));
    assert.equal(draft.canEquip('mercenary', 'shotgun'), true);
    assert.equal(draft.canEquip('mercenary', 'plasma-auto'), false);
    draft.assign('mercenary', '3', null);
    assert.equal(draft.equip('mercenary', 'plasma-auto'), '3');
    assert.equal(draft.equip('mercenary', 'plasma-cannon'), '5');
    assert.equal(draft.canEquip('mercenary', 'plasma-grenade'), false);
    draft.assign('mercenary', '3', null);
    assert.equal(draft.equip('mercenary', 'ak47'), '3');
    assert.equal(draft.canEquip('mercenary', 'pistol'), false);
});

import { weaponHUDLayout, weaponHUDTarget } from '../src/ui/WeaponHUDLayout';
test('cycling wraps in both directions and skips empty slots and empty-ammo weapons', () => {
    const rifle = createWeapon('rifle');
    for (let i=0;i<120;i++) rifle.state.consumeShot(i*300);
    const c = new PlayerWeaponController([createWeapon('pistol'), null, rifle, null, createWeapon('plasma-cannon')], () => 0);
    c.cycleWeapon(-1); assert.equal(c.selectedIndex,4);
    c.cycleWeapon(1); assert.equal(c.selectedIndex,0);
    c.switchToWeapon(2); assert.equal(c.selectedIndex,0);
    c.cycleWeapon(1); assert.equal(c.selectedIndex,4);
    c.tryShoot(0,0,0); c.cycleWeapon(-1); assert.equal(c.selectedIndex,0);
    assert.equal(c.slots[4]!.chargeProgress,0);
    assert.equal(c.slots[2], rifle);
    c.replenishAmmo('automatic');
    c.cycleWeapon(1); assert.equal(c.selectedIndex,2);
    const single = new PlayerWeaponController([createWeapon('pistol'),null,null,null,null]);
    single.cycleWeapon(-1); single.cycleWeapon(1); assert.equal(single.selectedIndex,0);
});

test('an emptied weapon stays selected with multiple equipped weapons until the player leaves it', () => {
    const rifle = createWeapon('rifle');
    for (let i = 0; i < 119; i++) rifle.state.consumeShot(i * 300);
    const c = new PlayerWeaponController([createWeapon('pistol'), createWeapon('shotgun'), rifle], () => 40000);
    c.switchToWeapon(2);
    assert.ok(c.tryShoot(0, 0, 0));
    assert.equal(rifle.state.ammoRemaining, 0);
    assert.equal(c.selectedIndex, 2);
    assert.equal(c.tryShoot(0, 0, 0), null);
    assert.equal(c.selectedIndex, 2);
    c.cycleWeapon(-1); assert.equal(c.selectedIndex, 1);
    c.switchToWeapon(2); assert.equal(c.selectedIndex, 1);
    c.replenishAmmo('automatic');
    c.switchToWeapon(2); assert.equal(c.selectedIndex, 2);
});

test('the only additional weapon automatically falls back to pistol after its last shot', () => {
    for (const id of ['rifle', 'laser'] as const) {
        const weapon = createWeapon(id);
        const ammo = weapon.state.ammoRemaining;
        for (let i = 0; i < ammo - 1; i++) weapon.state.consumeShot(i * 1000);
        const c = new PlayerWeaponController([createWeapon('pistol'), null, weapon], () => ammo * 1000);
        c.switchToWeapon(2);
        const fired = c.tryShoot(0, 0, 0);
        assert.ok(fired?.length);
        assert.ok(fired.every(bullet => !bullet.isDead), 'the final shot must survive automatic switching');
        assert.equal(weapon.state.ammoRemaining, 0);
        assert.equal(c.selectedIndex, 0);
        c.switchToWeapon(2); assert.equal(c.selectedIndex, 0);
        c.replenishAmmo(id === 'rifle' ? 'automatic' : 'special');
        c.switchToWeapon(2); assert.equal(c.selectedIndex, 2);
    }
});
test('HUD hit areas follow the rendered panel at desktop and narrow sizes', () => {
    for(const [width,height] of [[1920,1080],[1066,928],[390,844]]) {
        const l = weaponHUDLayout(width,height);
        for(let i=0;i<5;i++) assert.deepEqual(weaponHUDTarget(l.x+(193+i*56)*l.scale,l.y+60*l.scale,width,height),{inside:true,slot:i});
        assert.deepEqual(weaponHUDTarget(l.x+40*l.scale,l.y+40*l.scale,width,height),{inside:true,slot:null});
        assert.deepEqual(weaponHUDTarget(l.x-1,l.y,width,height),{inside:false,slot:null});
    }
});

