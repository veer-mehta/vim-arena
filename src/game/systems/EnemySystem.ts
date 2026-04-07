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

    public onEnemyExited?: () => void;

    constructor(
        scene: Scene,
        gameState: GameState,
        gutterWidth: number,
        fontWidth: number,
        fontHeight: number,
    ) {
        this.scene = scene;
        this.gameState = gameState;
        this.gutterWidth = gutterWidth;
        this.fontWidth = fontWidth;
        this.fontHeight = fontHeight;
    }

    setTowerProvider(getTowers: () => Tower[]): void {
        this.getTowers = getTowers;
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
        
        // Update targets for all enemies
        const towers = this.getTowers();
        for (const e of this.enemies) {
            if (towers.length > 0) {
                const nearestTower = this.findNearestTower(e, towers);
                if (nearestTower) {
                    e.setTarget(nearestTower.worldX, nearestTower.worldY);
                }
            }
        }
        
        // Remove dead or exited enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.isDead || e.hasExited) {
                if (!e.isDead) { this.onEnemyExited?.(); }
                e.destroy();
                this.enemies.splice(i, 1);
            }
        }
    }

    private findNearestTower(enemy: Enemy, towers: Tower[]): Tower | null {
        let nearest: Tower | null = null;
        let nearestDist = Infinity;
        for (const tower of towers) {
            if (tower.isDead || tower.type.isWall) continue;
            const d = Math.hypot(enemy.x - tower.worldX, enemy.y - tower.worldY);
            if (d < nearestDist) { nearestDist = d; nearest = tower; }
        }
        return nearest;
    }

    private spawnEnemy(scrollX: number, scrollY: number, vpW: number, vpH: number, diff: number): void {
        const margin = 40;
        let x = 0, y = 0;

        const cols = Math.max(1, Math.floor((vpW - this.gutterWidth) / this.fontWidth));
        const rows = Math.max(1, Math.floor(vpH / this.fontHeight));
        const rndColX = () => scrollX + this.gutterWidth + Math.floor(Math.random() * cols) * this.fontWidth + this.fontWidth / 2;
        const rndRowY = () => scrollY + Math.floor(Math.random() * rows) * this.fontHeight + this.fontHeight / 2;

        // Spawn from random edge
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { // left
            x = scrollX + this.gutterWidth - margin;
            y = rndRowY();
        } else if (edge === 1) { // right
            x = scrollX + vpW + margin;
            y = rndRowY();
        } else if (edge === 2) { // top
            x = rndColX();
            y = scrollY - margin;
        } else { // bottom
            x = rndColX();
            y = scrollY + vpH + margin;
        }

        this.enemies.push(new Enemy(
            this.scene,
            x, y,
            90 * Math.sqrt(diff)
        ));
    }

    destroy(): void {
        for (const e of this.enemies) e.destroy();
        this.enemies = [];
    }
}
