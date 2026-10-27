import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import { CHARACTER_IDS } from '@/gameplay/ids';
import type { CharacterId, WeaponId } from '@/gameplay/ids';
import { CHARACTER_RIGS } from './CharacterRig';
import { WEAPON_POSE_ADJUSTMENTS } from './WeaponPoseAdjustments';

/** Canonical weapon coordinates: barrel points along +X, muzzle lies on Y=0. */
export const WEAPON_ART = Object.fromEntries(Object.values(WEAPON_DEFINITIONS).map(d => [d.id, {
    name: d.name, muzzle: d.id === 'pistol' ? 29 : d.id === 'plasma-grenade' ? 27 : d.category === 'shotgun' ? 49 : 46,
    support: d.id === 'pistol' ? 12 : 26,
}])) as Record<WeaponId, { name: string; muzzle: number; support: number }>;
export const WEAPON_ORDER = Object.keys(WEAPON_DEFINITIONS) as WeaponId[];
export const WEAPON_MOUNT = Object.freeze({ x: 7, y: 9, angle: 0 });
type Point = Readonly<{ x: number; y: number }>;
export type SupportZone = Readonly<{ xMin: number; xMax: number; yMin: number; yMax: number }>;
type WeaponRig = Readonly<{ grip: Point; compact: boolean; supportZone: SupportZone }>;

/** Calibrate a weapon once, in the same coordinates used by WeaponSprites and its Canvas fallback. */
const GRIP_X: Record<WeaponId, number> = {
    pistol: 5, rifle: 5, m16: 7, ak47: 6, shotgun: 4, 'double-barrel': 4,
    'machine-gun': 1, 'plasma-auto': 5, flamethrower: 0, laser: 5,
    'skull-launcher': 3, 'plasma-cannon': 0, 'plasma-grenade': 14, 'grenade-launcher': 3,
};
export const WEAPON_RIGS = Object.fromEntries(WEAPON_ORDER.map(id => [id, {
    grip: { x: GRIP_X[id], y: id === 'plasma-grenade' ? 0 : 1 },
    compact: id === 'pistol' || id === 'plasma-grenade',
    // The supporting hand may slide along the receiver/fore-end; it must not cover the muzzle.
    supportZone: { xMin: GRIP_X[id] - 4, xMax: WEAPON_ART[id].muzzle - 4, yMin: -4, yMax: 4 },
}])) as Record<WeaponId, WeaponRig>;

/** Automatic palm mount with optional art-directed pose. Weapon size is never changed. */
export function weaponAttachment(character: CharacterId, weapon: WeaponId, recoil = 0) {
    const palms = CHARACTER_RIGS[character].palms;
    const rear = palms[0], front = palms[palms.length - 1];
    const rig = WEAPON_RIGS[weapon];
    const clasped = Math.hypot(front.x - rear.x, front.y - rear.y) < 10;
    const anchor = clasped ? { x: (rear.x + front.x) / 2, y: (rear.y + front.y) / 2 }
        : rig.compact ? front : rear;
    const adjustment = WEAPON_POSE_ADJUSTMENTS[character]?.[weapon];
    const angle = adjustment?.angle ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
    const pivot = weapon === 'pistol' ? -2 : weapon === 'plasma-grenade' ? 1 : -14;
    const x = anchor.x - rig.grip.x - recoil + (adjustment?.x ?? 0) + pivot * (1 - cos);
    const y = anchor.y - rig.grip.y + (adjustment?.y ?? 0) - pivot * sin;
    const transform = (px: number, py: number) => ({ x: x + px * cos - py * sin, y: y + px * sin + py * cos });
    const supportActive = clasped || !rig.compact;
    const contact = adjustment?.shoulder ?? (clasped || !rig.compact ? front : rear);
    const support = { x: contact.x - recoil, y: contact.y };
    const z = rig.supportZone;
    const supportPolygon = [transform(z.xMin, z.yMin), transform(z.xMax, z.yMin), transform(z.xMax, z.yMax), transform(z.xMin, z.yMax)];
    const supportZone = { xMin: Math.min(...supportPolygon.map(p => p.x)), xMax: Math.max(...supportPolygon.map(p => p.x)),
        yMin: Math.min(...supportPolygon.map(p => p.y)), yMax: Math.max(...supportPolygon.map(p => p.y)) };
    const sx = (support.x - x) * cos + (support.y - y) * sin;
    const sy = -(support.x - x) * sin + (support.y - y) * cos;
    const supportValid = !supportActive || (sx >= z.xMin && sx <= z.xMax && sy >= z.yMin && sy <= z.yMax);
    return { x, y, angle, adjusted: !!adjustment, supportKind: adjustment?.shoulder ? 'shoulder' : 'hand', scale: 1 as const, primary: transform(rig.grip.x, rig.grip.y), support,
        muzzle: transform(WEAPON_ART[weapon].muzzle, 0), supportZone, supportPolygon, supportActive, supportValid };
}

// Rigs are static authoring data. Resolve the small attachment table once, rather than
// allocating diagnostics and computing palm distances on every draw/projectile spawn.
const WEAPON_MOUNTS = Object.fromEntries(CHARACTER_IDS.map(character => [character,
    Object.fromEntries(WEAPON_ORDER.map(weapon => {
        const { x, y, angle } = weaponAttachment(character, weapon);
        return [weapon, Object.freeze({ x, y, angle })];
    })),
])) as Record<CharacterId, Record<WeaponId, Readonly<Point & { angle: number }>>>;

export function weaponMount(character?: CharacterId, weapon: WeaponId = 'rifle'): Readonly<Point & { angle: number }> {
    if (!character) return WEAPON_MOUNT;
    return WEAPON_MOUNTS[character][weapon];
}

/** Same attachment as rendering. Recoil is optional for previewing the post-shot visual pose. */
export function muzzlePosition(id: WeaponId, x: number, y: number, angle: number, character?: CharacterId, recoil = 0) {
    const mount = weaponMount(character, id);
    const forward = mount.x + WEAPON_ART[id].muzzle * Math.cos(mount.angle) - recoil;
    const lateral = mount.y + WEAPON_ART[id].muzzle * Math.sin(mount.angle);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return { x: x + cos * forward - sin * lateral,
        y: y + sin * forward + cos * lateral };
}
