import { Scene } from 'phaser';
import { Tower } from '../entities/Tower';
import { TOWER_TYPES } from '../entities/TowerTypes';
import { VimEngine } from '../vim/VimEngine';
import { ClipboardSystem } from './ClipboardSystem';
import { GameState } from '../GameState';

// Initial predefined tower placements
const INITIAL_TOWERS: Array<{row: number, type: string}> = [
    {row: 10, type: 'sniper'},
    {row: 20, type: 'rapid'},
];

export class TowerSystem {
    private readonly scene: Scene;
    private readonly vim: VimEngine;
    private readonly gameState: GameState;
    private readonly gutterWidth: number;
    private readonly fontWidth: number;
    private readonly fontHeight: number;
    private readonly clipboardSystem: ClipboardSystem;
    private towers: Map<string, Tower> = new Map();
    private towerPatterns: Map<string, {type: string, startCol: number, startRow: number}> = new Map();

    public onTowerDestroyed?: (col: number, row: number) => void;

    constructor(scene: Scene, vim: VimEngine, gutterWidth: number, fontWidth: number, fontHeight: number, gameState: GameState) {
        this.scene = scene;
        this.vim = vim;
        this.gameState = gameState;
        this.gutterWidth = gutterWidth;
        this.fontWidth = fontWidth;
        this.fontHeight = fontHeight;
        this.clipboardSystem = new ClipboardSystem(gameState);
        this.vim.onPaste = (row: number, col: number, index: number) => this.handlePaste(row, col, index);
        this.vim.onYank = (pattern: string[]) => {
            if (this.clipboardSystem.yankPattern(pattern)) {
                // If yank was successful, maybe play a sound or trigger a render, but Game.updateClipboardUI does it automatically.
            }
        };
        this.placeInitialTowers();
    }

    private placeInitialTowers(): void {
        for (const initial of INITIAL_TOWERS) {
            const towerType = TOWER_TYPES[initial.type];
            if (!towerType) continue;
            
            // Ensure the line exists
            while (this.vim.lines.length <= initial.row) {
                this.vim.lines.push('');
            }
            
            // Place the tower pattern
            const startCol = 10; // Start position for initial towers
            for (let i = 0; i < towerType.pattern.length; i++) {
                const patternLine = towerType.pattern[i];
                const lineIndex = initial.row + i;
                
                while (this.vim.lines.length <= lineIndex) {
                    this.vim.lines.push('');
                }
                
                const line = this.vim.lines[lineIndex];
                const newLine = line.padEnd(startCol + patternLine.length, ' ');
                this.vim.lines[lineIndex] = newLine.slice(0, startCol) + patternLine + newLine.slice(startCol + patternLine.length);
            }
            
            // Store pattern info once for the entire tower
            this.towerPatterns.set(`${startCol},${initial.row}`, {type: initial.type, startCol, startRow: initial.row});
        }
        this.scanAll();
    }

    private handlePaste(row: number, col: number, index: number): void {
        const clipboard = this.clipboardSystem.getClipboard();
        if (clipboard.length === 0) return;
        
        const entryIndex = Math.min(index, clipboard.length - 1);
        const entry = clipboard[entryIndex];

        if (entry.currentKills < this.clipboardSystem.getEntryCost(entry)) {
            // Not ready to paste yet
            return;
        }

        const towerType = entry.towerType;
        
        // Write pattern to vim.lines
        for (let i = 0; i < towerType.pattern.length; i++) {
            const patternLine = towerType.pattern[i];
            const lineIndex = row + i;
            
            while (this.vim.lines.length <= lineIndex) {
                this.vim.lines.push('');
            }
            
            const line = this.vim.lines[lineIndex];
            const newLine = line.padEnd(col + patternLine.length, ' ');
            this.vim.lines[lineIndex] = newLine.slice(0, col) + patternLine + newLine.slice(col + patternLine.length);
        }

        // Register finding once for the entire structure
        let towerId = Object.keys(TOWER_TYPES).find(key => TOWER_TYPES[key].name === towerType.name);
        if (!towerId && towerType.isWall) {
            towerId = 'wall_' + Math.random().toString(36).substr(2, 9);
            TOWER_TYPES[towerId] = towerType;
        }
        this.towerPatterns.set(`${col},${row}`, {type: towerId || 'sniper', startCol: col, startRow: row});
        
        this.clipboardSystem.useEntry(entryIndex);
        
        // Trigger generic render
        if (this.vim.onRenderAll) {
            this.vim.onRenderAll();
        }
        
        this.scanAll();
    }

