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
	public readonly label: string | null = null;
	public frozen: boolean = false;

	private body: GameObjects.Text;
	private scene: Scene;
	private lastPopupTime: number = 0;

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
			color: '#ffffff',
			backgroundColor: '#b32d2d',
			padding: { x: 3, y: 3 }
		}).setOrigin(0.5).setDepth(20);

		if (Math.random() < 0.3) {
			this.label = String.fromCharCode(97 + Math.floor(Math.random() * 26));
			const labelText = scene.add.text(0, -15, this.label, {
				fontFamily: '"Press Start 2P", monospace',
				fontSize: '10px',
				color: '#ffff00',
				backgroundColor: '#000000'
			}).setOrigin(0.5);
			(this.body as any).labelChild = labelText;
		}
	}

	setTarget(x: number, y: number): void {
		this.targetX = x;
		this.targetY = y;
	}

	forceLabel(char: string): void {
		// Remove existing label if any
		if ((this.body as any).labelChild) {
			(this.body as any).labelChild.destroy();
		}
		(this as any).label = char;
		const labelText = this.scene.add.text(this.body.x, this.body.y - 20, char, {
			fontFamily: '"Press Start 2P", monospace',
			fontSize: '10px',
			color: '#ffff00',
			backgroundColor: '#000000'
		}).setOrigin(0.5);
		(this.body as any).labelChild = labelText;
	}

	takeDamage(amount: number): boolean {
		if (this.isDead) return true;
		this.hp = Math.max(0, this.hp - amount);

		this.scene.tweens.add({ targets: this.body, alpha: 0.2, duration: 50, yoyo: true });

		const now = this.scene.time.now;
		if (amount >= 1 && now - this.lastPopupTime > 500) {
			this.lastPopupTime = now;
			const popup = this.scene.add.text(this.x, this.y - 10, `-${Math.floor(amount)}`, {
				fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#000000', backgroundColor: '#e6b800', padding: { x: 2, y: 2 }
			}).setOrigin(0.5).setDepth(100);
			this.scene.tweens.add({ targets: popup, y: this.y - 30, alpha: 0, duration: 800, onComplete: () => popup.destroy() });
		}

		if (this.hp <= 0) {
			this.isDead = true;
			if ((this.body as any).labelChild) (this.body as any).labelChild.destroy();
			this.body.destroy();
		}
		return this.isDead;
	}

	update(delta: number): void {
		if (this.isDead || this.hasExited) return;
		if (this.frozen) {
			// Still update visual position but don't move
			if ((this.body as any).labelChild) {
				(this.body as any).labelChild.x = this.body.x;
				(this.body as any).labelChild.y = this.body.y - 20;
			}
			return;
		}
		const dt = delta / 1000;
		const dx = this.targetX - this.x;
		const dy = this.targetY - this.y;
		const dist = Math.hypot(dx, dy);

		if (dist > 15) {
			this.x += (dx / dist) * this.speed * dt;
			this.y += (dy / dist) * this.speed * dt;
		}

		if (this.attackCooldown > 0) this.attackCooldown -= delta;


		// Target grid position
		const col = Math.floor((this.x - this.gutterWidth) / this.fontWidth);
		const row = Math.floor(this.y / this.fontHeight);
		const targetGX = this.gutterWidth + col * this.fontWidth + this.fontWidth / 2;
		const targetGY = row * this.fontHeight + this.fontHeight / 2;

		// Fast interpolation for "buggy" look
		const lerpFactor = 1 - Math.pow(0.00000001, dt);
		this.body.x += (targetGX - this.body.x) * lerpFactor;
		this.body.y += (targetGY - this.body.y) * lerpFactor;

		if ((this.body as any).labelChild) {
			(this.body as any).labelChild.x = this.body.x;
			(this.body as any).labelChild.y = this.body.y - 20;
		}
	}

	destroy(): void {
		if (!this.isDead) {
			if ((this.body as any).labelChild) (this.body as any).labelChild.destroy();
			this.body.destroy();
		}
	}
}
