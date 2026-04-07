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
        const sniper = TOWER_TYPES['sniper'];
        if (sniper) {
            this.clipboard.push({
                towerType: sniper,
                position: {row: 0, col: 0},
                pattern: [...sniper.pattern],
                baseKillsRequired: 25,
                currentKills: 0 // Starts empty
            });
        }
        const rapid = TOWER_TYPES['rapid'];
        if (rapid) {
            this.clipboard.push({
                towerType: rapid,
                position: {row: 0, col: 0},
                pattern: [...rapid.pattern],
                baseKillsRequired: 40,
                currentKills: 0 // Starts empty
            });
        }
    }

    public getEntryCost(entry: ClipboardEntry): number {
        if (entry.baseKillsRequired === 0) return 0;
        const timePenalty = Math.floor(this.gameState.elapsedSeconds / 60) * 10;
        return entry.baseKillsRequired + timePenalty;
    }

    public yankPattern(pattern: string[]): boolean {
        // Is it a known tower?
        const knownTower = Object.values(TOWER_TYPES).find(t => 
            t.pattern.length === pattern.length && t.pattern.every((line, i) => line === pattern[i])
        );

        let towerType: TowerType;
        if (knownTower) {
            towerType = knownTower;
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
        }

        // Insert at index 2 (which is 3p)
        this.clipboard.splice(2, 0, {
            towerType,
            position: {row: 0, col: 0},
            pattern: pattern,
            baseKillsRequired: 20, // 20 cost to paste
            currentKills: 0   // Start empty
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