    get clipboard(): ClipboardSystem {
        return this.clipboardSystem;
    }

    get activeTowers(): Tower[] {
        return Array.from(this.towers.values()).filter(t => !t.isDead);
    }

    scanRow(row: number): void {
        const line = this.vim.lines[row] ?? '';
        const beforeCount = this.activeTowers.length;
        
        // Find all tower patterns that include this row
        const patternsInRow = Array.from(this.towerPatterns.entries())
            .filter(([_key, pattern]) => {
                const patternInfo = TOWER_TYPES[pattern.type];
                return row >= pattern.startRow && row < pattern.startRow + patternInfo.pattern.length;
            });
        
        if (patternsInRow.length === 0) {
            // Remove any towers on rows without patterns
            for (const [key, tower] of this.towers) {
                if (tower.row === row) {
                    tower.destroy();
                    this.towers.delete(key);
                }
            }
            return;
        }
        
        // Process each pattern that includes this row
        for (const [key, patternInfo] of patternsInRow) {
            const towerType = TOWER_TYPES[patternInfo.type];
            if (!towerType) continue;
            
            const relativeRow = row - patternInfo.startRow;
            const patternLine = towerType.pattern[relativeRow];
            
            let mismatched = false;
            for (let col = 0; col < patternLine.length; col++) {
                const worldCol = patternInfo.startCol + col;
                if (line[worldCol] !== patternLine[col]) {
                    mismatched = true;
                    break;
                }
            }

            if (mismatched) {
                // Remove the tower and pattern if it got destroyed
                if (this.towers.has(key)) {
                    this.towers.get(key)!.destroy();
                    this.towers.delete(key);
                }
                this.towerPatterns.delete(key);
            } else if (!this.towers.has(key)) {
                // Match is valid, instantiate exactly one Tower object per pattern centered
                const centerCol = patternInfo.startCol + Math.floor(patternLine.length / 2);
                const centerRow = patternInfo.startRow + Math.floor(towerType.pattern.length / 2);
                const wx = this.gutterWidth + centerCol * this.fontWidth + this.fontWidth / 2;
                const wy = centerRow * this.fontHeight + this.fontHeight / 2;
                
                this.towers.set(key, new Tower(this.scene, centerCol, centerRow, wx, wy, towerType, this.fontWidth * patternLine.length, this.fontHeight * towerType.pattern.length));
            }
        }
        
        const afterCount = this.activeTowers.length;
        if (beforeCount !== afterCount) {
            this.gameState.setTowerCount(afterCount);
        }
    }

    scanAll(): void {
        for (let r = 0; r < this.vim.lines.length; r++) this.scanRow(r);
    }

    towerTakeDamage(tower: Tower, amount: number): void {
        const died = tower.takeDamage(amount);
        if (died) {
            let actualKey = '';
            for (const [k, t] of this.towers.entries()) {
                if (t === tower) {
                    actualKey = k;
                    break;
                }
            }
            if (actualKey) {
                const patternInfo = this.towerPatterns.get(actualKey);
                if (patternInfo) {
                    const towerType = TOWER_TYPES[patternInfo.type];
                    if (towerType) {
                        for (let i = 0; i < towerType.pattern.length; i++) {
                            const lineIndex = patternInfo.startRow + i;
                            if (lineIndex < this.vim.lines.length) {
                                let line = this.vim.lines[lineIndex];
                                const start = patternInfo.startCol;
                                const end = start + towerType.pattern[i].length;
                                this.vim.lines[lineIndex] = line.slice(0, start) + ' '.repeat(end - start) + line.slice(end);
                                this.vim.onRenderRow?.(lineIndex);
                            }
                        }
                    }
                }
                this.towers.delete(actualKey);
                this.towerPatterns.delete(actualKey);
            }
            tower.destroy();
            this.gameState.setTowerCount(this.activeTowers.length);
            this.onTowerDestroyed?.(tower.col, tower.row);
        }
    }

    update(delta: number): void {
        for (const t of this.towers.values()) t.tickCooldown(delta);
    }

    destroy(): void {
        for (const t of this.towers.values()) t.destroy();
        this.towers.clear();
    }
}
