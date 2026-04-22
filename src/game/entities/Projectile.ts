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
    private traveled: number = 0;
    private visual: GameObjects.Rectangle;

    constructor(
        scene: Scene,
        x: number, y: number,
        targetX: number, targetY: number,
        speed: number,
        damage: number,
        range: number,
    ) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.maxRange = range;

        const angle = Math.atan2(targetY - y, targetX - x);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.visual = scene.add.rectangle(x, y, 6, 6, 0xffee44);
        this.visual.setDepth(25);
    }

    update(delta: number, enemies: Enemy[]): Enemy | null {
        if (this.isDead) return null;
        const dt = delta / 1000;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.traveled += Math.hypot(this.vx, this.vy) * dt;
        this.visual.setPosition(this.x, this.y);

        if (this.traveled >= this.maxRange) { this.die(); return null; }

        for (const e of enemies) {
            if (e.isDead || e.hasExited) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) < 12) {
                e.takeDamage(this.damage);
                this.die();
                return e;
            }
        }
        return null;
    }

    private die(): void {
        this.isDead = true;
        this.visual.destroy();
    }

    destroy(): void {
        if (!this.isDead) this.die();
    }
}
