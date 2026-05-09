import { Scene, GameObjects } from 'phaser';
import { VimEngine } from '../vim/VimEngine';
import { GameState } from '../GameState';
import { EnemySystem } from '../systems/EnemySystem';
import { TowerSystem } from '../systems/TowerSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { BackgroundTextSystem } from '../systems/BackgroundTextSystem';
import { THEMES, ThemeName } from '../../context/ThemeContext';

const FONT_HEIGHT = 24;
const SCROLLOFF_ROWS = 5;
const SCROLLOFF_COLS = 5;
const HUD_HEIGHT = 30;

export class Game extends Scene {
	// --- Vim layer ---
	private engine!: VimEngine;
	private cursorRect!: GameObjects.Rectangle;
	private cursorCharText!: GameObjects.Text;
	private visualRect!: GameObjects.Rectangle;
	private rowTextsBg: Map<number, GameObjects.Text> = new Map();
	private rowTextsFg: Map<number, GameObjects.Text> = new Map();
	private fontWidth: number;
	private firstVisibleRow: number = 0;
	private firstVisibleCol: number = 0;
	private lineNumbers: GameObjects.Text[] = [];
	private clipboardBg!: GameObjects.Rectangle;
	private clipboardTitle!: GameObjects.Text;
	private clipboardEntries: GameObjects.Text[] = [];
	private enemySystem!: EnemySystem;
	private towerSystem!: TowerSystem;
	private combatSystem!: CombatSystem;
	private gameState!: GameState;
	private backgroundSystem!: BackgroundTextSystem;
	// --- Game Over Overlay ---
	private gameOverOverlay!: GameObjects.Rectangle;
	private gameOverContainer!: GameObjects.Container;
	private gameOverCmdLine!: GameObjects.Text;
	private gameOverCmdCursor!: GameObjects.Rectangle;
	private gameOverCmdBg!: GameObjects.Rectangle;
	private gameOverCmdBorder!: GameObjects.Rectangle;
	private gameOverStatusText!: GameObjects.Text;
	private cursorBlinkTimer: number = 0;
	private cursorVisible: boolean = true;
	private hudLives!: GameObjects.Text;
	private hudScore!: GameObjects.Text;
	private hudTime!: GameObjects.Text;
	private hudEnergy!: GameObjects.Text;
	private hudVimStatus!: GameObjects.Text;
	private gameAreaStartX: number = 0;

	// --- Tower event log ---
	private towerLog: Array<{ ts: number; kind: 'create' | 'destroy' | 'edit'; name: string; col: number; row: number }> = [];
	private readonly MAX_TOWER_LOG = 40;

	constructor() { super('Game'); }


	private gameOverCommand: string = '';

	create() {
		const T = THEMES.minimal;

		const cam = this.cameras.main;
		cam.setBackgroundColor(T.bg);
		cam.setBounds(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

		// --- Measure font ---
		this.engine = new VimEngine();
		const tmp = this.add.text(0, 0, 'X'.repeat(50), { fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, resolution: 3 });
		this.fontWidth = tmp.width / 50;
		tmp.destroy();

		this.gameAreaStartX = 80;

		// --- Clipboard Panel (fills right area) ---
		const clipboardPanelWidth = 320;
		const clipboardX = cam.width - clipboardPanelWidth;
		this.clipboardBg = this.add.rectangle(clipboardX, 0, clipboardPanelWidth, cam.height, T.phaserBgAlt);
		this.clipboardBg.setOrigin(0, 0).setScrollFactor(0).setDepth(41);

		// Add left border to clipboard
		this.add.rectangle(clipboardX, 0, 1, cam.height, T.phaserBorder).setOrigin(0, 0).setDepth(42).setScrollFactor(0);

		this.clipboardTitle = this.add.text(clipboardX + 20, 24, 'CLIPBOARD', {
			fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: T.phaserText
		});
		this.clipboardTitle.setOrigin(0, 0).setScrollFactor(0).setDepth(42);



		// --- Cursor ---
		this.cursorRect = this.add.rectangle(0, 0, this.fontWidth, FONT_HEIGHT, T.phaserCursor, 1.0);
		this.cursorRect.setOrigin(0, 0).setDepth(10);
		this.cursorCharText = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: T.bg, resolution: 3 });
		this.cursorCharText.setOrigin(0, 0).setDepth(11);

