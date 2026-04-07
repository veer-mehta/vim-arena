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

        // Towers fire at nearest in-range enemy with predictive targeting
        for (const tower of towers) {
            if (!tower.canFire()) continue;
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
