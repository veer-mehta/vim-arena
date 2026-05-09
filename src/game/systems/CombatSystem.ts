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
        // Cast through any to access private vim/gutter/font fields on TowerSystem
        const ts = this.towerSystem as any;
        const vim = ts.vim;

        // Character-collision: enemies chip away at buffer text and take minor damage
        if (vim?.lines) {
            for (const e of enemies) {
                if (e.isDead || e.hasExited) continue;
                const col = Math.floor((e.x - ts.gutterWidth) / ts.fontWidth);
                const row = Math.floor(e.y / ts.fontHeight);
                if (row >= 0 && row < vim.lines.length) {
                    const line: string = vim.lines[row];
                        // Check a 3x3 area around the enemy center to make collision more reliable
                        const checkCols = [col, Math.floor((e.x - 5 - ts.gutterWidth) / ts.fontWidth), Math.floor((e.x + 5 - ts.gutterWidth) / ts.fontWidth)];
                        const checkRows = [row, Math.floor((e.y - 5) / ts.fontHeight), Math.floor((e.y + 5) / ts.fontHeight)];
                        
                        let hit = false;
                        for (const r of new Set(checkRows)) {
                            if (r < 0 || r >= vim.lines.length) continue;
                            const curLine = vim.lines[r];
                            for (const c of new Set(checkCols)) {
                                if (c < 0 || c >= curLine.length || curLine[c] === ' ') continue;
                                if (this.towerSystem.isPartOfTower(c, r)) continue;
                                if (vim.isBackground(r, c)) continue;
                                
                                const wasAlive = !e.isDead;
                                e.takeDamage(1); // Increase damage to 1 so it's visible and effective
                                vim.lines[r] = curLine.substring(0, c) + ' ' + curLine.substring(c + 1);
                                vim.onRenderRow?.(r);
                                if (wasAlive && e.isDead) {
                                    this.gameState.addKill();
                                    this.towerSystem.clipboard.onEnemyKilled();
                                }
                                hit = true;
                                break;
                            }
                            if (hit) break;
                        }

                }
            }
        }

        // Towers fire at enemies
        for (const tower of towers) {
            if (!tower.canFire() || tower.type.damage <= 0) continue;

            if (tower.type.isAoe) {
                let fired = false;
                for (const e of enemies) {
                    if (e.isDead || e.hasExited) continue;
                    if (Math.hypot(e.x - tower.worldX, e.y - tower.worldY) <= tower.type.range) {
                        e.takeDamage(tower.type.damage);
                        if (e.isDead) { this.gameState.addKill(); this.towerSystem.clipboard.onEnemyKilled(); }
                        fired = true;
                    }
                }
                if (fired) {
                    tower.resetFireCooldown();
                    const circle = this.scene.add.circle(tower.worldX, tower.worldY, tower.type.range, tower.type.color, 0.3).setDepth(15);
                    this.scene.tweens.add({ targets: circle, alpha: 0, duration: 300, onComplete: () => circle.destroy() });
                }
                continue;
            }

            // Single-target: find nearest in range with predictive lead
            let nearest: Enemy | null = null;
            let nearestDist = Infinity;
            for (const e of enemies) {
                if (e.isDead || e.hasExited) continue;
                const d = Math.hypot(e.x - tower.worldX, e.y - tower.worldY);
                if (d <= tower.type.range && d < nearestDist) { nearestDist = d; nearest = e; }
            }
            if (nearest) {
                tower.resetFireCooldown();
                const dx = nearest.targetX - nearest.x;
                const dy = nearest.targetY - nearest.y;
                const distToTarget = Math.hypot(dx, dy);
                let px = nearest.x, py = nearest.y;
                if (distToTarget > 0) {
                    const t = nearestDist / tower.type.projectileSpeed;
                    px += (dx / distToTarget) * nearest.speed * t;
                    py += (dy / distToTarget) * nearest.speed * t;
                }
                this.projectiles.push(new Projectile(this.scene, tower.worldX, tower.worldY, px, py, tower.type.projectileSpeed, tower.type.damage, tower.type.range));
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const hit = this.projectiles[i].update(delta, enemies);
            if (hit?.isDead) { this.gameState.addKill(); this.towerSystem.clipboard.onEnemyKilled(); }
            if (this.projectiles[i].isDead) this.projectiles.splice(i, 1);
        }

        // Collision: enemies attack the nearest tower they touch and are destroyed
        for (const e of enemies) {
            if (e.isDead || e.hasExited) continue;
            for (const tower of towers) {
                if (tower.isDead) continue;
                if (Math.hypot(e.x - tower.worldX, e.y - tower.worldY) <= MELEE_RANGE) {
                    // Deal damage to tower
                    this.towerSystem.towerTakeDamage(tower, e.attackDamage);
                    
                    // Kill the enemy on impact
                    const wasAlive = !e.isDead;
                    e.takeDamage(e.hp + 1); // Ensure it dies
                    if (wasAlive && e.isDead) {
                        this.gameState.addKill();
                        this.towerSystem.clipboard.onEnemyKilled();
                    }
                    
                    // Break so this enemy doesn't hit multiple towers in one frame
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
