import { TowerType, TOWER_TYPES } from '../entities/TowerTypes';
import { GameState } from '../GameState';

export interface ClipboardEntry {
    towerType: TowerType;
    position: {row: number, col: number};
    pattern: string[];
    baseEnergyCost: number;
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
                baseEnergyCost: 10
            });
        }
        const rapid = TOWER_TYPES['rapid'];
        if (rapid) {
            this.clipboard.push({
                towerType: rapid,
                position: {row: 0, col: 0},
                pattern: [...rapid.pattern],
                baseEnergyCost: 15
            });
        }
        
        const wall = TOWER_TYPES['wall'];
        if (wall) {
            this.clipboard.push({
                towerType: wall,
                position: {row: 0, col: 0},
                pattern: [...wall.pattern],
                baseEnergyCost: 0 // Walls are free
            });
        }
        
        const pulse = TOWER_TYPES['pulse'];
        if (pulse) {
            this.clipboard.push({
                towerType: pulse,
                position: {row: 0, col: 0},
                pattern: [...pulse.pattern],
                baseEnergyCost: 12
            });
        }
    }

    public getEntryCost(entry: ClipboardEntry): number {
        if (entry.towerType.name === 'Custom Structure') return 0; // Free to paste text
        if (entry.baseEnergyCost === 0) return 0;
        const timePenalty = Math.floor(this.gameState.elapsedSeconds / 120) * 5; // Slower penalty growth
        return entry.baseEnergyCost + timePenalty;
    }

    public yankPattern(pattern: string[]): boolean {
        // Copying now costs energy (e.g. 5 energy)
        const COPY_COST = 5;
        if (!this.gameState.tryConsumeEnergy(COPY_COST)) {
            return false;
        }

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
            baseEnergyCost: cost
        });

        // Limit to 9 items
        if (this.clipboard.length > 9) {
            this.clipboard.splice(9);
        }
        return true;
    }

    public canPaste(towerTypeName: string): boolean {
        const entry = this.clipboard.find(e => e.towerType.name === towerTypeName);
        return entry ? this.gameState.energy >= this.getEntryCost(entry) : false;
    }

    public useEntry(index: number): boolean {
        const entry = this.clipboard[index];
        if (entry) {
            const cost = this.getEntryCost(entry);
            if (this.gameState.tryConsumeEnergy(cost)) {
                return true;
            }
        }
        return false;
    }

    public getClipboard(): ClipboardEntry[] {
        return [...this.clipboard];
    }

    public onEnemyKilled(): void {
        // Kills directly add energy in GameState, so nothing needed here.
    }
}
