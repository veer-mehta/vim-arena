import { Scene, GameObjects } from 'phaser';

export type EnemyDirection = 'left' | 'right' | 'up' | 'down';

const CHARS = ['/', '#', '@', '!', '*'];

export class Enemy {
    public x: number;
    public y: number;
    public readonly speed: number;
    public hp: number;
    public readonly maxHp: number;
    public readonly attackDamage: number = 1;
    public attackCooldown: number = 0;
    public isDead: boolean = false;
    public hasExited: boolean = false;
    public targetX: number;
    public targetY: number;

    private body: GameObjects.Text;
    private scene: Scene;
    private glitchTimer: number = 0;
    private pulseTimer: number = 0;

    constructor(scene: Scene, x: number, y: number, speed: number, maxHp: number = 1, color: number = 0xbf616a, private fontWidth: number = 10, private fontHeight: number = 20, private gutterWidth: number = 50) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.targetX = x;
        this.targetY = y;

        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        this.body = scene.add.text(x, y, char, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffffff', // White text
            backgroundColor: '#b32d2d', // Dull Red
            padding: { x: 3, y: 3 }
        }).setOrigin(0.5).setDepth(20);
    }

    setTarget(x: number, y: number): void {
        this.targetX = x;
        this.targetY = y;
    }

    takeDamage(amount: number): boolean {
        if (this.isDead) return true;
        this.hp = Math.max(0, this.hp - amount);

        this.scene.tweens.add({ targets: this.body, alpha: 0.2, duration: 50, yoyo: true });

        if (amount >= 1) {
            const popup = this.scene.add.text(this.x, this.y - 10, `-${Math.floor(amount)}`, {
                fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#000000', backgroundColor: '#e6b800', padding: { x: 2, y: 2 }
            }).setOrigin(0.5).setDepth(100);
            this.scene.tweens.add({ targets: popup, y: this.y - 30, alpha: 0, duration: 800, onComplete: () => popup.destroy() });
        }

        if (this.hp <= 0) {
            this.isDead = true;
            this.body.destroy();
        }
        return this.isDead;
    }

    update(delta: number): void {
        if (this.isDead || this.hasExited) return;
        const dt = delta / 1000;
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 15) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        if (this.attackCooldown > 0) this.attackCooldown -= delta;

        // Pulse scale
        this.pulseTimer += dt * 10;
        const scale = 1 + Math.sin(this.pulseTimer) * 0.15;
        this.body.setScale(scale);

        // Target grid position
        const col = Math.floor((this.x - this.gutterWidth) / this.fontWidth);
        const row = Math.floor(this.y / this.fontHeight);
        const targetGX = this.gutterWidth + col * this.fontWidth + this.fontWidth / 2;
        const targetGY = row * this.fontHeight + this.fontHeight / 2;
        
        // Fast interpolation + random jitter for "buggy" look
        const lerpFactor = 1 - Math.pow(0.00000001, dt); 
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        this.body.x += (targetGX - this.body.x) * lerpFactor + jitterX;
        this.body.y += (targetGY - this.body.y) * lerpFactor + jitterY;
    }

    destroy(): void {
        if (!this.isDead) this.body.destroy();
    }
}