		// --- Visual Mode Highlight ---
		this.visualRect = this.add.rectangle(0, 0, 0, 0, T.phaserVisual, 0.3);
		this.visualRect.setOrigin(0, 0).setDepth(9).setVisible(false);

		// --- Line numbers ---
		const visibleLines = Math.ceil(cam.height / FONT_HEIGHT) + 2;
		for (let i = 0; i < visibleLines; i++) {
			const t = this.add.text(this.gameAreaStartX - this.fontWidth - 10, i * FONT_HEIGHT, '', {
				fontFamily: 'monospace', fontSize: `${FONT_HEIGHT}px`, color: '#444444', align: 'right', resolution: 3
			});
			t.setOrigin(1, 0).setScrollFactor(0, 1).setDepth(50);
			this.lineNumbers.push(t);
		}

		// --- Initialize systems ---
		this.gameState = new GameState();
		this.enemySystem = new EnemySystem(this, this.gameState, this.gameAreaStartX, this.fontWidth, FONT_HEIGHT);
		// Calculate game area columns to center towers
		const gameAreaWidth = cam.width - clipboardPanelWidth;
		const gameAreaCols = Math.floor(gameAreaWidth / this.fontWidth);
		const centerCol = Math.floor(gameAreaCols / 2);

		this.towerSystem = new TowerSystem(this, this.engine, this.gameAreaStartX, this.fontWidth, FONT_HEIGHT, this.gameState, centerCol);
		this.combatSystem = new CombatSystem(this, this.gameState, this.towerSystem);
		this.enemySystem.setTowerProvider(() => this.towerSystem.activeTowers);

		this.backgroundSystem = new BackgroundTextSystem(this.engine);
		this.backgroundSystem.isCellProtected = (c, r) => this.towerSystem.isPartOfTower(c, r);

		const visibleRowsOnLoad = Math.floor(cam.height / FONT_HEIGHT);
		this.backgroundSystem.populate(Math.max(30, visibleRowsOnLoad + 10), gameAreaCols + 200);

		// --- Tower event log ---
		this.towerSystem.onTowerCreated = (name, col, row) => {
			if (this.towerLog.length >= this.MAX_TOWER_LOG) this.towerLog.shift();
			this.towerLog.push({ ts: this.gameState.elapsedSeconds, kind: 'create', name, col, row });
		};
		this.towerSystem.onTowerDestroyed = (_col, _row, name) => {
			if (this.towerLog.length >= this.MAX_TOWER_LOG) this.towerLog.shift();
			this.towerLog.push({ ts: this.gameState.elapsedSeconds, kind: 'destroy', name: name ?? 'Tower', col: _col, row: _row });
		};
		this.towerSystem.onTowerDeletedByEdit = (name, col, row) => {
			if (this.towerLog.length >= this.MAX_TOWER_LOG) this.towerLog.shift();
			this.towerLog.push({ ts: this.gameState.elapsedSeconds, kind: 'edit', name, col, row });
		};

		// --- Vim engine events ---
		this.engine.getViewport = () => {
			const cam = this.cameras.main;
			const gameAreaWidth = cam.width - this.gameAreaStartX - 320;
			const visibleCols = Math.floor(gameAreaWidth / this.fontWidth);
			const visibleRows = Math.floor(cam.height / FONT_HEIGHT);
			const firstRow = Math.floor(cam.scrollY / FONT_HEIGHT);
			return {
				startCol: this.firstVisibleCol,
				endCol: this.firstVisibleCol + visibleCols,
				startRow: firstRow,
				endRow: firstRow + visibleRows
			};
		};
		this.engine.onCursorMoved = () => this.updateCursorPosition();
		this.engine.onRenderAll = () => {
			this.renderText();
			this.towerSystem.scanAll();
		};
		this.engine.onRenderRow = (row: number) => {
			this.renderText();
			this.towerSystem.scanRow(row);
		};

