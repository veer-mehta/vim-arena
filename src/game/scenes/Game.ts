import { Scene, GameObjects } from 'phaser';
import { VimEngine } from '../vim/VimEngine';
import { GameState } from '../GameState';
import { EnemySystem } from '../systems/EnemySystem';
import { TowerSystem } from '../systems/TowerSystem';
import { CombatSystem } from '../systems/CombatSystem';

const FONT_HEIGHT = 24;
const SCROLLOFF_ROWS = 5;
const SCROLLOFF_COLS = 5;
const HUD_HEIGHT = 30;

export class Game extends Scene {
	// --- Vim layer ---
	private engine!: VimEngine;
	private cursorRect!: GameObjects.Rectangle;
	private visualRect!: GameObjects.Rectangle;
	private rowTexts: Map<number, GameObjects.Text> = new Map();
	private fontWidth: number;
	private firstVisibleRow: number = 0;
	private firstVisibleCol: number = 0;
	private lineNumbers: GameObjects.Text[] = [];
	private instructionBg!: GameObjects.Rectangle;
	private instructionText!: GameObjects.Text;
	private clipboardBg!: GameObjects.Rectangle;
	private clipboardTitle!: GameObjects.Text;
	private clipboardEntries: GameObjects.Text[] = [];
	private enemySystem!: EnemySystem;
	private towerSystem!: TowerSystem;
	private combatSystem!: CombatSystem;
	private gameState!: GameState;
	private gameOverOverlay!: GameObjects.Rectangle;
	private gameOverTitle!: GameObjects.Text;
	private gameOverScore!: GameObjects.Text;
	private gameOverHint!: GameObjects.Text;
	private hudLives!: GameObjects.Text;
	private hudScore!: GameObjects.Text;
	private hudTime!: GameObjects.Text;
	private hudEnergy!: GameObjects.Text;
	private hudVimStatus!: GameObjects.Text;
	private gameAreaStartX: number = 0;

	constructor() { super('Game'); }

	private getInstructionText(): string {
		return [
			'VIM TOWER DEFENSE',
			'==================',
			'',
			'CONTROLS:',
			'h j k l - Move cursor',
			'i - Insert mode',
			'ESC - Normal mode',
			'v - Visual mode',
			'y - Copy in visual',
			'p - Paste',
			':wq    Clear screen (Ult)',
			':db    Back to Dashboard',
			':lb    View Leaderboard',
			'',
			'TOWERS:',
			'Sniper (slow, long range)',
			'Rapid (fast, short range)',
			'Wall (high HP, blocks)',
			'Pulse (AoE damage)',
			'',
			'GAMEPLAY:',
			'• Enemies target towers',
			'• Game ends when all',
			'  towers are destroyed',
			'• Copy towers after 10',
			'  kills to paste them',
			'',
			'TIP: Select entire tower',
			'pattern in visual mode',
			'to copy it!'
		].join('\n');
	}

	private gameOverCommand: string = '';

