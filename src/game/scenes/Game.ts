import { Scene, GameObjects } from 'phaser';
import { VimEngine } from '../vim/VimEngine';
import { GameState } from '../GameState';
import { EnemySystem } from '../systems/EnemySystem';
import { TowerSystem } from '../systems/TowerSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { BackgroundTextSystem } from '../systems/BackgroundTextSystem';
import { THEMES, ThemeName } from '../../context/ThemeContext';

const FONT_HEIGHT = 20;
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
	private fontWidth: number = 12;
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
	private hudMessageText!: GameObjects.Text;
	private hudLives!: GameObjects.Text;
	private hudScore!: GameObjects.Text;
	private hudTime!: GameObjects.Text;
	private hudEnergy!: GameObjects.Text;
	private hudEnergyBg!: GameObjects.Rectangle;
	private hudModeBg!: GameObjects.Rectangle;
	private hudModeText!: GameObjects.Text;
	private hudFilenameText!: GameObjects.Text;
	private hudPosText!: GameObjects.Text;
	private gameAreaStartX: number = 0;
	private registersUIDirty: boolean = true;
	private commandsBuilt: boolean = false;
	private staticCommandEntries: GameObjects.Text[] = [];

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
		const measure = () => {
			const tmp = this.add.text(0, 0, 'X'.repeat(50), { fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, resolution: 3 });
			this.fontWidth = tmp.width / 50;
			tmp.destroy();
		};
		measure();
		if ((document as any).fonts) {
			(document as any).fonts.ready.then(() => {
				measure();
				this.updateCursorPosition();
				this.renderText();
			});
		}

		this.gameAreaStartX = 80;

		// --- Clipboard Panel (fills right area) ---
		const clipboardPanelWidth = 320;
		const clipboardX = cam.width - clipboardPanelWidth;
		this.clipboardBg = this.add.rectangle(clipboardX, 0, clipboardPanelWidth, cam.height, T.phaserBgAlt);
		this.clipboardBg.setOrigin(0, 0).setScrollFactor(0).setDepth(41);

		// Add left border to clipboard
		this.add.rectangle(clipboardX, 0, 1, cam.height, T.phaserBorder).setOrigin(0, 0).setDepth(42).setScrollFactor(0);

		this.clipboardTitle = this.add.text(clipboardX + 20, 24, 'REGISTERS', {
			fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: T.phaserText, resolution: 3
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
				fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: '#303642', align: 'right', resolution: 3
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
		this.towerSystem.onPasteFailed = () => {
			this.flashEnergyHUD();
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
		this.engine.onEnergyCost = (amount: number) => {
			if (this.gameState.tryConsumeEnergy(amount)) return true;
			this.flashEnergyHUD();
			return false;
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

		// --- Tutorial / Powers Hint ---
		const hintStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#888888' };

		// --- HUD and Overlays ---
		const hudY = cam.height;
		this.add.rectangle(0, hudY, cam.width, HUD_HEIGHT + 10, T.phaserBgAlt).setOrigin(0, 1).setDepth(100).setScrollFactor(0);
		this.add.rectangle(0, hudY - HUD_HEIGHT, cam.width, 2, T.phaserBorder).setOrigin(0, 0).setDepth(102).setScrollFactor(0);

		// 1 & 2: Vim Position and Status (Far Left)
		this.hudModeBg = this.add.rectangle(0, hudY, 110, HUD_HEIGHT, T.phaserAccentNum).setOrigin(0, 1).setDepth(101).setScrollFactor(0);
		this.hudModeText = this.add.text(55, hudY - HUD_HEIGHT / 2, 'NORMAL', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#0d1117', resolution: 3 }).setOrigin(0.5, 0.5).setDepth(102).setScrollFactor(0);
		this.hudPosText = this.add.text(175, hudY - HUD_HEIGHT / 2, '[1,1]', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: T.phaserTextDim, resolution: 3 }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);
		this.hudMessageText = this.add.text(280, hudY - HUD_HEIGHT / 2, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: T.phaserText, resolution: 3 }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);

		this.hudTime = this.add.text(cam.width - 570, hudY - HUD_HEIGHT / 2, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', resolution: 3, color: T.phaserWarning }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);

		// Right Section (Resources & Performance - Right Justified to screen edge)
		// Kills (Far Right)
		this.hudScore = this.add.text(cam.width - 20, hudY - HUD_HEIGHT / 2, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', resolution: 3, color: T.phaserDanger }).setOrigin(1, 0.5).setDepth(101).setScrollFactor(0);

		// Towers (Left of Kills)
		this.hudLives = this.add.text(cam.width - 160, hudY - HUD_HEIGHT / 2, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '9px', resolution: 3, color: T.phaserDanger }).setOrigin(1, 0.5).setDepth(101).setScrollFactor(0);

		// Energy (Left of Towers)
		this.hudEnergyBg = this.add.rectangle(cam.width - 360, hudY, 120, HUD_HEIGHT, 0x000000, 0).setOrigin(1, 1).setDepth(100).setScrollFactor(0);
		this.hudEnergy = this.add.text(cam.width - 360 - 10, hudY - HUD_HEIGHT / 2, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: T.phaserSuccess, resolution: 3 }).setOrigin(1, 0.5).setDepth(101).setScrollFactor(0);

		this.engine.onStatusUpdate = (leftStatus: string, rightStatus: string) => {
			const isCommand = leftStatus.startsWith(':') || leftStatus.startsWith('/');
			const isInsert = leftStatus.includes('INSERT');
			const isVisual = leftStatus.includes('VISUAL');

			let modeName = 'NORMAL';
			let color = T.phaserAccentNum;

			if (isCommand) { modeName = 'COMMAND'; color = T.phaserWarningNum; }
			else if (isInsert) { modeName = 'INSERT'; color = T.phaserSuccessNum; }
			else if (isVisual) { modeName = 'VISUAL'; color = 0xb48ead; }

			this.hudModeBg.setFillStyle(color);
			this.hudModeText.setText(modeName);
			this.hudPosText.setText(`[${rightStatus}]`);
			this.hudMessageText.setText(leftStatus);
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

		this.gameOverCmdLine = this.add.text(16, cmdBarY + 28, '', {
			fontFamily: '"Press Start 2P", monospace', fontSize: '18px', color: '#d8dee9', resolution: 3
		}).setOrigin(0, 0.5).setDepth(312).setScrollFactor(0).setVisible(false);

		this.gameOverCmdCursor = this.add.rectangle(18, cmdBarY + 28, 12, 22, 0xffffff)
			.setOrigin(0, 0.5).setDepth(313).setScrollFactor(0).setVisible(false);

		this.gameOverStatusText = this.add.text(cam.width - 16, cmdBarY + 28, '', {
			fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#888888', resolution: 3
		}).setOrigin(1, 0.5).setDepth(312).setScrollFactor(0).setVisible(false);

		// --- Input ---
		this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
			if (this.gameState.isGameOver) {
				if (event.key === 'Enter') {
					if (this.gameOverCommand.startsWith(':w')) {
						const parts = this.gameOverCommand.trim().split(/\s+/);
						const name = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

						if (this.gameOverCommand.startsWith(':wq')) {
							this.saveScoreAndQuit(name);
						} else {
							this.saveScoreAndRestart(name);
						}
					} else if (this.gameOverCommand === ':q' || this.gameOverCommand === ':q!') {
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
			this.registersUIDirty = true;
		});

		this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
			this.engine.handleKeyUp(event);
		});

		// Initialize display
		this.renderText();
		this.registersUIDirty = true;
		this.engine.triggerCursorMoved();
	}

	private updateGameOverCmdLine() {
		const T = THEMES.minimal;
		const cmd = this.gameOverCommand;
		this.gameOverCmdLine.setText(cmd || '');

		const isGuest = !(window as any).googlePlayerName;

		// Color hint based on command
		if (cmd.startsWith(':w')) {
			this.gameOverCmdLine.setColor(T.phaserSuccess);
			if (cmd.startsWith(':wq')) {
				if (isGuest && cmd.trim() === ':wq') {
					this.gameOverStatusText.setText(':wq <name>  →  save & quit');
				} else {
					this.gameOverStatusText.setText(':wq  →  save & quit');
				}
			} else {
				if (isGuest && cmd.trim() === ':w') {
					this.gameOverStatusText.setText(':w <name>   →  save & restart');
				} else {
					this.gameOverStatusText.setText(':w    →  save & restart');
				}
			}
		} else if (cmd.startsWith(':q')) {
			this.gameOverCmdLine.setColor(T.phaserDanger);
			this.gameOverStatusText.setText(':q!   →  quit without saving');
		} else {
			this.gameOverCmdLine.setColor('#d8dee9');
			if (isGuest) {
				this.gameOverStatusText.setText('type :w <name> to save or :q to quit');
			} else {
				this.gameOverStatusText.setText('type :w to save or :q to quit');
			}
		}

		// Reposition cursor after text
		const cam = this.cameras.main;
		const cmdBarY = cam.height - 56;
		const textWidth = this.gameOverCmdLine.width;
		this.gameOverCmdCursor.x = 16 + textWidth + 2;
		this.gameOverCmdCursor.y = cmdBarY + 28;
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

		if (this.registersUIDirty) {
			this.registersUIDirty = false;
			this.updateRegistersUI();
		}

		this.updateHUD();
		this.updateGutterLineNumbers();
	}

	// ---- Text rendering ----
	private renderText(): void {
		const T = THEMES.minimal;

		const cam = this.cameras.main;
		const visibleRows = Math.ceil(cam.height / FONT_HEIGHT) + 2;
		const startRow = this.firstVisibleRow;
		const endRow = startRow + visibleRows;

		// Clean up rows outside the current viewport
		for (const [rowIndex, textObj] of this.rowTextsBg.entries()) {
			if (rowIndex < startRow || rowIndex >= endRow || rowIndex >= this.engine.lines.length) {
				textObj.destroy();
				this.rowTextsBg.delete(rowIndex);
				const fg = this.rowTextsFg.get(rowIndex);
				if (fg) {
					fg.destroy();
					this.rowTextsFg.delete(rowIndex);
				}
			}
		}
		const gameAreaWidth = cam.width - this.gameAreaStartX - 320;
		const visibleCols = Math.floor(gameAreaWidth / this.fontWidth);
		const startCol = Math.max(0, this.firstVisibleCol - 5);
		const endCol = startCol + visibleCols + 10;

		for (let r = startRow; r < endRow && r < this.engine.lines.length; r++) {
			const line = this.engine.lines[r] ?? '';
			let bgString = '';
			let fgString = '';

			const maxC = Math.min(line.length, endCol);
			for (let c = startCol; c < maxC; c++) {
				if (line[c] === ' ') {
					bgString += ' ';
					fgString += ' ';
				} else if (this.towerSystem?.isPartOfTower(c, r)) {
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

			const xPos = Math.floor(this.gameAreaStartX + startCol * this.fontWidth);
			const targetY = Math.floor(r * FONT_HEIGHT);

			let tBg = this.rowTextsBg.get(r);
			if (!tBg) {
				tBg = this.add.text(xPos, targetY, bgString, {
					fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: '#333842', resolution: 3,
				});
				tBg.setOrigin(0, 0);
				tBg.setAlpha(0.28);
				this.rowTextsBg.set(r, tBg);
			} else {
				if (tBg.text !== bgString) tBg.setText(bgString);
				if (tBg.x !== xPos) tBg.setX(xPos);
				if (tBg.y !== targetY) tBg.setY(targetY);
			}

			let tFg = this.rowTextsFg.get(r);
			if (!tFg) {
				tFg = this.add.text(xPos, targetY, fgString, {
					fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: T.phaserText, resolution: 3,
				});
				tFg.setOrigin(0, 0);
				this.rowTextsFg.set(r, tFg);
			} else {
				if (tFg.text !== fgString) tFg.setText(fgString);
				if (tFg.x !== xPos) tFg.setX(xPos);
				if (tFg.y !== targetY) tFg.setY(targetY);
			}
		}
	}

	// --- Cursor + camera scroll ----
	private updateCursorPosition() {
		this.cursorRect.x = Math.floor(this.gameAreaStartX + this.engine.cursorCol * this.fontWidth);
		this.cursorRect.y = Math.floor(this.engine.cursorRow * FONT_HEIGHT);

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
		this.hudEnergy.setText(`BUFFER: ${this.gameState.energy}`);
	}

	private flashEnergyHUD(): void {
		const T = THEMES.minimal;

		// Invert colors
		this.hudEnergy.setColor('#0d1117');
		this.hudEnergyBg.setFillStyle(T.phaserSuccessNum, 1);

		// Flip back after short delay
		this.time.delayedCall(250, () => {
			this.hudEnergy.setColor(T.phaserSuccess);
			this.hudEnergyBg.setFillStyle(0x000000, 0);
		});
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
		this.add.rectangle(panelX, panelY, panelW, 40, T.phaserSuccessNum)
			.setOrigin(0, 0).setDepth(D + 1).setScrollFactor(0);
		this.add.text(panelX + panelW / 2, panelY + 20,
			'GAME OVER',
			{ fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#000000', fontStyle: 'bold', resolution: 3 }
		).setOrigin(0.5, 0.5).setDepth(D + 2).setScrollFactor(0);

		// ── Body content ──────────────────────────────────────────────────
		let cy = panelY + 60; // current Y cursor inside panel
		const px = panelX + 30;
		const monoSm = { fontFamily: '"Press Start 2P", monospace', fontSize: '12px', resolution: 3 };
		const monoMd = { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', resolution: 3 };

		// Score banner
		this.add.text(panelX + panelW / 2, cy,
			`${this.gameState.kills} KILLS`,
			{ fontFamily: '"Press Start 2P", monospace', fontSize: '42px', color: T.phaserText, resolution: 3 }
		).setOrigin(0.5, 0).setDepth(D + 2).setScrollFactor(0);
		cy += 60;

		// Divider
		gfx.lineStyle(1, 0x30363d, 1);
		gfx.lineBetween(px, cy, panelX + panelW - 30, cy);
		cy += 20;

		// Tower event log header
		this.add.text(px, cy, 'SYSTEM LOGS', { fontFamily: '"Press Start 2P", monospace', color: T.phaserWarning, fontStyle: 'bold', fontSize: '20px', resolution: 3 })
			.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
		cy += 35;

		// Pull last 5 entries (most recent first) - reduced count to fit larger text
		const logEntries = this.towerLog.slice(-5).reverse();
		if (logEntries.length === 0) {
			this.add.text(px + 4, cy, 'no events recorded',
				{ ...monoSm, color: '#3b4252' }
			).setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
			cy += 25;
		} else {
			for (const entry of logEntries) {
				const timeStr = this.formatTime(entry.ts);
				let prefix: string, msgColor: string, msg: string;
				if (entry.kind === 'create') {
					prefix = '+';
					msgColor = '#a3be8c';
					msg = `CREATE ${entry.name}`;
				} else if (entry.kind === 'destroy') {
					prefix = '-';
					msgColor = '#bf616a';
					msg = `LOST   ${entry.name}`;
				} else {
					prefix = '~';
					msgColor = '#ebcb8b';
					msg = `EDIT   ${entry.name}`;
				}

				this.add.text(px, cy, timeStr, { ...monoSm, color: '#3b4252' })
					.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				this.add.text(px + 80, cy, prefix, { ...monoSm, color: msgColor })
					.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				this.add.text(px + 120, cy, msg, { ...monoSm, color: '#d8dee9' })
					.setOrigin(0, 0).setDepth(D + 2).setScrollFactor(0);
				cy += 25;
			}
		}

		// ── Command bar (Show immediately) ────────────────────────────────
		this.gameOverCmdBg.setVisible(true);
		this.gameOverCmdBorder.setVisible(true);
		this.gameOverCmdLine.setVisible(true);
		this.gameOverCmdCursor.setVisible(true);
		this.gameOverStatusText.setVisible(true);
		this.updateGameOverCmdLine();

		// ── Hint at bottom of panel ────────────────────────────────────────
		const isGuest = !(window as any).googlePlayerName;
		const hintY = panelY + panelH - 30;
		const hintText = isGuest
			? ':w <name> save & restart  |  :wq <name> save & quit'
			: ':w save & restart  |  :wq save & quit  |  :q! quit';

		this.add.text(panelX + panelW / 2, hintY, hintText,
			{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#3b4252', align: 'center', resolution: 3 }
		).setOrigin(0.5, 1).setDepth(D + 2).setScrollFactor(0);
	}

	private async saveScoreAndQuit(customName?: string) {
		await this.submitScore(customName);
		this.quitToDashboard();
	}

	private async saveScoreAndRestart(customName?: string) {
		await this.submitScore(customName);
		this.scene.restart();
	}

	private async submitScore(customName?: string) {
		this.gameOverCmdLine.setText('writing...').setColor('#ebcb8b');
		this.gameOverCmdCursor.setVisible(false);

		let finalName = customName || (window as any).googlePlayerName || 'GUEST';
		finalName = finalName.substring(0, 10).toUpperCase();

		try {
			await fetch(`${import.meta.env.VITE_API_URL}/scores`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playerName: finalName,
					score: this.gameState.kills,
					time: this.gameState.elapsedSeconds
				})
			});
		} catch (e) {
			console.error('Failed to save score', e);
		}
	}

	private quitToDashboard() {
		if ((window as any).__vimArenaQuit) {
			(window as any).__vimArenaQuit();
		} else {
			window.location.pathname = '/dashboard';
		}
	}



	// ---- Registers UI ----
	private updateRegistersUI(): void {
		const T = THEMES.minimal;
		const clipboardSystem = this.towerSystem.clipboard;
		const cam = this.cameras.main;
		const clipboardPanelWidth = 320;
		const clipboardX = cam.width - clipboardPanelWidth;

		for (const entry of this.clipboardEntries) entry.destroy();
		this.clipboardEntries = [];

		const unnamed = clipboardSystem.getUnnamed();
		const named = clipboardSystem.getRegisters();
		let y = 50;

		if (unnamed) {
			const cost = clipboardSystem.getEntryCost(unnamed);
			const statStr = cost > 0 ? ` (${cost}E)` : '';
			const nameText = this.add.text(clipboardX + 16, y,
				`[.] ${unnamed.towerType.name}${statStr}`,
				{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: T.phaserAccent, resolution: 3 }
			);
			nameText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
			this.clipboardEntries.push(nameText);

			const pLines = unnamed.towerType.pattern;
			for (let r = 0; r < pLines.length; r++) {
				const lineText = this.add.text(clipboardX + 16, y + 14 + (r * 10), pLines[r], {
					fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#ffffff', resolution: 3
				});
				lineText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
				this.clipboardEntries.push(lineText);
			}
			y += 14 + (pLines.length * 10) + 14;
		}

		for (const [reg, entry] of Array.from(named.entries()).sort()) {
			const cost = clipboardSystem.getEntryCost(entry);
			const statStr = cost > 0 ? ` (${cost}E)` : '';

			const nameText = this.add.text(clipboardX + 16, y,
				`[${reg}] ${entry.towerType.name}${statStr}`,
				{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#e6b800', resolution: 3 }
			);
			nameText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
			this.clipboardEntries.push(nameText);

			const pLines = entry.towerType.pattern;
			for (let r = 0; r < pLines.length; r++) {
				const lineText = this.add.text(clipboardX + 16, y + 14 + (r * 10), pLines[r], {
					fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#ffffff', resolution: 3
				});
				lineText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
				this.clipboardEntries.push(lineText);
			}

			y += 14 + (pLines.length * 10) + 14;
		}

		if (!unnamed && named.size === 0) {
			const noEntries = this.add.text(clipboardX + 16, y,
				'No registers unlocked!\nDefeat enemies to copy.',
				{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#8b949e', wordWrap: { width: clipboardPanelWidth - 32, useAdvancedWrap: true }, resolution: 3 }
			);
			noEntries.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
			this.clipboardEntries.push(noEntries);
			y += 35;
		}

		// COMMANDS section — built only once
		if (!this.commandsBuilt) {
			this.commandsBuilt = true;
			let cy = Math.max(y + 12, 220);
			const cmdTitle = this.add.text(clipboardX + 16, cy, 'COMMANDS', {
				fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: '#ffffff', resolution: 3
			});
			cmdTitle.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
			this.staticCommandEntries.push(cmdTitle);
			cy += 20;

			const COMMAND_GROUPS = [
				{
					name: 'MODES',
					cmds: [
						{ k: 'ESC', d: 'NORMAL' },
						{ k: 'i/a/o', d: 'INSERT/BUILD' },
						{ k: 'v', d: 'VISUAL' },
						{ k: ':', d: 'COMMAND' }
					]
				},
				{
					name: 'MOTIONS',
					cmds: [
						{ k: 'hjkl', d: 'MOVE' },
						{ k: 'w/b/e', d: 'WORD MOVE' },
						{ k: '0/$', d: 'START/END' },
						{ k: 'gg/G', d: 'TOP/BOTTOM' }
					]
				},
				{
					name: 'EDITING',
					cmds: [
						{ k: 'y/p', d: 'YANK/PASTE' },
						{ k: 'x/r', d: 'DEL/REPLACE' },
						{ k: 'd[m]', d: 'DELETE SEG' },
						{ k: '"[a]', d: 'USE REGISTER' }
					]
				},
				{
					name: 'SYSTEM',
					cmds: [
						{ k: '/[q]', d: 'SEARCH' },
						{ k: ':ult', d: 'ULTIMATE' },
						{ k: ':wq', d: 'SAVE & QUIT' },
						{ k: ':lb', d: 'LEADERBOARD' }
					]
				}
			];

			for (const group of COMMAND_GROUPS) {
				cy += 4;
				const groupHead = this.add.text(clipboardX + 16, cy, group.name, {
					fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#8b949e', resolution: 3
				});
				groupHead.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
				this.staticCommandEntries.push(groupHead);
				cy += 13;

				for (const cmd of group.cmds) {
					const kText = this.add.text(clipboardX + 16, cy, cmd.k.padEnd(7), {
						fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#e6b800', resolution: 3
					});
					const dText = this.add.text(clipboardX + 90, cy, cmd.d, {
						fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#c9d1d9', resolution: 3
					});
					kText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
					dText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
					this.staticCommandEntries.push(kText, dText);
					cy += 13;
				}
			}
		}
	}
}
