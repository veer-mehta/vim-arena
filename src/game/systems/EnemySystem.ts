import { Scene } from 'phaser';
import { Enemy } from '../entities/Enemy';
import { GameState } from '../GameState';
import { Tower } from '../entities/Tower';

export class EnemySystem {
    private readonly scene: Scene;
    private readonly gameState: GameState;
    private readonly gutterWidth: number;
    private readonly fontWidth: number;
    private readonly fontHeight: number;

    private enemies: Enemy[] = [];
    private spawnTimer: number = 0;
    private getTowers: () => Tower[] = () => [];

    constructor(scene: Scene, gameState: GameState, gutterWidth: number, fontWidth: number, fontHeight: number) {
        this.scene = scene;
        this.gameState = gameState;
        this.gutterWidth = gutterWidth;
        this.fontWidth = fontWidth;
        this.fontHeight = fontHeight;
    }

    setTowerProvider(fn: () => Tower[]): void {
        this.getTowers = fn;
    }

    get activeEnemies(): Enemy[] { return this.enemies; }

    update(delta: number, scrollX: number, scrollY: number, vpW: number, vpH: number): void {
        const diff = this.gameState.difficulty;

        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = Math.max(400, 3000 / diff);
            this.spawnEnemy(scrollX, scrollY, vpW, vpH, diff);
        }

        for (const e of this.enemies) e.update(delta);

        // Point each enemy toward the nearest non-wall combat tower
        const towers = this.getTowers();
        if (towers.length > 0) {
            for (const e of this.enemies) {
                const nearest = this.findNearestTower(e, towers);
                if (nearest) e.setTarget(nearest.worldX, nearest.worldY);
            }
        }

        // Sweep dead / exited enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.isDead || e.hasExited) {
                e.destroy();
                this.enemies.splice(i, 1);
            }
        }
    }

    private findNearestTower(enemy: Enemy, towers: Tower[]): Tower | null {
        let nearest: Tower | null = null;
        let nearestDist = Infinity;
        for (const t of towers) {
            if (t.isDead || t.type.isWall) continue;
            const d = Math.hypot(enemy.x - t.worldX, enemy.y - t.worldY);
            if (d < nearestDist) { nearestDist = d; nearest = t; }
        }
        return nearest;
    }

    private spawnEnemy(scrollX: number, scrollY: number, vpW: number, vpH: number, diff: number): void {
        const margin = 40;
        const cols = Math.max(1, Math.floor((vpW - this.gutterWidth) / this.fontWidth));
        const rows = Math.max(1, Math.floor(vpH / this.fontHeight));
        const rndColX = () => scrollX + this.gutterWidth + Math.floor(Math.random() * cols) * this.fontWidth + this.fontWidth / 2;
        const rndRowY = () => scrollY + Math.floor(Math.random() * rows) * this.fontHeight + this.fontHeight / 2;

        let x = 0, y = 0;
        switch (Math.floor(Math.random() * 4)) {
            case 0: x = scrollX + this.gutterWidth - margin; y = rndRowY(); break; // left
            case 1: x = scrollX + vpW + margin;               y = rndRowY(); break; // right
            case 2: x = rndColX(); y = scrollY - margin;                     break; // top
            case 3: x = rndColX(); y = scrollY + vpH + margin;               break; // bottom
        }

        const baseSpeed = 90 * Math.sqrt(diff);
        let speed = baseSpeed;
        let hp = 1 + Math.floor((diff - 1) * 2);
        let color = 0xbf616a;

        const r = Math.random();
        if (diff > 1.5 && r < 0.25) {
            speed = baseSpeed * 1.8; hp = Math.max(1, Math.floor(hp * 0.5)); color = 0xa3be8c;
        } else if (diff > 2.0 && r > 0.75) {
            speed = baseSpeed * 0.4; hp = Math.max(3, hp * 3);               color = 0x81a1c1;
        }

        this.enemies.push(new Enemy(this.scene, x, y, speed, hp, color, this.fontWidth, this.fontHeight, this.gutterWidth));
    }

    destroy(): void {
        for (const e of this.enemies) e.destroy();
        this.enemies = [];
    }
}