		// --- Game state events ---
		this.gameState.onGameOver = () => this.showGameOver();

		this.engine.onQuit = () => this.quitToDashboard();
		this.engine.onLeaderboard = () => {
			if ((window as any).__vimArenaLeaderboard) {
				(window as any).__vimArenaLeaderboard();
			} else {
				window.location.pathname = '/leaderboard';
			}
		};

		this.engine.onUltimate = () => {
			if (this.gameState.tryUltimate()) {
				const rect = this.add.rectangle(0, 0, cam.width, cam.height, 0xffffff, 0.8);
				rect.setOrigin(0, 0).setDepth(400).setScrollFactor(0);
				this.tweens.add({
					targets: rect,
					alpha: 0,
					duration: 500,
					onComplete: () => rect.destroy()
				});

				for (const enemy of this.enemySystem.activeEnemies) {
					if (!enemy.isDead && !enemy.hasExited) {
						enemy.takeDamage(100);
						if (enemy.isDead) {
							this.gameState.addKill();
							this.towerSystem.clipboard.onEnemyKilled();
						}
					}
				}
			}
		};

		// --- HUD and Overlays ---
		const hudY = cam.height - HUD_HEIGHT;
		this.add.rectangle(0, hudY, cam.width, HUD_HEIGHT, T.phaserBgAlt).setOrigin(0, 0).setDepth(100).setScrollFactor(0);
		this.add.rectangle(0, hudY, cam.width, 1, T.phaserBorder).setOrigin(0, 0).setDepth(102).setScrollFactor(0);

