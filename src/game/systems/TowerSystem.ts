import { Scene } from 'phaser';
import { Tower } from '../entities/Tower';
import { TOWER_TYPES } from '../entities/TowerTypes';
import { VimEngine } from '../vim/VimEngine';
import { ClipboardSystem } from './ClipboardSystem';
import { GameState } from '../GameState';

// Initial predefined tower placements
const INITIAL_TOWERS: Array<{row: number, type: string}> = [
    {row: 5, type: 'sniper'},
    {row: 15, type: 'pulse'},
    {row: 25, type: 'rapid'},
];

export class TowerSystem {
    private readonly scene: Scene;
    private readonly vim: VimEngine;
    private readonly gameState: GameState;
    private readonly gutterWidth: number;
    private readonly fontWidth: number;
    private readonly fontHeight: number;
    private readonly clipboardSystem: ClipboardSystem;
    private readonly centerCol: number;
    private towers: Map<string, Tower> = new Map();
    private towerPatterns: Map<string, {type: string, startCol: number, startRow: number}> = new Map();

    public onTowerDestroyed?: (col: number, row: number) => void;

    constructor(scene: Scene, vim: VimEngine, gutterWidth: number, fontWidth: number, fontHeight: number, gameState: GameState, centerCol: number = 35) {
        this.scene = scene;
        this.vim = vim;
        this.gameState = gameState;
        this.gutterWidth = gutterWidth;
        this.fontWidth = fontWidth;
        this.fontHeight = fontHeight;
        this.centerCol = centerCol;
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
            const startCol = this.centerCol; // Dynamic center position
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
        const shootingTowers = this.activeTowers.filter(t => !t.type.isWall && t.type.damage > 0);
        this.gameState.setTowerCount(shootingTowers.length);
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
        const lines = this.vim.lines;
        const beforeCount = this.activeTowers.length;
        
        // 1. Clean up existing towers on this row that no longer match their patterns
        for (const [key, tower] of this.towers.entries()) {
            const patternInfo = this.towerPatterns.get(key);
            if (patternInfo && row >= patternInfo.startRow && row < patternInfo.startRow + TOWER_TYPES[patternInfo.type].pattern.length) {
                const towerType = TOWER_TYPES[patternInfo.type];
                const relRow = row - patternInfo.startRow;
                const patternLine = towerType.pattern[relRow];
                const bufferLine = lines[row] || '';
                
                let mismatched = false;
                for (let c = 0; c < patternLine.length; c++) {
                    if (bufferLine[patternInfo.startCol + c] !== patternLine[c]) {
                        mismatched = true;
                        break;
                    }
                }
                
                if (mismatched) {
                    tower.destroy();
                    this.towers.delete(key);
                    this.towerPatterns.delete(key);
                }
            }
        }

        // 2. Search for NEW patterns starting on this row
        const currentLine = lines[row] || '';
        for (const [typeId, towerType] of Object.entries(TOWER_TYPES)) {
            const firstLine = towerType.pattern[0];
            let startSearch = 0;
            
            while (true) {
                const foundCol = currentLine.indexOf(firstLine, startSearch);
                if (foundCol === -1) break;
                
                // Potential match found, check other lines
                let fullMatch = true;
                for (let r = 1; r < towerType.pattern.length; r++) {
                    const nextLine = lines[row + r] || '';
                    const expectedPattern = towerType.pattern[r];
                    
                    for (let c = 0; c < expectedPattern.length; c++) {
                        if (nextLine[foundCol + c] !== expectedPattern[c]) {
                            fullMatch = false;
                            break;
                        }
                    }
                    if (!fullMatch) break;
                }
                
                if (fullMatch) {
                    const key = `${foundCol},${row}`;
                    // Only create if it doesn't exist
                    if (!this.towers.has(key)) {
                        const centerCol = foundCol + Math.floor(firstLine.length / 2);
                        const centerRow = row + Math.floor(towerType.pattern.length / 2);
                        const wx = this.gutterWidth + centerCol * this.fontWidth + this.fontWidth / 2;
                        const wy = centerRow * this.fontHeight + this.fontHeight / 2;
                        
                        this.towerPatterns.set(key, {type: typeId, startCol: foundCol, startRow: row});
                        this.towers.set(key, new Tower(
                            this.scene, 
                            centerCol, centerRow, 
                            wx, wy, 
                            towerType, 
                            this.fontWidth * firstLine.length, 
                            this.fontHeight * towerType.pattern.length
                        ));
                    }
                }
                
                startSearch = foundCol + 1;
            }
        }
        
        const afterCount = this.activeTowers.filter(t => !t.type.isWall && t.type.damage > 0).length;
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
            const shootingTowers = this.activeTowers.filter(t => !t.type.isWall && t.type.damage > 0);
            this.gameState.setTowerCount(shootingTowers.length);
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
