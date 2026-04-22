import { Scene } from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { GameState } from '../GameState';
import { TowerSystem } from './TowerSystem';

const MELEE_RANGE = 36;

export class CombatSystem {
    private readonly scene: Scene;
    private readonly gameState: GameState;
    private readonly towerSystem: TowerSystem;
    private projectiles: Projectile[] = [];

    constructor(scene: Scene, gameState: GameState, towerSystem: TowerSystem) {
        this.scene = scene;
        this.gameState = gameState;
        this.towerSystem = towerSystem;
    }

    update(delta: number, enemies: Enemy[]): void {
        const towers = this.towerSystem.activeTowers;
        const vim = (this.towerSystem as any).vim as any; // Access VimEngine

        // 1. Character-based collisions (Every typed char is a tiny wall)
        if (vim && vim.lines) {
            for (const e of enemies) {
                if (e.isDead || e.hasExited) continue;
                
                // Convert world coords to grid coords
                const charCol = Math.floor((e.x - (this.towerSystem as any).gutterWidth) / (this.towerSystem as any).fontWidth);
                const charRow = Math.floor(e.y / (this.towerSystem as any).fontHeight);
                
                if (charRow >= 0 && charRow < vim.lines.length) {
                    const line = vim.lines[charRow];
                    if (charCol >= 0 && charCol < line.length && line[charCol] !== ' ') {
                        // Found a character! Treat it as a tiny barrier
                        e.takeDamage(0.5); // Enemies take minor damage from hitting code
                        
                        // Delete the character (the enemy 'eats' it)
                        const newLine = line.substring(0, charCol) + ' ' + line.substring(charCol + 1);
                        vim.lines[charRow] = newLine;
                        
                        // Trigger re-render of that row
                        if (vim.onRenderRow) vim.onRenderRow(charRow);
                        
                        if (e.isDead) {
                            this.gameState.addKill();
                            this.towerSystem.clipboard.onEnemyKilled();
                        }
                    }
                }
            }
        }

        // 2. Towers fire at nearest in-range enemy...

        // Towers fire at nearest in-range enemy with predictive targeting
        for (const tower of towers) {
            if (!tower.canFire() || tower.type.damage <= 0) continue;

            if (tower.type.isAoe) {
                let didFire = false;
                for (const e of enemies) {
                    if (e.isDead || e.hasExited) continue;
                    const d = Math.hypot(e.x - tower.worldX, e.y - tower.worldY);
                    if (d <= tower.type.range) {
                        e.takeDamage(tower.type.damage);
                        if (e.isDead) {
                            this.gameState.addKill();
                            this.towerSystem.clipboard.onEnemyKilled();
                        }
                        didFire = true;
                    }
                }
                
                if (didFire) {
                    tower.resetFireCooldown();
                    const circle = this.scene.add.circle(tower.worldX, tower.worldY, tower.type.range, tower.type.color, 0.3);
                    circle.setDepth(15);
                    this.scene.tweens.add({
                        targets: circle,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => circle.destroy()
                    });
                }
                continue;
            }

            let nearest: Enemy | null = null;
            let nearestDist = Infinity;
            for (const e of enemies) {
                if (e.isDead || e.hasExited) continue;
                const d = Math.hypot(e.x - tower.worldX, e.y - tower.worldY);
                if (d <= tower.type.range && d < nearestDist) { 
                    nearestDist = d; 
                    nearest = e; 
                }
            }
            if (nearest) {
                tower.resetFireCooldown();
                
                // Correct predictive targeting using actual velocity
                const dx = nearest.targetX - nearest.x;
                const dy = nearest.targetY - nearest.y;
                const distToTarget = Math.hypot(dx, dy);
                let predictedX = nearest.x;
                let predictedY = nearest.y;

                if (distToTarget > 0) {
                    const vx = (dx / distToTarget) * nearest.speed;
                    const vy = (dy / distToTarget) * nearest.speed;
                    const travelTime = nearestDist / tower.type.projectileSpeed;
                    
                    predictedX += vx * travelTime;
                    predictedY += vy * travelTime;
                }
                
                this.projectiles.push(new Projectile(
                    this.scene,
                    tower.worldX, tower.worldY,
                    predictedX, predictedY,
                    tower.type.projectileSpeed,
                    tower.type.damage,
                    tower.type.range,
                ));
            }
        }

        // Move projectiles, check hits
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const hit = p.update(delta, enemies);
            if (hit?.isDead) {
                this.gameState.addKill();
                this.towerSystem.clipboard.onEnemyKilled();
            }
            if (p.isDead) this.projectiles.splice(i, 1);
        }

        // Enemies melee attack nearest tower (kamikaze action)
        for (const e of enemies) {
            if (e.isDead || e.hasExited) continue;
            for (const tower of towers) {
                if (Math.hypot(e.x - tower.worldX, e.y - tower.worldY) <= MELEE_RANGE) {
                    this.towerSystem.towerTakeDamage(tower, e.attackDamage);
                    e.takeDamage(e.maxHp); // Enemy perishes after dealing 1 damage
                    break;
                }
            }
        }
    }

    destroy(): void {
        for (const p of this.projectiles) p.destroy();
        this.projectiles = [];
    }
}
