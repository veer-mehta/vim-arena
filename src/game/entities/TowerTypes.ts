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
}

// Tower patterns based on the provided image
export const TOWER_TYPES: Record<string, TowerType> = {
    'sniper': {
        char: '#',
        name: 'Sniper Tower',
        maxHp: 3,
        damage: 1,
        range: 400,
        fireRate: 0.5,        // slow
        projectileSpeed: 600,
        color: 0x00aaff,
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
        fireRate: 2.0,        // fast
        projectileSpeed: 400,
        color: 0xff8800,
        scoreValue: 10,
        pattern: [
            ' / \\ ',
            '  •  ',
            ' \\ / '
        ]
    }
};

export function getTowerType(char: string): TowerType | null {
    return TOWER_TYPES[char] ?? null;
}

export function getTowerTypeByName(name: string): TowerType | null {
    return Object.values(TOWER_TYPES).find(type => type.name === name) ?? null;
}
