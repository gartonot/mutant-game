import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { GameWorld } from '../../src/systems/GameWorld';
import { PlayerController } from '../../src/systems/Player/PlayerController';
import { InputSystem } from '../../src/systems/InputSystem';
import { createCharacter } from '../../src/gameplay/CharacterFactory';
import { CHARACTER_DEFINITIONS } from '../../src/gameplay/characters';
import { placeStartingWeapons } from '../../src/gameplay/loadout';
import { CHARACTER_IDS, type CharacterId } from '../../src/gameplay/ids';
import { EMPTY_IMPLANTS } from '../../src/gameplay/implants';
import { EMPTY_ARSENAL } from '../../src/gameplay/arsenal';
import { Enemy } from '../../src/entities/enemy/Enemy';
import type { PlayerWeaponController } from '../../src/systems/Player/PlayerWeaponController';

// No browser page or save access. Only art/DOM is stubbed; combat uses runtime classes.
Object.assign(globalThis, { window: { innerWidth: 1280, innerHeight: 720, addEventListener() {} },
    document: { hidden: false, addEventListener() {} } });
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const profiles = {
    new: { implants: EMPTY_IMPLANTS, arsenal: EMPTY_ARSENAL },
    mid: { implants: { health: 10, attackSpeed: 10, moveSpeed: 10, damage: 10, armor: 10 }, arsenal: { sidearm: 5, automatic: 5, shotgun: 5, special: 5, scientific: 5 } },
    max: { implants: { health: 20, attackSpeed: 20, moveSpeed: 20, damage: 20, armor: 20 }, arsenal: { sidearm: 10, automatic: 10, shotgun: 10, special: 10, scientific: 10 } },
};
type Scenario = { abilityPolicy?: 'range-aware'; hero: CharacterId; profile: keyof typeof profiles; gear: 'equal' | 'personal'; width: number; height: number; seed: number; ability: boolean; strategy: 'orbit' | 'loot' | 'passive' | 'kite'; enemies: 'default' | 'fast-weak' | 'durable' | 'heavy-contact' | 'swarm' };
const round = (n: number) => Math.round(n * 1000) / 1000;
function simulate(s: Scenario) {
    Object.assign(window, { innerWidth: s.width, innerHeight: s.height });
    Math.random = rng(s.seed ^ 0x5319); // Weapon spread and visual randomness, separate from spawn/drop rolls.
    const { player, weapons, createRunWeapon } = createCharacter({ character: s.hero, bonuses: [], ...profiles[s.profile],
        weapons: placeStartingWeapons(s.gear === 'equal' ? ['pistol'] : CHARACTER_DEFINITIONS[s.hero].startingWeapons) });
    player.x = s.width / 2; player.y = s.height / 2;
    const input = new InputSystem();
    const controller = new PlayerController(player, input, weapons, createRunWeapon);
    const world = new GameWorld(controller, rng(s.seed ^ 0x8471), [], undefined, [], undefined, rng(s.seed ^ 0x2913));
    // Test-only reflection provides bot input and inspection, without replacing any combat calculation.
    const state = world as any, controls = controller as any;
    state.stampBlood = () => {}; state.stampGround = () => {};
    const inventory = controls.weaponController as PlayerWeaponController;
    const spawn = state.waveSystem.spawnWave.bind(state.waveSystem);
    state.waveSystem.spawnWave = () => {
        const enemies: Enemy[] = spawn();
        if (s.enemies === 'swarm') for (const e of [...enemies]) for (let j = 0; j < 2; j++) enemies.push(new Enemy(e.x + j * 17, e.y + j * 13));
        for (const e of enemies) {
            if (s.enemies === 'fast-weak' || s.enemies === 'swarm') { (e as any).health = 1; e.radius = 9; }
            if (s.enemies === 'fast-weak') e.speed *= 3;
            if (s.enemies === 'durable') (e as any).health *= 5;
            if (s.enemies === 'heavy-contact') e.damage *= 5;
        }
        return enemies;
    };
    let ticks = 0, abilityUses = 0, pistolTicks = 0, fallbackTicks = 0, collected = 0;
    const collect = controller.collectDrop.bind(controller);
    controller.collectDrop = drop => { collected++; collect(drop); };
    for (; ticks < Math.ceil(GameWorld.DURATION_MS / 1000 * 60) + 1 && player.currentHp > 0 && !world.isVictory; ticks++) {
        const enemies: Enemy[] = state.enemies;
        let nearest: Enemy | undefined, distance = Infinity;
        for (const e of enemies) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < distance) { nearest = e; distance = d; } }
        const t = ticks / 60;
        let tx = s.width / 2 + Math.cos(t * .14) * s.width * .31;
        let ty = s.height / 2 + Math.sin(t * .14) * s.height * .31;
        if (s.strategy === 'loot' && distance > 150 && state.pickups.length) {
            const pickup = [...state.pickups].sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
            tx = pickup.x; ty = pickup.y;
        }
        let dx = tx - player.x, dy = ty - player.y;
        if (nearest && distance < 100) { dx = player.x - nearest.x; dy = player.y - nearest.y; }
        if (s.strategy === 'kite') {
            const ax = player.x - s.width / 2, ay = player.y - s.height / 2;
            const norm = Math.max(1, Math.hypot(ax, ay));
            dx = -ay / norm; dy = ax / norm;
            if (norm < 1) { dx = 1; dy = 0; }
            for (const e of enemies) {
                const ex = player.x - e.x, ey = player.y - e.y, dist = Math.max(1, Math.hypot(ex, ey));
                if (dist < 220) { const force = 3 * (1 - dist / 220); dx += ex / dist * force; dy += ey / dist * force; }
            }
            const edge = 130;
            dx += 4 * Math.max(0, 1 - player.x / edge) - 4 * Math.max(0, 1 - (s.width - player.x) / edge);
            dy += 4 * Math.max(0, 1 - player.y / edge) - 4 * Math.max(0, 1 - (s.height - player.y) / edge);
            const scale = Math.max(.001, Math.hypot(dx, dy)); dx = 100 * dx / scale; dy = 100 * dy / scale;
        }
        (input as any).keys = new Set([...(dx > 5 ? ['KeyD'] : dx < -5 ? ['KeyA'] : []), ...(dy > 5 ? ['KeyS'] : dy < -5 ? ['KeyW'] : [])]);
        controls.inputController.mouseX = nearest?.x ?? player.x + 100;
        controls.inputController.mouseY = nearest?.y ?? player.y;
        controls.inputController.isShooting = !!nearest && s.strategy !== 'passive';
        if (s.strategy === 'passive') (input as any).keys.clear();
        const armed = inventory.slots.findIndex(w => w && w.id !== 'pistol' && w.state.hasAmmo);
        controller.switchToWeapon(armed >= 0 ? armed : 0);
        if (inventory.selectedWeapon.id === 'pistol') pistolTicks++;
        if (armed < 0 && inventory.slots.some(w => w && w.id !== 'pistol')) fallbackTicks++;
        let abilityReady = distance < 300;
        if (s.abilityPolicy === 'range-aware') {
            if (s.hero === 'half-mutant') abilityReady = distance < 85;
            if (s.hero === 'fanatic') abilityReady = distance < 130;
            if (s.hero === 'goliath') abilityReady = distance < 220;
            if (s.hero === 'destroyer' || s.hero === 'mercenary') abilityReady = enemies.filter(e => Math.hypot(e.x - player.x, e.y - player.y) < 500).length >= 5;
        }
        if (s.ability && nearest && abilityReady && world.activateAbility()) abilityUses++;
        world.update(1000 / 60);
    }
    const result = { ...s, victory: world.isVictory, seconds: round(Math.min(GameWorld.DURATION_MS / 1000, ticks / 60)), hp: round(player.currentHp), maxHp: player.maxHp,
        damageTaken: round(player.damageTaken), kills: controller.getStats().kills, projectileCount: controller.getStats().shots, accuracy: controller.getStats().accuracy, abilityUses, pistolSeconds: round(pistolTicks / 60), exhaustedSeconds: round(fallbackTicks / 60), equipmentPickups: collected,
        ammo: inventory.slots.filter(w => w).map(w => ({ weapon: w!.id, remaining: Number.isFinite(w!.state.ammoRemaining) ? w!.state.ammoRemaining : null })) };
    world.dispose(); controller.dispose(); return result;
}
const base: Scenario = { hero: 'mercenary', profile: 'new', gear: 'personal', width: 1280, height: 720, seed: 17, ability: true, strategy: 'orbit', enemies: 'default' };
assert.deepEqual(simulate(base), simulate(base), 'Repeated seed must be byte-identical');
const scenarios: Scenario[] = [];
for (const hero of CHARACTER_IDS.filter(id => !id.startsWith('unknown-'))) for (const profile of ['new', 'mid', 'max'] as const) for (const gear of ['equal', 'personal'] as const)
    for (const [width, height] of [[1280, 720], [1920, 1080]]) for (const seed of [17, 43, 91]) scenarios.push({ ...base, hero, profile, gear, width, height, seed });
