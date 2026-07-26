export interface TowerType {
	readonly char: string;
	readonly name: string;
	readonly maxHp: number;
	readonly damage: number;
	readonly range: number;           // pixels
	readonly fireRate: number;        // shots per second
	readonly projectileSpeed: number; // px per second
	readonly color: number;           // hex tint for HP bar
	readonly scoreValue: number;      // score per enemy kill
	readonly pattern: string[];       // multi-character pattern
	readonly isAoe?: boolean;         // true if attacks deal AoE damage
	readonly explosionRadius?: number; // optional explosion radius for bomb projectile
}

// Tower patterns based on the provided image
export const TOWER_TYPES: Record<string, TowerType> = {
	'sniper': {
		char: '#',
		name: 'Sniper Tower',
		maxHp: 3,
		damage: 1,
		range: 400,
		fireRate: 1.0,        // faster
		projectileSpeed: 1000,
		color: 0xffffff,
		scoreValue: 10,
		pattern: [
			'  |  ',
			'  •  ',
			' / \\ '
		]
	},
	'rapid': {
		char: '@',
		name: 'Rapid Tower',
		maxHp: 3,
		damage: 1,
		range: 120,
		fireRate: 4.0,        // machine gun
		projectileSpeed: 800,
		color: 0xe6b800,      // Yellow
		scoreValue: 10,
		pattern: [
			' / \\ ',
			'  •  ',
			' \\ / '
		]
	},
	'pulse': {
		char: '*',
		name: 'Pulse Tower',
		maxHp: 4,
		damage: 1,
		range: 250,
		fireRate: 2.5,
		projectileSpeed: 1200,
		color: 0xb32d2d,      // Dull Red
		scoreValue: 15,
		isAoe: true,
		pattern: [
			'  *  ',
			' * * ',
			'* O *',
			' * * ',
			'  *  '
		]
	},
	'bomb': {
		char: 'B',
		name: 'Bomb Tower',
		maxHp: 4,
		damage: 2,
		range: 220,
		fireRate: 0.5,
		projectileSpeed: 300,
		color: 0xff7733,
		scoreValue: 20,
		explosionRadius: 64,
		pattern: [
			' (o) ',
			'  •  ',
			' [B] '
		]
	}
};

export function getTowerType(char: string): TowerType | null {
	return TOWER_TYPES[char] ?? null;
}

export function getTowerTypeByName(name: string): TowerType | null {
	return Object.values(TOWER_TYPES).find(type => type.name === name) ?? null;
}
