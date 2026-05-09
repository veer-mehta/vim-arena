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
	readonly isWall?: boolean;        // true if this is just an environmental wall
	readonly isAoe?: boolean;         // true if attacks deal AoE damage
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
	'wall': {
		char: '[',
		name: 'Wall Tower',
		maxHp: 20,
		damage: 0,
		range: 0,
		fireRate: 0,
		projectileSpeed: 0,
		color: 0x404040,      // Gray
		scoreValue: 5,
		isWall: true,
		pattern: [
			'[===]'
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
	}
};

export function getTowerType(char: string): TowerType | null {
	return TOWER_TYPES[char] ?? null;
}

export function getTowerTypeByName(name: string): TowerType | null {
	return Object.values(TOWER_TYPES).find(type => type.name === name) ?? null;
}
