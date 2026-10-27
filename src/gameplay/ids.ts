// Domain identifiers must not depend on canvas rendering or UI.
export const CHARACTER_IDS = ['destroyer', 'assassin', 'mercenary', 'half-mutant', 'telepath', 'cyborg', 'goliath', 'fanatic', 'nuclear', 'silver-hunter', 'witcher', 'plasma-nuclear', 'hunter', 'unknown-white-outfit', 'unknown-crossbow'] as const;
export type CharacterId = typeof CHARACTER_IDS[number];
export const WEAPON_IDS = ['pistol', 'rifle', 'shotgun', 'm16', 'machine-gun', 'ak47', 'plasma-auto', 'double-barrel', 'flamethrower', 'laser', 'skull-launcher', 'plasma-cannon', 'plasma-grenade', 'grenade-launcher', 'tesla', 'impulse', 'acid-gun', 'crossbow', 'disc-launcher'] as const;
export type WeaponId = typeof WEAPON_IDS[number];
export type WeaponCategory = 'sidearm' | 'automatic' | 'shotgun' | 'special' | 'scientific';
