import { VimEngine } from '../vim/VimEngine';
import { Enemy } from '../entities/Enemy';

export class WallSystem {
    private readonly gutterWidth: number;
    private readonly fontWidth: number;
    private readonly fontHeight: number;
    public towerCells: Set<string> = new Set();

    constructor(gutterWidth: number, fontWidth: number, fontHeight: number) {
        this.gutterWidth = gutterWidth;
        this.fontWidth = fontWidth;
        this.fontHeight = fontHeight;
    }

    checkCollisions(enemies: Enemy[], vim: VimEngine): void {
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const col = Math.floor((enemy.x - this.gutterWidth) / this.fontWidth);
            const row = Math.floor(enemy.y / this.fontHeight);
            if (col < 0 || row < 0 || row >= vim.lines.length) continue;
            const char = (vim.lines[row] ?? '')[col];
            if (!char || char === ' ') continue;
            if (this.towerCells.has(`${col},${row}`)) continue;
            enemy.isDead = true;
            vim.setChar(col, row, ' ');
        }
    }
}
