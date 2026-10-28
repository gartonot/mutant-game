import { writeFile } from 'node:fs/promises';
import { createWeapon } from '../../src/entities/weapon/WeaponFactory';
import { WEAPON_DEFINITIONS } from '../../src/gameplay/weapons';
import { PlayerWeaponController } from '../../src/systems/Player/PlayerWeaponController';
import { CollisionSystem } from '../../src/systems/CollisionSystem';
import { Enemy } from '../../src/entities/enemy/Enemy';
import { EnemyType } from '../../src/entities/enemy/EnemyType';
import type { PlayerController } from '../../src/systems/Player/PlayerController';

const dt = 1000 / 60;
const round = (n: number) => Math.round(n * 1000) / 1000;
function measure(intervalMs: number, ammo: number, speed: number, range: number, lag: number, phase: number, motion: 'cross' | 'approach') {
    Object.assign(WEAPON_DEFINITIONS.flamethrower, { shotIntervalMs: intervalMs });
    const weapon = createWeapon('flamethrower', 1, 1, undefined, 1, 1, ammo);
    let now = 0, useful = 0, usefulFirst6Seconds = 0, ignitionMs: number | null = null, emptyMs: number | null = null, exposureMs = 0;
    const firing = new PlayerWeaponController([weapon], () => now);
    const collision = new CollisionSystem();
    // 1000 HP ensures no death replacement obscures coverage. This is a synthetic probe, not a proposed enemy.
    const target = new Enemy(0, 0, EnemyType.GRUNT);
    Object.assign(target, { health: 1000 }); target.speed = 0;
    const receive = target.receiveDamage.bind(target);
    target.receiveDamage = (damage, angle) => { useful += damage; receive(damage, angle, 0); };
    const apply = target.applyEffect.bind(target);
    target.applyEffect = effect => { if (effect?.burnMs) ignitionMs ??= now; apply(effect); };
    const position = (time: number) => {
        const t = Math.max(0, time) / 1000;
        if (motion === 'cross') {
            // Repeated lateral traversals at constant speed, no random choices.
            const cycle = ((t * speed + phase * 300) % 600 + 600) % 600;
            return { x: 400 + range, y: 360 + (cycle <= 300 ? cycle : 600 - cycle) - 150 };
        }
        // Approaches from nominal range, then resets outward on contact distance; counts exposure, not player damage.
        const travel = Math.max(1, range - 30);
        return { x: 400 + range - ((t * speed + phase * travel) % travel), y: 360 };
    };
    const controller = { getBullets: () => firing.getBullets(), registerHit() {}, registerProjectiles() {} } as unknown as PlayerController;
    for (let frame = 0; frame < 60 * 60; frame++) {
        now = frame * dt;
        const actual = position(now), aimed = position(now - lag);
        target.x = actual.x; target.y = actual.y;
        if (Math.hypot(target.x - 400, target.y - 360) <= 65) exposureMs += dt;
        firing.tryShoot(400, 360, Math.atan2(aimed.y - 360, aimed.x - 400));
        if (!weapon.state.hasAmmo) emptyMs ??= now;
        for (const bullet of firing.getBullets()) if (!bullet.isDead) bullet.update(dt);
        collision.checkBulletEnemyCollisions(controller, [target]);
        target.update(dt);
        if (frame === 359) usefulFirst6Seconds = useful;
        firing.setBullets(firing.getBullets().filter(b => !b.isDead && !b.expired));
    }
    return { intervalMs, initialAmmo: ammo, speedPixelsPerSecond: speed, range, aimLagMs: lag, phase, motion,
        ignitionMs: ignitionMs === null ? null : round(ignitionMs), usefulDamage: round(useful), usefulFirst6Seconds: round(usefulFirst6Seconds),
        emptyMs: emptyMs === null ? null : round(emptyMs), exposureMs: round(exposureMs),
        escapedIgnition: ignitionMs === null, ammoSpent: ammo - weapon.state.ammoRemaining };
}
export async function runMovingFlame(output: string) {
    const original = WEAPON_DEFINITIONS.flamethrower.shotIntervalMs;
    const run = () => [65, 130].flatMap(interval => [100, 200].flatMap(ammo => [60, 180].flatMap(speed =>
        [130, 230].flatMap(range => [0, 150].flatMap(lag => [0, .37, .71].flatMap(phase =>
            (['cross', 'approach'] as const).map(motion => measure(interval, ammo, speed, range, lag, phase, motion))))))));
    try {
        const results = run();
        if (JSON.stringify(results) !== JSON.stringify(run())) throw new Error('Moving flame fixture not repeatable');
        await writeFile(output, JSON.stringify({ methodology: {
            simulationHz: 60, durationSeconds: 60, repeatCount: 2, identicalRepeats: true,
            description: 'Synthetic 1000HP grunt-radius target, deterministic lateral traversals or repeated approaches, actual collision/burn/weapon-controller code. No outgoing enemy damage, no player avoidance, no death replacement.',
            exposure: 'Time within 65px of stationary player, independent of damage because target survives. Not a survival or safety estimate.',
            lag: 'Aim at target position 0 or150ms ago; reset positions are fixture discontinuities.',
            candidate: 'In-memory interval65/130ms; burnDps4 unchanged, configuration restored afterward.',
        }, results }, null, 2) + '\n');
    } finally { Object.assign(WEAPON_DEFINITIONS.flamethrower, { shotIntervalMs: original }); }
}
