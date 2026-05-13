import { Scene, GameObjects } from 'phaser';
import { TowerType } from './TowerTypes';

/**
 * Interpolate between two hex colours (as "#rrggbb" strings).
 * t = 0 → a,  t = 1 → b
 */
function lerpColor(a: string, b: string, t: number): string {
    const parse = (s: string) => [
        parseInt(s.slice(1, 3), 16),
        parseInt(s.slice(3, 5), 16),
        parseInt(s.slice(5, 7), 16),
    ];
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bb2 = Math.round(ab + (bb - ab) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bb2.toString(16).padStart(2, '0')}`;
}

/**
 * Full HP  → #ffffff  (bright)
 * 0% HP    → #404040  (same as background textMuted — blends into bg text)
 */
function hpColor(ratio: number): string {
    return lerpColor('#404040', '#ffffff', Math.max(0, ratio));
}

export class Tower {
    public readonly col: number;
    public readonly row: number;
    public readonly worldX: number;
    public readonly worldY: number;
    public readonly type: TowerType;
    public currentHp: number;
    public fireCooldown: number = 0;
    public isDead: boolean = false;

    // Visual overlay — one text object per pattern row
    private overlayLines: GameObjects.Text[] = [];

    constructor(
        scene: Scene,
        col: number, row: number,
        worldX: number, worldY: number,
        type: TowerType,
        charW: number, charH: number,
        gutterWidth: number,
        fontWidth: number,
        fontHeight: number,
        startCol: number,
        startRow: number,
    ) {
        this.col = col;
        this.row = row;
        this.worldX = worldX;
        this.worldY = worldY;
        this.type = type;
        this.currentHp = type.maxHp;

        // Build one Phaser Text per line of the pattern
        for (let i = 0; i < type.pattern.length; i++) {
            const x = Math.floor(gutterWidth + startCol * fontWidth);
            const y = Math.floor((startRow + i) * fontHeight);
            const t = scene.add.text(x, y, type.pattern[i], {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: `${fontHeight}px`,
                color: '#ffffff',
                resolution: 3,
            }).setOrigin(0, 0).setDepth(15);
            this.overlayLines.push(t);
        }
    }

    /** Call after any HP change to recolour the overlay. */
    refreshOverlay(): void {
        const ratio = this.currentHp / this.type.maxHp;
        const color = hpColor(ratio);
        for (const line of this.overlayLines) {
            line.setColor(color);
        }
    }

    takeDamage(amount: number): boolean {
        this.currentHp = Math.max(0, this.currentHp - amount);
        if (this.currentHp <= 0) {
            this.isDead = true;
            // Transition overlay to dead colour then destroy after a short delay
            for (const line of this.overlayLines) {
                line.setColor('#404040');
            }
        } else {
            this.refreshOverlay();
        }
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
        for (const line of this.overlayLines) {
            line.destroy();
        }
        this.overlayLines = [];
    }
}
