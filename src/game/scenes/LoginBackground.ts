import { Scene } from 'phaser';
import { VimEngine } from '../vim/VimEngine';
import { BackgroundTextSystem } from '../systems/BackgroundTextSystem';
import { Enemy } from '../entities/Enemy';
import { THEMES } from '../../context/ThemeContext';

const FONT_HEIGHT = 24;

export class LoginBackground extends Scene {
    private engine!: VimEngine;
    private backgroundSystem!: BackgroundTextSystem;
    private fontWidth!: number;
    private enemies: Enemy[] = [];
    private spawnTimer: number = 0;
    private rowTextsBg: Map<number, Phaser.GameObjects.Text> = new Map();

    constructor() {
        super('LoginBackground');
    }

    create() {
        const T = THEMES.minimal;
        const cam = this.cameras.main;
        cam.setBackgroundColor(T.bg);

        // --- Measure font ---
        this.engine = new VimEngine();
        const tmp = this.add.text(0, 0, 'X'.repeat(50), { fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, resolution: 3 });
        this.fontWidth = tmp.width / 50;
        tmp.destroy();

        this.backgroundSystem = new BackgroundTextSystem(this.engine);
        
        const gameAreaCols = Math.floor(cam.width / this.fontWidth);
        const visibleRows = Math.floor(cam.height / FONT_HEIGHT);
        this.backgroundSystem.populate(visibleRows + 5, gameAreaCols + 5);

        this.renderText();
    }

    update(_time: number, delta: number) {
        const cam = this.cameras.main;

        // Spawn enemies
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 800 + Math.random() * 1000;
            this.spawnEnemy();
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(delta);
            
            // Remove if off-screen
            if (
                e.x < -100 || e.x > cam.width + 100 ||
                e.y < -100 || e.y > cam.height + 100
            ) {
                e.destroy();
                this.enemies.splice(i, 1);
            }
        }
    }

    private spawnEnemy() {
        const cam = this.cameras.main;
        const margin = 40;
        
        let x = 0, y = 0, tx = 0, ty = 0;
        
        // Spawn edge
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { // left -> right
            x = -margin; y = Math.random() * cam.height;
            tx = cam.width + margin; ty = y + (Math.random() - 0.5) * 200;
        } else if (edge === 1) { // right -> left
            x = cam.width + margin; y = Math.random() * cam.height;
            tx = -margin; ty = y + (Math.random() - 0.5) * 200;
        } else if (edge === 2) { // top -> bottom
            x = Math.random() * cam.width; y = -margin;
            tx = x + (Math.random() - 0.5) * 200; ty = cam.height + margin;
        } else { // bottom -> top
            x = Math.random() * cam.width; y = cam.height + margin;
            tx = x + (Math.random() - 0.5) * 200; ty = -margin;
        }

        const speed = 100 + Math.random() * 150;
        const hp = 1;
        const color = 0xbf616a;

        const enemy = new Enemy(this, x, y, speed, hp, color, this.fontWidth, FONT_HEIGHT, 0);
        enemy.setTarget(tx, ty);
        this.enemies.push(enemy);
    }

    private renderText(): void {
        const T = THEMES.minimal;
        const cam = this.cameras.main;
        const visibleCols = Math.floor(cam.width / this.fontWidth);

        for (let r = 0; r < this.engine.lines.length; r++) {
            const line = this.engine.lines[r] ?? '';
            let bgString = '';

            const maxC = Math.min(line.length, visibleCols + 5);
            for (let c = 0; c < maxC; c++) {
                if (line[c] === ' ') {
                    bgString += ' ';
                } else if (this.engine.isBackground(r, c)) {
                    bgString += line[c];
                } else {
                    bgString += ' ';
                }
            }

            const xPos = 0;
            let tBg = this.rowTextsBg.get(r);
            if (!tBg) {
                tBg = this.add.text(xPos, r * FONT_HEIGHT, bgString, {
                    fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: T.textMuted, resolution: 3,
                });
                tBg.setOrigin(0, 0);
                tBg.setAlpha(0.25); // slightly dimmer for background
                this.rowTextsBg.set(r, tBg);
            } else {
                if (tBg.text !== bgString) tBg.setText(bgString);
            }
        }
    }
}
