import { TowerType, TOWER_TYPES } from '../entities/TowerTypes';
import { GameState } from '../GameState';

export interface ClipboardEntry {
    towerType: TowerType;
    pattern: string[];
    baseEnergyCost: number;
}

export class ClipboardSystem {
    private clipboard: ClipboardEntry[] = [];

    constructor(private gameState: GameState) {
        const defaults: Array<[string, number]> = [
            ['sniper', 10],
            ['rapid',  15],
            ['wall',    0],
            ['pulse',  12],
        ];
        for (const [id, cost] of defaults) {
            const t = TOWER_TYPES[id];
            if (t) this.clipboard.push({ towerType: t, pattern: [...t.pattern], baseEnergyCost: cost });
        }
    }

    getEntryCost(entry: ClipboardEntry): number {
        if (entry.baseEnergyCost === 0) return 0;
        const timePenalty = Math.floor(this.gameState.elapsedSeconds / 120) * 5;
        return entry.baseEnergyCost + timePenalty;
    }

    yankPattern(pattern: string[]): boolean {
        if (!this.gameState.tryConsumeEnergy(5)) return false;

        const known = Object.values(TOWER_TYPES).find(t =>
            t.pattern.length === pattern.length && t.pattern.every((line, i) => line === pattern[i])
        );

        const towerType: TowerType = known ?? {
            char: 'W',
            name: 'Custom Structure',
            maxHp: 1,
            damage: 0,
            range: 0,
            fireRate: 0,
            projectileSpeed: 0,
            color: 0x888888,
            scoreValue: 0,
            pattern,
            isWall: true,
        };

        const cost = known ? (known.name.toLowerCase().includes('wall') ? 0 : 8) : 0;

        this.clipboard.splice(2, 0, { towerType, pattern, baseEnergyCost: cost });
        if (this.clipboard.length > 9) this.clipboard.splice(9);
        return true;
    }

    useEntry(index: number): boolean {
        const entry = this.clipboard[index];
        return !!entry && this.gameState.tryConsumeEnergy(this.getEntryCost(entry));
    }

    getClipboard(): ClipboardEntry[] {
        return [...this.clipboard];
    }

    // No-op kept for call-site compatibility — energy is granted in GameState.addKill
    onEnemyKilled(): void {}
}