for (const hero of ['destroyer', 'assassin', 'half-mutant', 'witcher', 'nuclear', 'hunter', 'plasma-nuclear'] as const) for (const seed of [17, 43, 91]) {
    scenarios.push({ ...base, hero, seed, ability: false });
    scenarios.push({ ...base, hero, seed, strategy: 'loot' });
    for (const enemies of ['fast-weak', 'durable', 'heavy-contact', 'swarm'] as const) scenarios.push({ ...base, hero, seed, enemies });
}
for (const hero of ['mercenary', 'witcher', 'goliath'] as const) for (const seed of [17,43,91]) scenarios.push({ ...base, hero, seed, strategy: 'passive', ability: false });
const kiteScenarios = CHARACTER_IDS.filter(id => !id.startsWith('unknown-')).flatMap(hero => [17,43,91].map(seed => ({ ...base, hero, seed, strategy: 'kite' as const })));
const policyScenarios = kiteScenarios.filter(s => ['half-mutant', 'fanatic', 'goliath', 'destroyer', 'mercenary'].includes(s.hero)).map(s => ({ ...s, abilityPolicy: 'range-aware' as const }));
const selected = process.argv.includes('--strategies-only') ? [...kiteScenarios, ...policyScenarios] : process.argv.includes('--baseline-only') ? scenarios : process.argv.includes('--policy-only') ? policyScenarios : process.argv.includes('--kite-only') ? kiteScenarios : process.argv.includes('--smoke') ? scenarios.slice(0, 1) : [...scenarios, ...kiteScenarios, ...policyScenarios];
mkdirSync('docs/balance', { recursive: true });
const rows: ReturnType<typeof simulate>[] = [];
selected.forEach((s, i) => { const r = simulate(s); rows.push(r); if ((i + 1) % 50 === 0) console.error(`${i + 1}/${selected.length}: ${s.hero}/${s.profile} ${r.victory ? "win" : r.seconds}`);  });
const hashFiles = ['src/systems/GameWorld.ts', 'src/entities/weapon/WeaponFactory.ts', 'src/gameplay/WeaponState.ts', 'src/systems/Player/PlayerWeaponController.ts'];
const hashes = Object.fromEntries(hashFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const output = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'docs/balance/survival-baseline.json';
mkdirSync('docs/balance', { recursive: true });
writeFileSync(output, JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeSourceHashes: hashes,
    provenance: process.argv.find(a => a.startsWith('--provenance=')) ? JSON.parse(readFileSync(process.argv.find(a => a.startsWith('--provenance='))!.slice(13), 'utf8')) : { timing: 'four combat hashes after run; historical initial run' },
    profiles, seeds: [17, 43, 91], deterministicRepeat: true, timestepMs: 1000 / 60,
    method: 'Real GameWorld/PlayerController at 60Hz; nearest-target aim, first available non-pistol slot; elliptical orbit, flee within100px; ability whenever nearest within300px and ready. Loot variant targets nearest pickup when enemy farther150px. Kite: full-speed tangent around arena center, summed repulsion within220px plus130px wall avoidance. Passive: no movement/fire/abilities. Range-aware policy: half-mutant within85px, fanatic130px, goliath220px; destroyer/mercenary at least5 enemies within500px.',
    limitations: ['Balanced budgets only; no achievement rewards, consumables or gold pickups; max means full budgets, not all possible allocations.', 'Bot has perfect enemy coordinates; no leading shots, no character-specific tactics or Telepath pickup hovering.', 'Only art and ground stamps disabled; no rendering/performance inference.', 'Drop/wave streams separate, but same seed does not mean same killed enemies or collected drops. Weapon spread shares seeded stream with effects.', 'Pistol-only equal gear can diverge after ordinary drops. Ammo counts are final inventory, not total consumption.', 'Experimental enemy axes mutate test instances only; not proposed finished enemy types or armor. fast-weak:HP1/radius9/speed3x; durable:HP5x; heavy-contact:damage5x; swarm:3x count/HP1/radius9.', 'No damage-source, overheal or boss-time attribution; no manual play validation.', 'Orbit follows a slowly moving waypoint and can be trapped by packs. Compare kite strategy; these are bot outcomes, not human win rates. Runtime diagonal movement is unnormalized.'], rows }, null, 2) + '\n');
console.log(JSON.stringify({ output, runs: rows.length, wins: rows.filter(r => r.victory).length }));
