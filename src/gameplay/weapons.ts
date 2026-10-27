import type { HitEffect } from './HitEffect';
import type { WeaponCategory, WeaponId } from './ids';

export type AmmoDefinition = { readonly kind: 'infinite' } | {
    readonly kind: 'finite'; readonly initial: number; readonly capacity: number; readonly perShot: number;
};
export interface PelletDefinition { readonly angleOffset: number; readonly damageMultiplier: number }
export interface WeaponDefinition {
    readonly id: WeaponId;
    readonly name: string;
    readonly category: WeaponCategory;
    readonly damage: number;
    readonly shotIntervalMs: number;
    readonly speed: number;
    readonly pushBackForce: number;
    readonly ammo: AmmoDefinition;
    readonly projectile: 'bullet' | 'grenade' | 'flame' | 'laser' | 'plasma' | 'skull' | 'plasma-grenade';
    readonly effect?: HitEffect;
    readonly cursorIndicator?: 'hidden';
    readonly chargeMs?: number;
    readonly spinUpMs?: number;
    readonly burstGapMs?: number;
    readonly description?: string;
    readonly pellets: readonly PelletDefinition[];
}
const ammo = (initial: number): AmmoDefinition => ({ kind: 'finite', initial, capacity: initial * 2, perShot: 1 });
const slow: HitEffect = { slowFactor: .55, slowMs: 1500 };
const single = Object.freeze([{ angleOffset: 0, damageMultiplier: 1 }]);
// Ammo counts are provisional prototype balance, not prices or character starting grants.
export const WEAPON_DEFINITIONS: Readonly<Record<WeaponId, WeaponDefinition>> = {
    pistol: { id: 'pistol', name: 'Пистолет', category: 'sidearm', damage: 1, shotIntervalMs: 600,
        speed: 10, pushBackForce: 20, ammo: { kind: 'infinite' }, projectile: 'bullet', pellets: single },
    rifle: { id: 'rifle', name: 'Автомат', category: 'automatic', damage: 2.5, shotIntervalMs: 300,
        speed: 10, pushBackForce: 28, ammo: { kind: 'finite', initial: 120, capacity: 240, perShot: 1 }, projectile: 'bullet', pellets: single },
    shotgun: { id: 'shotgun', name: 'Дробовик', category: 'shotgun', damage: 5, shotIntervalMs: 1000,
        speed: 40, pushBackForce: 35, ammo: { kind: 'finite', initial: 30, capacity: 60, perShot: 1 }, projectile: 'bullet',
        pellets: [{ angleOffset: -.06, damageMultiplier: .5 }, { angleOffset: -.02, damageMultiplier: 1 },
            { angleOffset: .02, damageMultiplier: 1 }, { angleOffset: .06, damageMultiplier: .5 }] },
    m16: { id: 'm16', name: 'М16', category: 'automatic', damage: 4, shotIntervalMs: 250, speed: 16, pushBackForce: 16,
        ammo: ammo(100), projectile: 'bullet', pellets: single, description: 'Урон выше базового автомата.' },
    'machine-gun': { id: 'machine-gun', name: 'Пулемёт', category: 'automatic', damage: 2, shotIntervalMs: 60, speed: 16, pushBackForce: 5,
        ammo: ammo(300), projectile: 'bullet', pellets: single, spinUpMs: 450, description: 'Короткий разгон, затем очень быстрая стрельба.' },
    ak47: { id: 'ak47', name: 'АК-47', category: 'automatic', damage: 7, shotIntervalMs: 350, speed: 16, pushBackForce: 25,
        ammo: ammo(70), projectile: 'bullet', pellets: single, description: 'Высокий урон, небольшой боезапас.' },
    'plasma-auto': { id: 'plasma-auto', cursorIndicator: 'hidden', name: 'Плазмомёт', category: 'automatic', damage: 2, shotIntervalMs: 85, speed: 13, pushBackForce: 3,
        ammo: ammo(400), projectile: 'bullet', pellets: single, effect: slow, description: 'Быстрые плазменные заряды замедляют врагов.' },
    'double-barrel': { id: 'double-barrel', name: 'Двустволка', category: 'shotgun', damage: 5, shotIntervalMs: 1200, speed: 40, pushBackForce: 35,
        ammo: ammo(40), projectile: 'bullet', burstGapMs: 110,
        pellets: [{ angleOffset: -.06, damageMultiplier: .5 }, { angleOffset: -.02, damageMultiplier: 1 },
            { angleOffset: .02, damageMultiplier: 1 }, { angleOffset: .06, damageMultiplier: .5 }], description: 'Два выстрела подряд: по одному патрону, затем перезарядка.' },
    flamethrower: { id: 'flamethrower', cursorIndicator: 'hidden', name: 'Огнемёт', category: 'special', damage: 0, shotIntervalMs: 65, speed: 7, pushBackForce: 0,
        ammo: ammo(200), projectile: 'flame', pellets: [{ angleOffset: -.12, damageMultiplier: 1 }, { angleOffset: 0, damageMultiplier: 1 }, { angleOffset: .12, damageMultiplier: 1 }],
        effect: { burnDps: 4, burnMs: 1500 }, description: 'Короткий поток огня поджигает врагов.' },
    laser: { id: 'laser', cursorIndicator: 'hidden', name: 'Лазер', category: 'special', damage: 1, shotIntervalMs: 65, speed: 0, pushBackForce: 0,
        ammo: ammo(200), projectile: 'laser', pellets: single, description: 'Красный непрерывный луч до края карты.' },
    'skull-launcher': { id: 'skull-launcher', name: 'Черепомёт', category: 'special', damage: 10, shotIntervalMs: 1300, speed: 7, pushBackForce: 20,
        ammo: ammo(30), projectile: 'skull', pellets: single, description: 'Взрыв черепа выпускает восемь осколков.' },
    'plasma-cannon': { id: 'plasma-cannon', name: 'Плазмопушка', category: 'scientific', damage: 18, shotIntervalMs: 500, speed: 0, pushBackForce: 10,
        ammo: ammo(30), projectile: 'plasma', pellets: single, chargeMs: 450, effect: slow, description: 'Зарядка, затем мощный широкий белый луч.' },
    'plasma-grenade': { id: 'plasma-grenade', name: 'Плазмогранаты', category: 'scientific', damage: 16, shotIntervalMs: 1100, speed: 6, pushBackForce: 10,
        ammo: ammo(20), projectile: 'plasma-grenade', pellets: single, effect: slow, description: 'Круговой плазменный взрыв с замедлением.' },
    'grenade-launcher': { id: 'grenade-launcher', name: 'Базука', category: 'special', damage: 14, shotIntervalMs: 1400,
        speed: 7, pushBackForce: 38, ammo: { kind: 'finite', initial: 10, capacity: 20, perShot: 1 }, projectile: 'grenade', pellets: single },
};
