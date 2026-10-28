import type { Bullet } from '@/entities/bullet/Bullet';
import type { WeaponId } from '@/gameplay/ids';
import type { WeaponState } from '@/gameplay/WeaponState';

export interface IWeapon {
    readonly id: WeaponId;
    readonly name: string;
    readonly state: WeaponState;
    readonly chargeProgress: number;
    readonly chargeDurationMs: number;
    readonly isCharging: boolean;
    setPickupModifiers(damage: number, attackSpeed: number, now: number): void;
    setDualWeaponsActive(active: boolean): void;
    cursorProgress(now: number): number | null;
    resetTrigger(now: number, preserveProjectiles?: boolean): void;
    tryFire(now: number, x: number, y: number, angle: number,
        onVisualEffect?: (x: number, y: number, angle: number) => void, triggerHeld?: boolean): Bullet[] | null;
}
