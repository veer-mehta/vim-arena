import { Scene, GameObjects } from 'phaser';

export type EnemyDirection = 'left' | 'right' | 'up' | 'down';

const SIZE = 14;

export class Enemy {
    public x: number;
    public y: number;
    public readonly speed: number;
    public hp: number = 1;
    public readonly maxHp: number = 1;
    public readonly attackDamage: number = 1;
    public attackCooldown: number = 0;
    public isDead: boolean = false;
    public hasExited: boolean = false;
    public targetX: number;
    public targetY: number;

    private body: GameObjects.Rectangle;

    constructor(scene: Scene, x: number, y: number, speed: number) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.targetX = x;
        this.targetY = y;

        this.body = scene.add.rectangle(x, y, SIZE, SIZE, 0xee3333);
        this.body.setDepth(20);
    }

    setTarget(x: number, y: number): void {
        this.targetX = x;
        this.targetY = y;
    }

    takeDamage(amount: number): boolean {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp <= 0) { 
            this.isDead = true; 
            this.body.destroy();
        }
        return this.isDead;
    }

    update(delta: number): void {
        if (this.isDead || this.hasExited) return;
        const dt = delta / 1000;
        
        // Move towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance > 5) {
            const vx = (dx / distance) * this.speed;
            const vy = (dy / distance) * this.speed;
            this.x += vx * dt;
            this.y += vy * dt;
        }
        
        if (this.attackCooldown > 0) this.attackCooldown -= delta;

        this.body.setPosition(this.x, this.y);
    }

    destroy(): void {
        this.body.destroy();
    }
}
