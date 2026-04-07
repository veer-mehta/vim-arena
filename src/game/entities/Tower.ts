import { Scene, GameObjects } from 'phaser';
import { TowerType } from './TowerTypes';

export class Tower {
	public readonly col: number;
	public readonly row: number;
	public readonly worldX: number;
	public readonly worldY: number;
	public readonly type: TowerType;
	public currentHp: number;
	public fireCooldown: number = 0;
	public isDead: boolean = false;

	private hpBarBg: GameObjects.Rectangle;
	private hpBarFill: GameObjects.Rectangle;

	constructor(
		scene: Scene,
		col: number, row: number,
		worldX: number, worldY: number,
		type: TowerType,
		charW: number, charH: number,
	) {
		this.col = col;
		this.row = row;
		this.worldX = worldX;
		this.worldY = worldY;
		this.type = type;
		this.currentHp = type.maxHp;

		this.hpBarBg = scene.add.rectangle(worldX - charW / 2, worldY + charH / 2 + 1, charW, 3, 0x222222);
		this.hpBarBg.setOrigin(0, 0);
		this.hpBarBg.setDepth(30);

		this.hpBarFill = scene.add.rectangle(worldX - charW / 2, worldY + charH / 2 + 1, charW, 3, type.color);
		this.hpBarFill.setOrigin(0, 0);
		this.hpBarFill.setDepth(31);
	}

	takeDamage(amount: number): boolean {
		this.currentHp = Math.max(0, this.currentHp - amount);
		const ratio = this.currentHp / this.type.maxHp;
		this.hpBarFill.scaleX = ratio;
		if (this.currentHp <= 0) { this.isDead = true; }
		return this.isDead;
	}

	tickCooldown(delta: number): void {
		if (this.fireCooldown > 0) this.fireCooldown -= delta;
	}

	canFire(): boolean { return !this.isDead && this.fireCooldown <= 0; }
	resetFireCooldown(): void { this.fireCooldown = 1000 / this.type.fireRate; }
	inRange(ex: number, ey: number): boolean {
		return Math.hypot(ex - this.worldX, ey - this.worldY) <= this.type.range;
	}

	destroy(): void {
		this.hpBarBg.destroy();
		this.hpBarFill.destroy();
	}
}
