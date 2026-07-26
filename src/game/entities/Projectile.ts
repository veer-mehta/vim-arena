import { Scene, GameObjects } from 'phaser';
import { Enemy } from './Enemy';

export class Projectile {
    public x: number;
    public y: number;
    public isDead: boolean = false;

    private vx: number;
    private vy: number;
    private readonly damage: number;
    private readonly maxRange: number;
    private readonly explosionRadius: number;
    private readonly onEnemyKilled: () => void;
    private traveled: number = 0;
    private visual: GameObjects.Rectangle;
    private scene: Scene;

    constructor(
        scene: Scene,
        x: number,
        y: number,
        targetX: number,
        targetY: number,
        speed: number,
        damage: number,
        range: number,
        onEnemyKilled: () => void,
        explosionRadius: number = 0
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.maxRange = range;
        this.onEnemyKilled = onEnemyKilled;
        this.explosionRadius = explosionRadius;

        const angle = Math.atan2(targetY - y, targetX - x);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        const color = explosionRadius > 0 ? 0xff5533 : 0xffee44;
        const size = explosionRadius > 0 ? 10 : 6;
        this.visual = scene.add.rectangle(x, y, size, size, color).setDepth(25);
    }

    update(delta: number, enemies: Enemy[]): void {
        if (this.isDead) return;
        const dt = delta / 1000;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.traveled += Math.hypot(this.vx, this.vy) * dt;
        this.visual.setPosition(this.x, this.y);

        if (this.traveled >= this.maxRange) {
            this.explode(enemies);
            return;
        }

        for (const e of enemies) {
            if (e.isDead || e.hasExited) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) < 12) {
                this.explode(enemies);
                return;
            }
        }
    }

    private explode(enemies: Enemy[]): void {
        this.isDead = true;
        this.visual.destroy();

        if (this.explosionRadius > 0) {
            const circle = this.scene.add.circle(this.x, this.y, this.explosionRadius, 0xff5533, 0.4).setDepth(20);
            this.scene.tweens.add({
                targets: circle,
                alpha: 0,
                radius: this.explosionRadius * 1.2,
                duration: 250,
                onComplete: () => circle.destroy()
            });

            for (const e of enemies) {
                if (e.isDead || e.hasExited) continue;
                if (Math.hypot(e.x - this.x, e.y - this.y) <= this.explosionRadius) {
                    const wasAlive = !e.isDead;
                    e.takeDamage(this.damage);
                    if (wasAlive && e.isDead) {
                        this.onEnemyKilled();
                    }
                }
            }
        } else {
            for (const e of enemies) {
                if (e.isDead || e.hasExited) continue;
                if (Math.hypot(e.x - this.x, e.y - this.y) < 12) {
                    const wasAlive = !e.isDead;
                    e.takeDamage(this.damage);
                    if (wasAlive && e.isDead) {
                        this.onEnemyKilled();
                    }
                    break;
                }
            }
        }
    }

    destroy(): void {
        if (!this.isDead) {
            this.isDead = true;
            this.visual.destroy();
        }
    }
}