		// 1 & 2: Vim Position and Status (Far Left)
		this.hudVimStatus = this.add.text(20, hudY + 10, '[1,1] -- NORMAL --', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: T.phaserText, resolution: 3 }).setOrigin(0, 0).setDepth(101).setScrollFactor(0);
		this.hudTime = this.add.text(260, hudY + 10, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', resolution: 3, color: T.phaserWarning }).setOrigin(0, 0).setDepth(101).setScrollFactor(0);

		// Right Section (Resources & Performance - Right Justified to screen edge)
		// Kills (Far Right)
		this.hudScore = this.add.text(cam.width - 20, hudY + 10, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', resolution: 3, color: T.phaserDanger }).setOrigin(1, 0).setDepth(101).setScrollFactor(0);

		// Towers (Left of Kills)
		this.hudLives = this.add.text(cam.width - 160, hudY + 10, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', resolution: 3, color: T.phaserDanger }).setOrigin(1, 0).setDepth(101).setScrollFactor(0);

		// Energy (Left of Towers)
		this.hudEnergy = this.add.text(cam.width - 360, hudY + 10, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: T.phaserSuccess, resolution: 3 }).setOrigin(1, 0).setDepth(101).setScrollFactor(0);

		this.engine.onStatusUpdate = (leftStatus: string, rightStatus: string) => {
			this.hudVimStatus.setText(`[${rightStatus}] ${leftStatus}`);
		};

		this.engine.onCommand = (cmd: string) => {
			if (cmd === ':q!') {
				this.quitToDashboard();
				return;
			}
			// Other commands handled by engine or other systems
		};

		// Game over overlay (created but populated in showGameOver)
		this.gameOverOverlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x0d1117, 0.96)
			.setOrigin(0, 0).setDepth(300).setScrollFactor(0).setVisible(false);

		// Container holds all game-over UI so it can be hidden/shown cleanly
		this.gameOverContainer = this.add.container(0, 0).setDepth(301).setScrollFactor(0).setVisible(false);

		// Command line at the bottom — a vim-style bar
		const cmdBarY = cam.height - 56;
		this.gameOverCmdBg = this.add.rectangle(0, cmdBarY, cam.width, 56, 0x161b22)
			.setOrigin(0, 0).setDepth(310).setScrollFactor(0).setVisible(false);

		// Top border of command bar (hidden until game over)
		this.gameOverCmdBorder = this.add.rectangle(0, cmdBarY, cam.width, 1, T.phaserSuccessNum)
			.setOrigin(0, 0).setDepth(311).setScrollFactor(0).setVisible(false);

		this.gameOverCmdLine = this.add.text(16, cmdBarY + 14, '', {
			fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', resolution: 2
		}).setDepth(312).setScrollFactor(0).setVisible(false);

		this.gameOverCmdCursor = this.add.rectangle(18, cmdBarY + 14, 12, 22, 0xffffff)
			.setOrigin(0, 0).setDepth(313).setScrollFactor(0).setVisible(false);

		this.gameOverStatusText = this.add.text(cam.width - 16, cmdBarY + 18, '', {
			fontFamily: 'monospace', fontSize: '13px', color: '#888888', resolution: 2
		}).setOrigin(1, 0).setDepth(312).setScrollFactor(0).setVisible(false);

		// --- Input ---
		this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
			if (this.gameState.isGameOver) {
				if (event.key === 'Enter') {
					if (this.gameOverCommand.startsWith(':w')) {
						const parts = this.gameOverCommand.trim().split(/\s+/);
						const name = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
						this.saveScoreAndQuit(name);
					} else if (this.gameOverCommand === ':q') {
						this.quitToDashboard();
					} else {
						// Unknown command — flash red
						this.gameOverCmdLine.setColor('#bf616a');
						this.time.delayedCall(400, () => this.gameOverCmdLine.setColor('#d8dee9'));
					}
					return;
				}
				if (event.key === 'Backspace') {
					this.gameOverCommand = this.gameOverCommand.slice(0, -1);
				} else if (event.key.length === 1) {
					if (event.key === ':' && this.gameOverCommand === '') {
						this.gameOverCommand = ':';
					} else if (this.gameOverCommand.startsWith(':') || event.key === ':') {
						this.gameOverCommand += event.key;
					}
				}
				this.updateGameOverCmdLine();
				return;
			}

			// Prevent default browser scrolling for specific keys
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
				event.preventDefault();
			}
			this.engine.handleKeyDown(event);
		});

		this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
			this.engine.handleKeyUp(event);
		});

		// Initialize display
		this.renderText();
		this.engine.triggerCursorMoved();
	}

	private updateGameOverCmdLine() {
		const T = THEMES.minimal;
		const cmd = this.gameOverCommand;
		this.gameOverCmdLine.setText(cmd || '');

		// Color hint based on command
		if (cmd.startsWith(':w')) {
			this.gameOverCmdLine.setColor(T.phaserSuccess);
			this.gameOverStatusText.setText(':w <name>  →  save & quit');
		} else if (cmd.startsWith(':q')) {
			this.gameOverCmdLine.setColor('#888888');
			this.gameOverStatusText.setText(':q  →  quit without saving');
		} else if (cmd.length > 0) {
			this.gameOverCmdLine.setColor(T.phaserDanger);
			this.gameOverStatusText.setText('unknown command');
		} else {
			this.gameOverCmdLine.setColor('#f0f0f0');
			this.gameOverStatusText.setText(':w <name>  save   |   :q  quit');
		}

		// Reposition cursor after text
		const cam = this.cameras.main;
		const cmdBarY = cam.height - 56;
		const textWidth = this.gameOverCmdLine.width;
		this.gameOverCmdCursor.x = 16 + textWidth + 2;
		this.gameOverCmdCursor.y = cmdBarY + 14;
	}

	update(_time: number, delta: number) {
		if (this.gameState.isGameOver) {
			// Blink cursor
			this.cursorBlinkTimer += delta;
			if (this.cursorBlinkTimer > 530) {
				this.cursorBlinkTimer = 0;
				this.cursorVisible = !this.cursorVisible;
				this.gameOverCmdCursor.setVisible(this.cursorVisible);
			}
			return;
		}

		const cam = this.cameras.main;
		const scrollX = cam.scrollX;
		const scrollY = cam.scrollY;
		const vpW = cam.width;
		const vpH = cam.height;

		this.gameState.update(delta);
		this.enemySystem.update(delta, scrollX, scrollY, vpW, vpH);
		this.towerSystem.update(delta);
		this.combatSystem.update(delta, this.enemySystem.activeEnemies);

		this.updateHUD();
		this.updateGutterLineNumbers();
		this.updateClipboardUI();
	}

	// ---- Text rendering ----
	private renderText(): void {
		const T = THEMES.minimal;

		// Clean up deleted lines
		for (const [rowIndex, textObj] of this.rowTextsBg.entries()) {
			if (rowIndex >= this.engine.lines.length) {
				textObj.destroy();
				this.rowTextsBg.delete(rowIndex);
				const fg = this.rowTextsFg.get(rowIndex);
				if (fg) {
					fg.destroy();
					this.rowTextsFg.delete(rowIndex);
				}
			}
		}
		const cam = this.cameras.main;
		const gameAreaWidth = cam.width - this.gameAreaStartX - 320;
		const visibleCols = Math.floor(gameAreaWidth / this.fontWidth);
		const startCol = Math.max(0, this.firstVisibleCol - 5);
		const endCol = startCol + visibleCols + 10;

		for (let r = 0; r < this.engine.lines.length; r++) {
			const line = this.engine.lines[r] ?? '';
			let bgString = '';
			let fgString = '';

			const maxC = Math.min(line.length, endCol);
			for (let c = startCol; c < maxC; c++) {
				if (line[c] === ' ') {
					bgString += ' ';
					fgString += ' ';
				} else if (this.engine.isBackground(r, c)) {
					bgString += line[c];
					fgString += ' ';
				} else {
					bgString += ' ';
					fgString += line[c];
				}
			}

			const xPos = this.gameAreaStartX + startCol * this.fontWidth;

			let tBg = this.rowTextsBg.get(r);
			if (!tBg) {
				tBg = this.add.text(xPos, r * FONT_HEIGHT, bgString, {
					fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: T.textMuted, resolution: 3,
				});
				tBg.setOrigin(0, 0);
				tBg.setAlpha(0.35);
				this.rowTextsBg.set(r, tBg);
			} else {
				if (tBg.text !== bgString) tBg.setText(bgString);
				if (tBg.x !== xPos) tBg.setX(xPos);
			}

			let tFg = this.rowTextsFg.get(r);
			if (!tFg) {
				tFg = this.add.text(xPos, r * FONT_HEIGHT, fgString, {
					fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: T.phaserText, resolution: 3,
				});
				tFg.setOrigin(0, 0);
				this.rowTextsFg.set(r, tFg);
			} else {
				if (tFg.text !== fgString) tFg.setText(fgString);
				if (tFg.x !== xPos) tFg.setX(xPos);
			}
		}
	}

	// --- Cursor + camera scroll ----
	private updateCursorPosition() {
		this.cursorRect.x = this.gameAreaStartX + this.engine.cursorCol * this.fontWidth;
		this.cursorRect.y = this.engine.cursorRow * FONT_HEIGHT;
		
		this.cursorCharText.x = this.cursorRect.x;
		this.cursorCharText.y = this.cursorRect.y;
		const lineStr = this.engine.lines[this.engine.cursorRow] || '';
		const charUnderCursor = lineStr[this.engine.cursorCol] || ' ';
		this.cursorCharText.setText(charUnderCursor);

		if (this.engine.mode === 'VISUAL' && this.engine.visualStart) {
			const startR = Math.min(this.engine.visualStart.row, this.engine.cursorRow);
			const endR = Math.max(this.engine.visualStart.row, this.engine.cursorRow);
			const startC = Math.min(this.engine.visualStart.col, this.engine.cursorCol);
			const endC = Math.max(this.engine.visualStart.col, this.engine.cursorCol);

			this.visualRect.x = this.gameAreaStartX + startC * this.fontWidth;
			this.visualRect.y = startR * FONT_HEIGHT;
			this.visualRect.width = (endC - startC + 1) * this.fontWidth;
			this.visualRect.height = (endR - startR + 1) * FONT_HEIGHT;
			this.visualRect.setVisible(true);
		} else {
			this.visualRect.setVisible(false);
		}

		const cam = this.cameras.main;
		const visibleRows = Math.floor(cam.height / FONT_HEIGHT);
		const gameAreaWidth = cam.width - this.gameAreaStartX - 320;
		const visibleCols = Math.floor(gameAreaWidth / this.fontWidth);

		if (this.engine.cursorRow < this.firstVisibleRow + SCROLLOFF_ROWS)
			this.firstVisibleRow = Math.max(0, this.engine.cursorRow - SCROLLOFF_ROWS);
		if (this.engine.cursorRow > this.firstVisibleRow + visibleRows - SCROLLOFF_ROWS - 1)
			this.firstVisibleRow = Math.max(0, this.engine.cursorRow - visibleRows + SCROLLOFF_ROWS + 1);

		if (this.engine.cursorCol < this.firstVisibleCol + SCROLLOFF_COLS)
			this.firstVisibleCol = Math.max(0, this.engine.cursorCol - SCROLLOFF_COLS);
		if (this.engine.cursorCol > this.firstVisibleCol + visibleCols - SCROLLOFF_COLS - 1)
			this.firstVisibleCol = Math.max(0, this.engine.cursorCol - visibleCols + SCROLLOFF_COLS + 1);

		cam.setScroll(this.firstVisibleCol * this.fontWidth, this.firstVisibleRow * FONT_HEIGHT);

		// Ensure background text exists anywhere the camera goes
		this.backgroundSystem.ensureVisiblePopulated(
			this.firstVisibleRow,
			this.firstVisibleRow + visibleRows + 10,
			this.firstVisibleCol + visibleCols + 200
		);

		// Always update text slice after scrolling
		this.renderText();
	}

	// ---- Gutter line numbers ----
	private updateGutterLineNumbers() {
		const cursorRow = this.engine.cursorRow;
		for (let i = 0; i < this.lineNumbers.length; i++) {
			const row = this.firstVisibleRow + i;
			let display = '';
			if (row >= 0) {
				if (row === cursorRow) {
					display = (row + 1).toString();
				} else {
					display = Math.abs(row - cursorRow).toString();
				}
			}
			this.lineNumbers[i].setText(display);
			this.lineNumbers[i].y = row * FONT_HEIGHT;
		}
	}

	private updateHUD(): void {
		const hpBars = '|'.repeat(this.gameState.towerCount);
		const emptyBars = '.'.repeat(Math.max(0, 5 - this.gameState.towerCount));
		this.hudLives.setText(`TOWERS: [${hpBars}${emptyBars}]`);

		this.hudScore.setText(`KILLS: ${this.gameState.kills}`);
		this.hudTime.setText(this.formatTime(this.gameState.elapsedSeconds));
		this.hudEnergy.setText(`ENERGY: ${this.gameState.energy}`);
	}

	private formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	// ---- Game over ----
	private async showGameOver(): Promise<void> {
		const T = THEMES.minimal;
		const cam = this.cameras.main;
		const w = cam.width;
		const h = cam.height;
		const panelW = Math.min(740, w - 80);
		const panelX = (w - panelW) / 2;
		const panelY = 40;
		const panelH = h - 120;
		const D = 302;

		// Show full-screen dim
		this.gameOverOverlay.setVisible(true);

		// ── Panel background ──────────────────────────────────────────────
		const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0d1117, 0.98)
			.setOrigin(0, 0).setDepth(D).setScrollFactor(0);

		// Border
		const borderPts = [
			panelX, panelY,
			panelX + panelW, panelY,
			panelX + panelW, panelY + panelH,
			panelX, panelY + panelH,
			panelX, panelY
		];
		const gfx = this.add.graphics().setDepth(D + 1).setScrollFactor(0);
		gfx.lineStyle(1, T.phaserSuccessNum, 0.4);
		gfx.strokePoints(borderPts.reduce((acc, v, i) => {
			if (i % 2 === 0) acc.push({ x: v, y: borderPts[i + 1] });
			return acc;
		}, [] as { x: number; y: number }[]), true);

		// ── Title bar ─────────────────────────────────────────────────────
		this.add.rectangle(panelX, panelY, panelW, 36, T.phaserSuccessNum)
			.setOrigin(0, 0).setDepth(D + 1).setScrollFactor(0);
		this.add.text(panelX + panelW / 2, panelY + 18,
			'GAME OVER',
			{ fontFamily: 'monospace', fontSize: '13px', color: '#000000', fontStyle: 'bold', resolution: 2 }
		).setOrigin(0.5, 0.5).setDepth(D + 2).setScrollFactor(0);

		// ── Body content ──────────────────────────────────────────────────
		let cy = panelY + 52; // current Y cursor inside panel
		const px = panelX + 20;
		const monoSm = { fontFamily: 'monospace', fontSize: '12px', resolution: 2 };
		const monoMd = { fontFamily: 'monospace', fontSize: '14px', resolution: 2 };

		// Score banner
		this.add.text(panelX + panelW / 2, cy,
			`${this.gameState.kills} KILLS`,
			{ fontFamily: '"Press Start 2P", monospace', fontSize: '28px', color: T.phaserText, resolution: 3 }
		).setOrigin(0.5, 0).setDepth(D + 2).setScrollFactor(0);
		cy += 44;

		this.add.text(panelX + panelW / 2, cy, 'session terminated',
			{ ...monoSm, color: '#888888' }
		).setOrigin(0.5, 0).setDepth(D + 2).setScrollFactor(0);
		cy += 28;

		// Divider
		gfx.lineStyle(1, 0x30363d, 1);
		gfx.lineBetween(px, cy, panelX + panelW - 20, cy);
		cy += 14;

		// Tower event log header
		this.add.text(px, cy, 'TOWER LOG', { ...monoSm, color: '#e5c07b', fontStyle: 'bold' })
			.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
		this.add.text(panelX + panelW - 20, cy, `git log --diff-filter=CD towers`,
			{ ...monoSm, color: '#3b4252' }
		).setOrigin(1, 0).setDepth(D + 2).setScrollFactor(0);
		cy += 22;

		// Pull last 6 entries (most recent first)
		const logEntries = this.towerLog.slice(-6).reverse();
		if (logEntries.length === 0) {
			this.add.text(px + 4, cy, 'no tower events recorded',
				{ ...monoSm, color: '#3b4252' }
			).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
			cy += 20;
		} else {
			for (const entry of logEntries) {
				const timeStr = this.formatTime(entry.ts);
				let prefix: string, msgColor: string, msg: string;
				if (entry.kind === 'create') {
					prefix = '+ create';
					msgColor = '#a3be8c';
					msg = `${entry.name}  at col:${entry.col} row:${entry.row}`;
				} else if (entry.kind === 'destroy') {
					prefix = '- destroy';
					msgColor = '#bf616a';
					msg = `${entry.name}  destroyed by enemy`;
				} else {
					prefix = '~ edit';
					msgColor = '#ebcb8b';
					msg = `${entry.name}  deleted via buffer edit`;
				}
				this.add.text(px, cy, timeStr,
					{ ...monoSm, color: '#3b4252' }
				).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				this.add.text(px + 58, cy, prefix,
					{ ...monoSm, color: msgColor }
				).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				this.add.text(px + 152, cy, msg,
					{ ...monoSm, color: '#d8dee9' }
				).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				cy += 20;
			}
		}
		cy += 6;

		// Divider
		gfx.lineBetween(px, cy, panelX + panelW - 20, cy);
		cy += 14;

		// Leaderboard header
		this.add.text(px, cy, 'TOP SCORES', { ...monoSm, color: '#e5c07b', fontStyle: 'bold' })
			.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
		this.add.text(panelX + panelW - 20, cy, 'git log --oneline scores',
			{ ...monoSm, color: '#3b4252' }
		).setOrigin(1, 0).setDepth(D + 2).setScrollFactor(0);
		cy += 22;

		try {
			const response = await fetch(`${import.meta.env.VITE_API_URL}/scores`);
			const topScores: any[] = await response.json();
			const top5 = topScores.slice(0, 5);
			const medals = ['★', '○', '○', '·', '·'];
			const rankColors = ['#ebcb8b', '#b48ead', '#88c0d0', '#4c566a', '#4c566a'];
			for (let i = 0; i < top5.length; i++) {
				const e = top5[i];
				const hash = e._id ? e._id.slice(-7) : Math.random().toString(16).slice(2, 9);
				this.add.text(px, cy, `${medals[i]} ${hash}`, { ...monoSm, color: rankColors[i] })
					.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				this.add.text(px + 120, cy, e.playerName.padEnd(10, ' '),
					{ ...monoSm, color: '#d8dee9' }
				).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				this.add.text(px + 240, cy, `+${e.score} kills`,
					{ ...monoSm, color: i === 0 ? '#bf616a' : '#a3be8c' }
				).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				cy += 20;
			}
		} catch {
			this.add.text(px, cy, 'could not reach remote — no scores loaded',
				{ ...monoSm, color: '#4c566a' }
			).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
		}

		// ── Hint at bottom of panel ────────────────────────────────────────
		const hintY = panelY + panelH - 34;
		this.add.text(panelX + panelW / 2, hintY,
			':w <your name>   save & quit     |     :q   quit without saving',
			{ ...monoSm, color: '#3b4252', align: 'center' }
		).setOrigin(0.5, 0).setDepth(D + 2).setScrollFactor(0);

		// ── Command bar ───────────────────────────────────────────────────
		this.gameOverCmdBg.setVisible(true);
		this.gameOverCmdBorder.setVisible(true);
		this.gameOverCmdLine.setVisible(true);
		this.gameOverCmdCursor.setVisible(true);
		this.gameOverStatusText.setVisible(true);
		this.updateGameOverCmdLine();
	}

	private async saveScoreAndQuit(customName?: string) {
		this.gameOverCmdLine.setText('writing...').setColor('#ebcb8b');
		this.gameOverCmdCursor.setVisible(false);
		let playerName = customName || (window as any).googlePlayerName || "GUEST";
		playerName = playerName.substring(0, 10).toUpperCase();
		try {
			await fetch(`${import.meta.env.VITE_API_URL}/scores`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerName, score: this.gameState.kills })
			});
		} catch (e) {
			console.error('Save failed', e);
		}
		this.quitToDashboard();
	}

	private quitToDashboard() {
		if ((window as any).__vimArenaQuit) {
			(window as any).__vimArenaQuit();
		} else {
			window.location.pathname = '/dashboard';
		}
	}



	// ---- Clipboard UI ----
	private updateClipboardUI(): void {
		const T = THEMES.minimal;
		const clipboard = this.towerSystem.clipboard;
		const cam = this.cameras.main;
		const clipboardPanelWidth = 320;
		const clipboardX = cam.width - clipboardPanelWidth;

		// Clear old entries
		for (const entry of this.clipboardEntries) {
			entry.destroy();
		}
		this.clipboardEntries = [];

		// Show clipboard entries with better formatting
		const entries = clipboard.getClipboard();
		let y = 70;

		if (entries.length === 0) {
			const noEntries = this.add.text(clipboardX + 10, y,
				'No towers copied yet!\n\nDefeat enemies to\nunlock copy ability.',
				{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#666666', wordWrap: { width: clipboardPanelWidth - 20, useAdvancedWrap: true } }
			);
			noEntries.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
			this.clipboardEntries.push(noEntries);
		} else {
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i];

				const cost = clipboard.getEntryCost(entry);
				const statStr = cost > 0 ? ` (${cost}E)` : '';

				// Header (Press Start 2P font)
				const nameText = this.add.text(clipboardX + 20, y,
					`[${i + 1}p] ${entry.towerType.name}${statStr}`,
					{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: T.phaserTextDim }
				);
				nameText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
				this.clipboardEntries.push(nameText);

				// Pattern (Render line-by-line to force a perfectly square grid)
				const pLines = entry.towerType.pattern;
				for (let r = 0; r < pLines.length; r++) {
					const lineText = this.add.text(clipboardX + 20, y + 20 + (r * 10), pLines[r], {
						fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ffffff'
					});
					lineText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
					this.clipboardEntries.push(lineText);
				}

				y += 20 + (pLines.length * 10) + 30;
			}
		}
	}
}
