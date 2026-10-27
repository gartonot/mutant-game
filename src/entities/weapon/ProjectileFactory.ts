import { Beam } from '@/entities/bullet/Beam';
import { Flame } from '@/entities/bullet/Flame';
import { Bullet } from '@/entities/bullet/Bullet';
import { Grenade } from '@/entities/bullet/Grenade';
import type { WeaponDefinition } from '@/gameplay/weapons';

type ProjectileBuilder = (definition: WeaponDefinition, x: number, y: number, angle: number, damage: number) => Bullet;

// Adding a projectile kind to the catalog requires an explicit constructor here.
// Cadence, charging and ammunition remain the weapon's responsibility.
const PROJECTILE_BUILDERS: Record<WeaponDefinition['projectile'], ProjectileBuilder> = {
    bullet: (d, x, y, angle, damage) => new Bullet(x, y, angle, damage, d.speed, d.pushBackForce),
    laser: (d, x, y, angle, damage) => new Beam(x, y, angle, damage, d.pushBackForce, false),
    plasma: (d, x, y, angle, damage) => new Beam(x, y, angle, damage, d.pushBackForce, true),
    flame: (d, x, y, angle) => new Flame(x, y, angle, d.speed),
    grenade: (d, x, y, angle, damage) => new Grenade(x, y, angle, damage, d.speed, d.pushBackForce, 'normal'),
    skull: (d, x, y, angle, damage) => new Grenade(x, y, angle, damage, d.speed, d.pushBackForce, 'skull'),
    'plasma-grenade': (d, x, y, angle, damage) => new Grenade(x, y, angle, damage, d.speed, d.pushBackForce, 'plasma'),
};

export function createProjectile(definition: WeaponDefinition, x: number, y: number, angle: number, damage: number, effectMultiplier = 1): Bullet {
    const result = PROJECTILE_BUILDERS[definition.projectile](definition, x, y, angle, damage);
    // Effects belong to the spawned projectile; consumers must not mutate catalog balance.
    result.effect = definition.effect ? { ...definition.effect } : undefined;
    if (result.effect?.burnDps) result.effect = { ...result.effect, burnDps: result.effect.burnDps * effectMultiplier };
    return result;
}
