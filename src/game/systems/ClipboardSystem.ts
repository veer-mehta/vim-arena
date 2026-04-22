import { TowerType, TOWER_TYPES } from '../entities/TowerTypes';
import { GameState } from '../GameState';

export interface ClipboardEntry {
    towerType: TowerType;
    position: {row: number, col: number};
    pattern: string[];
    baseKillsRequired: number;
    currentKills: number;
}

export class ClipboardSystem {
    private clipboard: ClipboardEntry[] = [];
    
    constructor(private gameState: GameState) {
        // Give starting kills so the user can paste immediately
        for (let i = 0; i < 100; i++) this.onEnemyKilled();

        const sniper = TOWER_TYPES['sniper'];
        if (sniper) {
            this.clipboard.push({
                towerType: sniper,
                position: {row: 0, col: 0},
                pattern: [...sniper.pattern],
                baseKillsRequired: 10,
                currentKills: 100 // Pre-filled
            });
        }
        const rapid = TOWER_TYPES['rapid'];
        if (rapid) {
            this.clipboard.push({
                towerType: rapid,
                position: {row: 0, col: 0},
                pattern: [...rapid.pattern],
                baseKillsRequired: 15,
                currentKills: 100 // Pre-filled
            });
        }
        
        const wall = TOWER_TYPES['wall'];
        if (wall) {
            this.clipboard.push({
                towerType: wall,
                position: {row: 0, col: 0},
                pattern: [...wall.pattern],
                baseKillsRequired: 0, // Walls are free
                currentKills: 100
            });
        }
        
        const pulse = TOWER_TYPES['pulse'];
        if (pulse) {
            this.clipboard.push({
                towerType: pulse,
                position: {row: 0, col: 0},
                pattern: [...pulse.pattern],
                baseKillsRequired: 12,
                currentKills: 100
            });
        }
    }

    public getEntryCost(entry: ClipboardEntry): number {
        if (entry.towerType.name === 'Custom Structure') return 0; // Free to paste text
        if (entry.baseKillsRequired === 0) return 0;
        const timePenalty = Math.floor(this.gameState.elapsedSeconds / 120) * 5; // Slower penalty growth
        return entry.baseKillsRequired + timePenalty;
    }

    public yankPattern(pattern: string[]): boolean {
        // Is it a known tower?
        const knownTower = Object.values(TOWER_TYPES).find(t => 
            t.pattern.length === pattern.length && t.pattern.every((line, i) => line === pattern[i])
        );

        let towerType: TowerType;
        let cost = 5;

        if (knownTower) {
            towerType = knownTower;
            cost = knownTower.name.toLowerCase().includes('wall') ? 0 : 8;
        } else {
            // It's a custom wall or custom structure
            towerType = {
                char: 'W',
                name: 'Custom Structure',
                maxHp: 1,
                damage: 0,
                range: 0,
                fireRate: 0,
                projectileSpeed: 0,
                color: 0x888888,
                scoreValue: 0,
                pattern: pattern,
                isWall: true
            };
            cost = 0; // Custom text is free
        }

        // Insert at index 2 (which is 3p)
        this.clipboard.splice(2, 0, {
            towerType,
            position: {row: 0, col: 0},
            pattern: pattern,
            baseKillsRequired: cost,
            currentKills: 100 // Start with enough kills
        });

        // Limit to 9 items
        if (this.clipboard.length > 9) {
            this.clipboard.splice(9);
        }
        return true;
    }

    public canPaste(towerTypeName: string): boolean {
        const entry = this.clipboard.find(e => e.towerType.name === towerTypeName);
        return entry ? entry.currentKills >= this.getEntryCost(entry) : false;
    }

    public useEntry(index: number): boolean {
        const entry = this.clipboard[index];
        if (entry && entry.currentKills >= this.getEntryCost(entry)) {
            // Drop ALL paste slots to 0 when anything is used
            for (const e of this.clipboard) {
                e.currentKills = 0;
            }
            return true;
        }
        return false;
    }

    public getClipboard(): ClipboardEntry[] {
        return [...this.clipboard];
    }

    public onEnemyKilled(): void {
        // Update progress for all clipboard entries
        for (const entry of this.clipboard) {
            if (entry.currentKills < this.getEntryCost(entry)) {
                entry.currentKills++;
            }
        }
    }
}
