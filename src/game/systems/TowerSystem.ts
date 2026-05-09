import { Scene } from 'phaser';
import { Tower } from '../entities/Tower';
import { TowerType, TOWER_TYPES } from '../entities/TowerTypes';
import { VimEngine } from '../vim/VimEngine';
import { ClipboardSystem } from './ClipboardSystem';
import { GameState } from '../GameState';

const INITIAL_TOWERS: Array<{ row: number; type: string }> = [
    { row: 5,  type: 'sniper' },
    { row: 15, type: 'pulse'  },
    { row: 25, type: 'rapid'  },
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
    private towerPatterns: Map<string, { type: string; startCol: number; startRow: number }> = new Map();
    // Custom tower types created by paste — kept separate to avoid polluting TOWER_TYPES
    private dynamicTowerTypes: Map<string, TowerType> = new Map();

    public onTowerCreated?: (name: string, col: number, row: number) => void;
    public onTowerDestroyed?: (col: number, row: number, name?: string) => void;
    public onTowerDeletedByEdit?: (name: string, col: number, row: number) => void;

    constructor(scene: Scene, vim: VimEngine, gutterWidth: number, fontWidth: number, fontHeight: number, gameState: GameState, centerCol: number = 35) {
        this.scene = scene;
        this.vim = vim;
        this.gameState = gameState;
        this.gutterWidth = gutterWidth;
        this.fontWidth = fontWidth;
        this.fontHeight = fontHeight;
        this.centerCol = centerCol;
        this.clipboardSystem = new ClipboardSystem(gameState);
        this.vim.onPaste = (row, col, index) => this.handlePaste(row, col, index);
        this.vim.onYank = (pattern) => this.clipboardSystem.yankPattern(pattern);
        this.placeInitialTowers();
    }

    private writePatternToBuffer(startCol: number, startRow: number, pattern: string[]): void {
        for (let i = 0; i < pattern.length; i++) {
            const lineIndex = startRow + i;
            while (this.vim.lines.length <= lineIndex) this.vim.lines.push('');
            const line = this.vim.lines[lineIndex].padEnd(startCol + pattern[i].length, ' ');
            this.vim.lines[lineIndex] = line.slice(0, startCol) + pattern[i] + line.slice(startCol + pattern[i].length);
            for (let c = 0; c < pattern[i].length; c++) {
                this.vim.backgroundCells.delete(`${lineIndex},${startCol + c}`);
            }
        }
    }

    private placeInitialTowers(): void {
        for (const { row, type } of INITIAL_TOWERS) {
            const towerType = TOWER_TYPES[type];
            if (!towerType) continue;
            while (this.vim.lines.length <= row) this.vim.lines.push('');
            this.writePatternToBuffer(this.centerCol, row, towerType.pattern);
            this.towerPatterns.set(`${this.centerCol},${row}`, { type, startCol: this.centerCol, startRow: row });
        }
        this.scanAll();
        this.gameState.setTowerCount(this.countShootingTowers());
    }

    private handlePaste(row: number, col: number, index: number): void {
        const clipboard = this.clipboardSystem.getClipboard();
        if (!clipboard.length) return;
        const entryIndex = Math.min(index, clipboard.length - 1);
        if (!this.clipboardSystem.useEntry(entryIndex)) return;

        const { towerType } = clipboard[entryIndex];
        this.writePatternToBuffer(col, row, towerType.pattern);

        let towerId = Object.keys(TOWER_TYPES).find(k => TOWER_TYPES[k].name === towerType.name);
        if (!towerId) {
            towerId = `dynamic_${col}_${row}_${Date.now()}`;
            this.dynamicTowerTypes.set(towerId, towerType);
        }
        this.towerPatterns.set(`${col},${row}`, { type: towerId, startCol: col, startRow: row });
        this.vim.onRenderAll?.();
        this.scanAll();
    }

    get clipboard(): ClipboardSystem { return this.clipboardSystem; }

    get activeTowers(): Tower[] {
        return Array.from(this.towers.values()).filter(t => !t.isDead);
    }

    private getTowerTypeById(typeId: string): TowerType | undefined {
        return TOWER_TYPES[typeId] ?? this.dynamicTowerTypes.get(typeId);
    }

    /** Returns true if the buffer cell (col, row) is part of any live tower's pattern. */
    public isPartOfTower(col: number, row: number): boolean {
        for (const [key, info] of this.towerPatterns.entries()) {
            const tower = this.towers.get(key);
            if (!tower || tower.isDead) continue;
            const type = this.getTowerTypeById(info.type);
            if (!type) continue;
            if (row < info.startRow || row >= info.startRow + type.pattern.length) continue;
            const patRow = row - info.startRow;
            if (col >= info.startCol && col < info.startCol + type.pattern[patRow].length) return true;
        }
        return false;
    }

    private countShootingTowers(): number {
        return Array.from(this.towers.values()).filter(t => !t.isDead && !t.type.isWall && t.type.damage > 0).length;
    }

    scanRow(row: number): void {
        const lines = this.vim.lines;
        const shootingBefore = this.countShootingTowers();

        // Invalidate towers whose pattern no longer matches the buffer
        for (const [key, tower] of this.towers.entries()) {
            const info = this.towerPatterns.get(key);
            const towerType = info ? this.getTowerTypeById(info.type) : undefined;
            if (!info || !towerType) continue;
            if (row < info.startRow || row >= info.startRow + towerType.pattern.length) continue;

            const patternLine = towerType.pattern[row - info.startRow];
            const bufferLine = lines[row] || '';
            let mismatch = false;
            for (let c = 0; c < patternLine.length; c++) {
                if (bufferLine[info.startCol + c] !== patternLine[c]) { mismatch = true; break; }
            }
            if (mismatch) {
                this.onTowerDeletedByEdit?.(towerType.name ?? info.type, info.startCol, info.startRow);
                tower.destroy();
                this.towers.delete(key);
                this.towerPatterns.delete(key);
                this.dynamicTowerTypes.delete(info.type);
            }
        }

        // Detect new tower patterns on this row
        const currentLine = lines[row] || '';
        for (const [typeId, towerType] of Object.entries(TOWER_TYPES)) {
            const firstLine = towerType.pattern[0];
            let search = 0;
            while (true) {
                const foundCol = currentLine.indexOf(firstLine, search);
                if (foundCol === -1) break;

                let match = true;
                let hasBackgroundCell = false;
                for (let r = 0; r < towerType.pattern.length && match; r++) {
                    const nextLine = lines[row + r] || '';
                    for (let c = 0; c < towerType.pattern[r].length; c++) {
                        if (nextLine[foundCol + c] !== towerType.pattern[r][c]) { match = false; break; }
                        if (towerType.pattern[r][c] !== ' ' && this.vim.backgroundCells.has(`${row + r},${foundCol + c}`)) {
                            hasBackgroundCell = true;
                        }
                    }
                }

                const key = `${foundCol},${row}`;
                if (match && !hasBackgroundCell && !this.towers.has(key)) {
                    const cCol = foundCol + Math.floor(firstLine.length / 2);
                    const cRow = row + Math.floor(towerType.pattern.length / 2);
                    const wx = this.gutterWidth + cCol * this.fontWidth + this.fontWidth / 2;
                    const wy = cRow * this.fontHeight + this.fontHeight / 2;
                    this.towerPatterns.set(key, { type: typeId, startCol: foundCol, startRow: row });
                    this.towers.set(key, new Tower(this.scene, cCol, cRow, wx, wy, towerType, this.fontWidth * firstLine.length, this.fontHeight * towerType.pattern.length, this.gutterWidth, this.fontWidth, this.fontHeight, foundCol, row));
                    this.onTowerCreated?.(towerType.name, foundCol, row);
                }
                search = foundCol + 1;
            }
        }

        const shootingAfter = this.countShootingTowers();
        if (shootingBefore !== shootingAfter) this.gameState.setTowerCount(shootingAfter);
    }

    scanAll(): void {
        for (let r = 0; r < this.vim.lines.length; r++) this.scanRow(r);
    }

    towerTakeDamage(tower: Tower, amount: number): void {
        if (!tower.takeDamage(amount)) return;

        // Find and remove the tower from registries BEFORE touching vim.lines —
        // otherwise the onRenderRow callback triggers scanRow which sees a pattern
        // mismatch and incorrectly fires onTowerDeletedByEdit.
        let key = '';
        for (const [k, t] of this.towers.entries()) { if (t === tower) { key = k; break; } }

        if (key) {
            const info = this.towerPatterns.get(key);
            this.towers.delete(key);
            this.towerPatterns.delete(key);

            if (info) {
                const towerType = this.getTowerTypeById(info.type);
                if (towerType) {
                    for (let i = 0; i < towerType.pattern.length; i++) {
                        const li = info.startRow + i;
                        if (li < this.vim.lines.length) {
                            for (let c = 0; c < towerType.pattern[i].length; c++) {
                                if (towerType.pattern[i][c] !== ' ') {
                                    this.vim.backgroundCells.add(`${li},${info.startCol + c}`);
                                }
                            }
                            this.vim.onRenderRow?.(li);
                        }
                    }
                }
                this.dynamicTowerTypes.delete(info.type);
            }
        }

        tower.destroy();
        this.onTowerDestroyed?.(tower.col, tower.row, tower.type.name);
        this.gameState.setTowerCount(this.countShootingTowers());
    }

    update(delta: number): void {
        for (const t of this.towers.values()) t.tickCooldown(delta);
    }

    destroy(): void {
        for (const t of this.towers.values()) t.destroy();
        this.towers.clear();
    }
}