	create() {
		const cam = this.cameras.main;
		cam.setBackgroundColor('#16181d'); // Darker BG
		cam.setBounds(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

		// --- Measure font ---
		this.engine = new VimEngine();
		const tmp = this.add.text(0, 0, 'X'.repeat(50), { fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, resolution: 3 });
		this.fontWidth = tmp.width / 50;
		tmp.destroy();

		// Calculate layout
		const instructionPanelWidth = cam.width * 0.18; // 18% of screen width
		this.gameAreaStartX = instructionPanelWidth; // Start of game area after instruction panel

		// --- Instruction Panel (fills left area) ---
		this.instructionBg = this.add.rectangle(0, 0, instructionPanelWidth, cam.height, 0x1c1e26); // Darker Sidebar
		this.instructionBg.setOrigin(0, 0).setScrollFactor(0).setDepth(41);

		this.instructionText = this.add.text(15, 20, this.getInstructionText(), {
			fontFamily: 'monospace', fontSize: '14px', color: '#d8dee9', wordWrap: { width: instructionPanelWidth - 30, useAdvancedWrap: true }
		});
		this.instructionText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);

		// --- Clipboard Panel (fills right area) ---
		const clipboardPanelWidth = cam.width * 0.15; // 15% of screen width
		const clipboardX = cam.width - clipboardPanelWidth;
		this.clipboardBg = this.add.rectangle(clipboardX, 0, clipboardPanelWidth, cam.height, 0x1c1e26); // Darker Sidebar
		this.clipboardBg.setOrigin(0, 0).setScrollFactor(0).setDepth(41);

		this.clipboardTitle = this.add.text(clipboardX + 15, 20, 'CLIPBOARD', {
			fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#eceff4'
		});
		this.clipboardTitle.setOrigin(0, 0).setScrollFactor(0).setDepth(42);



		// --- Cursor ---
		this.cursorRect = this.add.rectangle(0, 0, this.fontWidth, FONT_HEIGHT, 0x0099ff, 0.5);
		this.cursorRect.setOrigin(0, 0).setDepth(10);

		// --- Visual Mode Highlight ---
		this.visualRect = this.add.rectangle(0, 0, 0, 0, 0xffff00, 0.3);
		this.visualRect.setOrigin(0, 0).setDepth(9).setVisible(false);

		// --- Line numbers ---
		const visibleLines = Math.ceil(cam.height / FONT_HEIGHT) + 2;
		for (let i = 0; i < visibleLines; i++) {
			const t = this.add.text(this.gameAreaStartX - this.fontWidth - 10, i * FONT_HEIGHT, '', {
				fontFamily: 'monospace', fontSize: `${FONT_HEIGHT}px`, color: '#4c566a', align: 'right', resolution: 3
			});
			t.setOrigin(1, 0).setScrollFactor(0, 1).setDepth(50);
			this.lineNumbers.push(t);
		}

		// --- Initialize systems ---
		this.gameState = new GameState();
		this.enemySystem = new EnemySystem(this, this.gameState, this.gameAreaStartX, this.fontWidth, FONT_HEIGHT);
		// Calculate game area columns to center towers
		const gameAreaWidth = cam.width - instructionPanelWidth - clipboardPanelWidth;
		const gameAreaCols = Math.floor(gameAreaWidth / this.fontWidth);
		const centerCol = Math.floor(gameAreaCols / 2);

		this.towerSystem = new TowerSystem(this, this.engine, this.gameAreaStartX, this.fontWidth, FONT_HEIGHT, this.gameState, centerCol);
		this.combatSystem = new CombatSystem(this, this.gameState, this.towerSystem);
		this.enemySystem.setTowerProvider(() => this.towerSystem.activeTowers);

		// --- Vim engine events ---
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
		this.add.rectangle(0, hudY, cam.width, HUD_HEIGHT, 0x1c1e26).setOrigin(0, 0).setDepth(100).setScrollFactor(0); // Darker HUD

		// Left section
		this.hudScore = this.add.text(30, hudY + 8, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', resolution: 3, color: '#d8dee9' }).setDepth(101).setScrollFactor(0);
		this.hudTime = this.add.text(180, hudY + 8, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', resolution: 3, color: '#d8dee9' }).setDepth(101).setScrollFactor(0);

		// Center section
		this.hudLives = this.add.text(cam.width / 2, hudY + 8, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', resolution: 3, color: '#bf616a' }).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);

		// Right section
		this.hudEnergy = this.add.text(cam.width - 250, hudY + 8, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#88c0d0', resolution: 3 }).setOrigin(1, 0).setDepth(101).setScrollFactor(0);
		this.hudVimStatus = this.add.text(cam.width - 30, hudY + 8, '-- NORMAL --', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ebcb8b', resolution: 3 }).setOrigin(1, 0).setDepth(101).setScrollFactor(0);

		this.engine.onStatusUpdate = (leftStatus: string, rightStatus: string) => {
			this.hudVimStatus.setText(`${leftStatus}   [${rightStatus}]`);
		};

		this.gameOverOverlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x000000, 0.8).setOrigin(0, 0).setDepth(300).setScrollFactor(0).setVisible(false);
		this.gameOverTitle = this.add.text(cam.width / 2, cam.height / 2 - 80, 'FATAL ERROR: VIM ARENA CRASHED', { fontFamily: '"Press Start 2P", monospace', fontSize: '24px', color: '#bf616a' }).setOrigin(0.5).setDepth(301).setScrollFactor(0).setVisible(false);
		this.gameOverScore = this.add.text(cam.width / 2, cam.height / 2 - 20, '', { fontFamily: '"Press Start 2P", monospace', fontSize: '18px', color: '#d8dee9' }).setOrigin(0.5).setDepth(301).setScrollFactor(0).setVisible(false);
		this.gameOverHint = this.add.text(cam.width / 2, cam.height / 2 + 150, 'Type :w to save score and exit, :q to exit without saving', {
			fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#88c0d0'
		}).setOrigin(0.5).setDepth(302).setScrollFactor(0).setVisible(false);

		// --- Input ---
		this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
			if (this.gameState.isGameOver) {
				if (event.key === 'Enter') {
					if (this.gameOverCommand === ':w') {
						this.saveScoreAndQuit();
					} else if (this.gameOverCommand === ':q') {
						this.quitToDashboard();
					}
					this.gameOverCommand = '';
				} else if (event.key === 'Backspace') {
					this.gameOverCommand = this.gameOverCommand.slice(0, -1);
				} else if (event.key.length === 1) {
					this.gameOverCommand += event.key;
				}
				
				// Update HUD with game over command
				this.hudVimStatus.setText(this.gameOverCommand || '--- GAME OVER ---');
				return;
			}

			// Prevent default browser scrolling for specific keys
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
				event.preventDefault();
			}
			this.engine.handleKeyDown(event);
		});

		// Initialize display
		this.renderText();
		this.engine.triggerCursorMoved();
	}

	update(_time: number, delta: number) {
		if (this.gameState.isGameOver) return;

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
		// Clean up deleted lines
		for (const [rowIndex, textObj] of this.rowTexts.entries()) {
			if (rowIndex >= this.engine.lines.length) {
				textObj.destroy();
				this.rowTexts.delete(rowIndex);
			}
		}

		for (let r = 0; r < this.engine.lines.length; r++) {
			const line = this.engine.lines[r] ?? '';
			let t = this.rowTexts.get(r);
			if (!t) {
				t = this.add.text(this.gameAreaStartX, r * FONT_HEIGHT, line, {
					fontFamily: '"Press Start 2P", monospace', fontSize: `${FONT_HEIGHT}px`, color: '#d8dee9', resolution: 3,
				});
				t.setOrigin(0, 0);
				this.rowTexts.set(r, t);
			} else {
				if (t.text !== line) {
					t.setText(line);
				}
			}
		}
	}

	// --- Cursor + camera scroll ----
	private updateCursorPosition() {
		this.cursorRect.x = this.gameAreaStartX + this.engine.cursorCol * this.fontWidth;
		this.cursorRect.y = this.engine.cursorRow * FONT_HEIGHT;

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
		const gameAreaWidth = cam.width - this.gameAreaStartX - (cam.width * 0.15);
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
	}

	// ---- Gutter line numbers ----
	private updateGutterLineNumbers() {
		const cursorRow = this.engine.cursorRow;
		for (let i = 0; i < this.lineNumbers.length; i++) {
			const row = this.firstVisibleRow + i;
			let display = '';
			if (row >= 0) {
				if (row === cursorRow) {
					display = row.toString();
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
		this.gameOverScore.setText(`SCORE DUMP: ${this.gameState.kills} KILLS`);
		this.gameOverOverlay.setFillStyle(0x2e3440, 0.95); // Nord Deep Background
		this.gameOverOverlay.setVisible(true);
		
		this.gameOverTitle.setText('!!! VIM ARENA KERNEL PANIC !!!');
		this.gameOverTitle.setColor('#bf616a'); // Nord Red
		this.gameOverTitle.setVisible(true);
		
		this.gameOverScore.setVisible(true);
		this.gameOverHint.setVisible(true);

		const cam = this.cameras.main;
		const centerX = cam.width / 2;
		
		// Add some "error dump" text lines
		const errorLines = [
			`[${Date.now()}] ERROR: All defensive buffers cleared.`,
			`[${Date.now() + 12}] STACK TRACE: main.ts -> TowerSystem.ts -> NULL_POINTER`,
			`[${Date.now() + 45}] VIM_SIGNAL: Caught deadly signal SEGV`,
			`[${Date.now() + 89}] MEM_DUMP: ${'0x' + Math.random().toString(16).slice(2, 10).toUpperCase()}`
		];

		errorLines.forEach((line, i) => {
			this.add.text(centerX, cam.height / 2 - 150 + (i * 15), line, {
				fontFamily: 'monospace', fontSize: '10px', color: '#4c566a'
			}).setOrigin(0.5).setDepth(301).setScrollFactor(0);
		});

		try {
			const response = await fetch(`${import.meta.env.VITE_API_URL}/scores`);
			const topScores = await response.json();

			let leaderboardText = "--- TOP SCORES (SYSTEM PROCESSES) ---\n\n";
			leaderboardText += "RANK   PID    USER    SCORE\n";
			leaderboardText += "----------------------------\n";
			topScores.forEach((entry: any, index: number) => {
				const pid = Math.floor(Math.random() * 9000) + 1000;
				leaderboardText += `${(index + 1).toString().padStart(2, ' ')}   ${pid}   ${entry.playerName.padEnd(5, ' ')}   ${entry.score.toString().padStart(5, ' ')}\n`;
			});

			const lbText = this.add.text(centerX, cam.height / 2 + 50, leaderboardText, {
				fontFamily: 'monospace', fontSize: '12px', color: '#88c0d0', align: 'center', lineSpacing: 5
			}).setOrigin(0.5, 0).setDepth(302).setScrollFactor(0);

			this.gameOverHint.y = lbText.y + lbText.height + 40;
			this.gameOverHint.setText('Type :w to submit dump, :q to abort');
		} catch (error) {
			console.error('Failed to fetch leaderboard:', error);
		}
	}

	private async saveScoreAndQuit() {
		this.gameOverHint.setText('Saving score...');
		let playerName = (window as any).googlePlayerName || "VIM";
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
		const clipboard = this.towerSystem.clipboard;
		const cam = this.cameras.main;
		const clipboardPanelWidth = Math.floor(cam.width * 0.15);
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
				const patternStr = entry.towerType.pattern.join('\n');

				const cost = clipboard.getEntryCost(entry);
				const statStr = cost > 0 ? ` (${entry.currentKills}/${cost})` : '';

				const entryText = this.add.text(clipboardX + 10, y,
					`[${i + 1}p] ${entry.towerType.name}${statStr}\n${patternStr}`,
					{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#d4d4d4' }
				);
				entryText.setOrigin(0, 0).setScrollFactor(0).setDepth(42);
				this.clipboardEntries.push(entryText);
				y += 100 + (entry.towerType.pattern.length * 10);
			}
		}
	}
}
