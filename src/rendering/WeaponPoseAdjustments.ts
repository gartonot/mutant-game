import type { CharacterId, WeaponId } from '@/gameplay/ids';
import { CHARACTER_IDS } from '@/gameplay/ids';
import { CHARACTER_RIGS } from './CharacterRig';

/** Art-directed corrections relative to the automatic mount. Rotation pivots at the stock. */
export type WeaponPoseAdjustment = Readonly<{ x: number; y: number; angle: number;
    /** Shoulder-supported weapons use this body-space contact instead of the front palm. */
    shoulder?: Readonly<{ x: number; y: number }> }>;
const tilt = -5 * Math.PI / 180;
const tiltedWeapons: WeaponId[] = ['rifle', 'shotgun', 'm16', 'ak47', 'plasma-auto', 'double-barrel', 'laser'];
const levelWeapons: WeaponId[] = ['machine-gun', 'flamethrower', 'skull-launcher', 'plasma-cannon'];
const standardPoses = Object.fromEntries(CHARACTER_IDS.filter(id => id !== 'destroyer').map(id => {
    const [rear, front] = CHARACTER_RIGS[id].palms;
    const clasped = Math.hypot(front.x - rear.x, front.y - rear.y) < 10;
    const anchor = clasped ? { x: (rear.x + front.x) / 2, y: (rear.y + front.y) / 2 } : rear;
    const poses: Partial<Record<WeaponId, WeaponPoseAdjustment>> = {};
    // Long reaches need less retreat, otherwise the supporting hand passes the fore-end.
    const retreat = Math.min(6, Math.max(1, 34 - Math.hypot(front.x - rear.x, front.y - rear.y)));
    for (const weapon of tiltedWeapons) poses[weapon] = { x: -retreat, y: 3, angle: tilt };
    for (const weapon of levelWeapons) poses[weapon] = { x: -6, y: 0, angle: 0 };
    // Place the launcher at the shoulder in body space, independently of arm reach.
    // Its automatic trigger grip is (3,1), and rotation pivots at the stock (-14,0).
    poses['grenade-launcher'] = {
        x: 8 - (anchor.x - 3) + 14 * (1 - Math.cos(tilt)),
        y: 18 - (anchor.y - 1) - 14 * Math.sin(tilt),
        angle: tilt, shoulder: { x: 12, y: 18 },
    };
    return [id, poses];
}));

export const WEAPON_POSE_ADJUSTMENTS: Partial<Record<CharacterId, Partial<Record<WeaponId, WeaponPoseAdjustment>>>> = {
    ...standardPoses,
    destroyer: {
        rifle: { x: -18, y: 7, angle: -.12 },
        shotgun: { x: -15, y: 8, angle: -.24 },
        m16: { x: -14, y: 9, angle: -.21 },
        'machine-gun': { x: -12, y: 0, angle: 0 },
        ak47: { x: -15, y: 8, angle: -.14 },
        'plasma-auto': { x: -15, y: 7, angle: -.20 },
        'double-barrel': { x: -10, y: 4, angle: -.15 },
        flamethrower: { x: -13, y: 1, angle: 0 },
        laser: { x: -11, y: 5, angle: -.13 },
        'skull-launcher': { x: -9, y: 5, angle: -.14 },
        'plasma-cannon': { x: -14, y: 5.5, angle: -.10 },
        'grenade-launcher': { x: -40, y: 13, angle: -.13, shoulder: { x: 12, y: 17 } },
    },
};
