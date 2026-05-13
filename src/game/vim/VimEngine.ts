type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL' | 'COMMAND';

export class VimEngine {
	public cursorCol: number = 0;
	public cursorRow: number = 0;
	public lines: string[] = Array(30).fill('');
	public mode: VimMode = 'NORMAL';
	public commandCount: number = 0;
	public pendingOperator: 'd' | 'y' | 'c' | null = null;
	public pendingAction: 'r' | 'f' | 'F' | 't' | 'T' | 'g' | null = null;
	public visualStart: { col: number; row: number } | null = null;
	public commandBuffer: string = '';
	public pendingRegister: string | null = null;

	// hjkl keys currently held — enables diagonal movement on simultaneous press
	private pressedMovementKeys: Set<string> = new Set();

	// Cells populated by background word generation (not typed by the player)
	public backgroundCells: Set<string> = new Set();

	public isBackground(row: number, col: number): boolean {
		return this.backgroundCells.has(`${row},${col}`);
	}

	public getViewport?: () => { startCol: number; endCol: number; startRow: number; endRow: number };
	public onUltimate?: () => void;
	public onRenderRow?: (row: number) => void;
	public onRenderAll?: () => void;
	public onCursorMoved?: () => void;
	public onStatusUpdate?: (left: string, right: string) => void;
	public onPaste?: (row: number, col: number, register: string) => void;
	public onYank?: (pattern: string[], register: string) => void;
	public onQuit?: () => void;
	public onLeaderboard?: () => void;
	public onCommand?: (cmd: string) => void;

	// Educational hooks for CombatSystem
	public onAction?: (action: 'delete' | 'change' | 'yank', start: { row: number; col: number }, end: { row: number; col: number }) => void;
	public onMotion?: (type: string, from: { row: number; col: number }, to: { row: number; col: number }) => void;
	public onSearch?: (query: string) => void;
	public onEnergyCost?: (amount: number) => boolean;

	public handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			this.pressedMovementKeys.clear();
			this.pendingOperator = null;
			this.pendingAction = null;
			this.commandCount = 0;
			this.setMode('NORMAL');
			this.triggerCursorMoved();
			return;
		}

		// Arrow keys work in every mode
		switch (event.key) {
			case 'ArrowUp':    this.cursorRow = Math.max(0, this.cursorRow - 1); this.triggerCursorMoved(); return;
			case 'ArrowDown':  if (this.cursorRow >= this.lines.length - 1) this.lines.push(''); this.cursorRow++; this.triggerCursorMoved(); return;
			case 'ArrowLeft':  this.cursorCol = Math.max(0, this.cursorCol - 1); this.triggerCursorMoved(); return;
			case 'ArrowRight': this.cursorCol++; this.triggerCursorMoved(); return;
		}

		if (this.mode === 'INSERT')  { this.handleInsertMode(event);  return; }
		if (this.mode === 'COMMAND') { this.handleCommandMode(event); return; }

		// NORMAL / VISUAL — track held movement keys for diagonal support
		if ('hjkl'.includes(event.key) && event.key.length === 1) {
			this.pressedMovementKeys.add(event.key);
		}
		this.handleNormalMode(event);
	}

	public handleKeyUp(event: KeyboardEvent): void {
		this.pressedMovementKeys.delete(event.key);
	}

	private handleInsertMode(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			this.cursorRow++;
		} else if (event.key === 'Backspace') {
			if (this.cursorCol > 0) {
				this.deleteText(this.cursorCol - 1, this.cursorRow, 1);
				this.cursorCol--;
			}
		} else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			this.replaceChar(this.cursorCol, this.cursorRow, event.key);
			this.cursorCol++;
		}
		this.triggerCursorMoved();
	}

	private handleCommandMode(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			if (this.onCommand) this.onCommand(this.commandBuffer);

			if      (this.commandBuffer === ':ultimate' || this.commandBuffer === ':ult') this.onUltimate?.();
			else if (this.commandBuffer === ':wq' || this.commandBuffer === ':q!' || this.commandBuffer === ':db')  this.onQuit?.();
			else if (this.commandBuffer === ':lb')  this.onLeaderboard?.();
			else if (this.commandBuffer.startsWith('/')) {
				this.onSearch?.(this.commandBuffer.substring(1));
			}
			this.commandBuffer = '';
			this.setMode('NORMAL');
		} else if (event.key === 'Backspace') {
			this.commandBuffer = this.commandBuffer.slice(0, -1);
			if (this.commandBuffer.length === 0) {
				this.setMode('NORMAL');
			} else {
				this.updateStatusBar();
			}
		} else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			this.commandBuffer += event.key;
			this.updateStatusBar();
		}
	}

	private handleNormalMode(event: KeyboardEvent): void {
		const key = event.key;

		if (this.pendingRegister === '"') {
			if (/^[a-z]$/.test(key)) {
				this.pendingRegister = key;
				this.updateStatusBar();
				return;
			} else {
				this.pendingRegister = null;
			}
		}

		if (key === '"') {
			this.pendingRegister = '"';
			this.updateStatusBar();
			return;
		}

		if (this.pendingAction === 'r') {
			if (key.length === 1 && !event.ctrlKey) {
				const count = this.commandCount || 1;
				const limit = Math.min(count, (this.lines[this.cursorRow] || '').length - this.cursorCol);
				for (let i = 0; i < limit; i++) this.replaceChar(this.cursorCol + i, this.cursorRow, key);
			}
			this.pendingAction = null;
			this.commandCount = 0;
			this.updateStatusBar();
			this.triggerCursorMoved();
			return;
		}

		if (this.pendingAction === 'g') {
			if (key === 'g') {
				this.cursorRow = 0;
				this.cursorCol = 0;
			}
			this.pendingAction = null;
			this.commandCount = 0;
			this.updateStatusBar();
			this.triggerCursorMoved();
			return;
		}

		if (this.pendingAction && ['f', 'F', 't', 'T'].includes(this.pendingAction)) {
			if (key.length === 1 && !event.ctrlKey) {
				const count = this.commandCount || 1;
				let found = 0;
				const line = this.lines[this.cursorRow] || '';
				const action = this.pendingAction;
				if (action === 'f' || action === 't') {
					for (let i = this.cursorCol + 1; i < line.length; i++) {
						if (line[i] === key && ++found === count) {
							this.cursorCol = (action === 'f') ? i : i - 1;
							break;
						}
					}
				} else {
					for (let i = this.cursorCol - 1; i >= 0; i--) {
						if (line[i] === key && ++found === count) {
							this.cursorCol = (action === 'F') ? i : i + 1;
							break;
						}
					}
				}
			}
			this.pendingAction = null;
			this.commandCount = 0;
			this.updateStatusBar();
			this.triggerCursorMoved();
			return;
		}

		// Digit: accumulate count, except leading `0` which is the go-to-col-0 motion
		if (/^[0-9]$/.test(key)) {
			if (this.commandCount === 0 && key === '0') {
				this.cursorCol = 0;
				this.updateStatusBar();
				this.triggerCursorMoved();
			} else {
				this.commandCount = this.commandCount * 10 + parseInt(key);
				this.updateStatusBar();
			}
			return;
		}

		const count = this.commandCount || 1;
		let clearState = true;

		switch (key) {
			case ':':
			case '/':
				this.setMode('COMMAND');
				this.commandBuffer = key;
				clearState = false;
				break;

			case 'i': this.setMode('INSERT'); break;
			case 'v': this.setMode('VISUAL'); break;

			case 'I': {
				const line = this.lines[this.cursorRow] || '';
				let i = 0;
				while (i < line.length && /\s/.test(line[i])) i++;
				this.cursorCol = i;
				this.setMode('INSERT');
				break;
			}

			case 'a':
				this.cursorCol++;
				this.setMode('INSERT');
				break;

			case 'A':
				this.cursorCol = (this.lines[this.cursorRow] || '').length;
				this.setMode('INSERT');
				break;

			case 'O':
				this.cursorRow = Math.max(0, this.cursorRow - count);
				this.cursorCol = 0;
				this.setMode('INSERT');
				break;

			case 'o':
				this.cursorRow += count;
				while (this.lines.length <= this.cursorRow) this.lines.push('');
				this.cursorCol = 0;
				this.setMode('INSERT');
				break;

			case 'x': {
				const n = Math.min((this.lines[this.cursorRow] || '').length - this.cursorCol, count);
				if (n > 0) this.deleteText(this.cursorCol, this.cursorRow, n);
				break;
			}

			case 's': {
				const n = Math.min((this.lines[this.cursorRow] || '').length - this.cursorCol, count);
				if (n > 0) this.deleteText(this.cursorCol, this.cursorRow, n);
				this.setMode('INSERT');
				break;
			}

			case 'g': this.pendingAction = 'g'; clearState = false; break;
			
			case 'G': {
				let last = this.lines.length - 1;
				while (last > 0 && this.lines[last].trim() === '') last--;
				this.cursorRow = Math.max(0, last);
				this.cursorCol = 0;
				break;
			}

			case '^': {
				const line = this.lines[this.cursorRow] || '';
				let c = 0;
				while (c < line.length && line[c] === ' ') c++;
				this.cursorCol = c;
				break;
			}

			case 'D': {
				const line = this.lines[this.cursorRow] || '';
				const viewport = this.getViewport ? this.getViewport() : null;
				let end = line.length;
				if (viewport) end = Math.min(end, viewport.endCol);
				if (this.cursorCol < end) {
					const n = end - this.cursorCol;
					this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + ' '.repeat(n) + line.slice(end);
					for (let i = this.cursorCol; i < end; i++) this.backgroundCells.delete(`${this.cursorRow},${i}`);
					this.onRenderRow?.(this.cursorRow);
				}
				break;
			}

			case 'C': {
				const line = this.lines[this.cursorRow] || '';
				const viewport = this.getViewport ? this.getViewport() : null;
				let end = line.length;
				if (viewport) end = Math.min(end, viewport.endCol);
				if (this.cursorCol < end) {
					const n = end - this.cursorCol;
					this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + ' '.repeat(n) + line.slice(end);
					for (let i = this.cursorCol; i < end; i++) this.backgroundCells.delete(`${this.cursorRow},${i}`);
					this.onRenderRow?.(this.cursorRow);
				}
				this.setMode('INSERT');
				break;
			}

			case 'r': this.pendingAction = 'r'; clearState = false; break;
			case 'f': this.pendingAction = 'f'; clearState = false; break;
			case 'F': this.pendingAction = 'F'; clearState = false; break;
			case 't': this.pendingAction = 't'; clearState = false; break;
			case 'T': this.pendingAction = 'T'; clearState = false; break;

			case 'H': {
				const view = this.getViewport ? this.getViewport() : null;
				if (view) this.cursorRow = view.startRow;
				break;
			}
			case 'M': {
				const view = this.getViewport ? this.getViewport() : null;
				if (view) this.cursorRow = Math.floor((view.startRow + view.endRow) / 2);
				break;
			}
			case 'L': {
				const view = this.getViewport ? this.getViewport() : null;
				if (view) this.cursorRow = view.endRow - 1;
				break;
			}

			case 'd':
			case 'c':
				if (this.mode === 'VISUAL' && this.visualStart) {
					const sr = Math.min(this.visualStart.row, this.cursorRow);
					const er = Math.max(this.visualStart.row, this.cursorRow);
					const sc = Math.min(this.visualStart.col, this.cursorCol);
					const ec = Math.max(this.visualStart.col, this.cursorCol);
					for (let r = sr; r <= er; r++) {
						const line = this.lines[r] || '';
						if (sc < line.length) {
							const n = Math.max(0, Math.min(ec + 1, line.length) - sc);
							if (n > 0) this.lines[r] = line.slice(0, sc) + ' '.repeat(n) + line.slice(sc + n);
						}
					}
					this.onRenderAll?.();
					this.onAction?.(key === 'c' ? 'change' : 'delete', { row: sr, col: sc }, { row: er, col: ec });
					this.cursorRow = sr;
					this.cursorCol = sc;
					this.setMode(key === 'c' ? 'INSERT' : 'NORMAL');
				} else if (this.pendingOperator === key) {
					const viewport = this.getViewport ? this.getViewport() : null;
					let totalToDelete = 0;
					for (let i = 0; i < count; i++) {
						const row = this.cursorRow + i;
						if (row < this.lines.length) {
							const line = this.lines[row] || '';
							if (viewport) {
								const start = Math.max(0, viewport.startCol);
								const end = Math.min(line.length, viewport.endCol);
								totalToDelete += Math.max(0, end - start);
							} else {
								totalToDelete += line.length;
							}
						}
					}

					if (this.onEnergyCost && !this.onEnergyCost(totalToDelete)) {
						this.pendingOperator = null;
						this.commandCount = 0;
						this.updateStatusBar();
						return;
					}

					for (let i = 0; i < count; i++) {
						const row = this.cursorRow + i;
						if (row < this.lines.length) {
							if (viewport) {
								const line = this.lines[row] || '';
								const start = Math.max(0, viewport.startCol);
								const end = Math.min(line.length, viewport.endCol);
								if (end > start) {
									const n = end - start;
									this.lines[row] = line.slice(0, start) + ' '.repeat(n) + line.slice(end);
									for (let c = start; c < end; c++) this.backgroundCells.delete(`${row},${c}`);
								}
							} else {
								this.lines[row] = '';
							}
						}
					}
					this.onAction?.(key === 'c' ? 'change' : 'delete', { row: this.cursorRow, col: 0 }, { row: this.cursorRow + count - 1, col: 999 });
					this.onRenderAll?.();
					if (key === 'c') {
						this.cursorCol = 0;
						this.setMode('INSERT');
					}
					this.pendingOperator = null;
					this.commandCount = 0;
					clearState = false;
				} else {
					this.pendingOperator = key;
					clearState = false;
				}
				break;

			case 'y':
				if (this.mode === 'VISUAL' && this.visualStart) {
					const sr = Math.min(this.visualStart.row, this.cursorRow);
					const er = Math.max(this.visualStart.row, this.cursorRow);
					const sc = Math.min(this.visualStart.col, this.cursorCol);
					const ec = Math.max(this.visualStart.col, this.cursorCol);
					const pattern: string[] = [];
					for (let r = sr; r <= er; r++) {
						const line = (this.lines[r] || '').padEnd(ec + 1, ' ');
						pattern.push(line.slice(sc, ec + 1));
					}
					this.onYank?.(pattern, this.pendingRegister || '"');
					this.pendingRegister = null;
					this.setMode('NORMAL');
				} else if (this.pendingOperator === key) {
					this.pendingOperator = null;
					this.commandCount = 0;
					clearState = false;
				} else {
					this.pendingOperator = key;
					clearState = false;
				}
				break;

			case 'p':
				this.onPaste?.(this.cursorRow, this.cursorCol + 1, this.pendingRegister || '"');
				this.pendingRegister = null;
				this.updateStatusBar();
				break;
			case 'P':
				this.onPaste?.(this.cursorRow, this.cursorCol, this.pendingRegister || '"');
				this.pendingRegister = null;
				this.updateStatusBar();
				break;

			case 'h':
			case 'j':
			case 'k':
			case 'l':
			case 'w':
			case 'b':
			case 'e':
			case '$': {
				const startCol = this.cursorCol;
				const startRow = this.cursorRow;

				for (let i = 0; i < count; i++) {
					if ('hjkl'.includes(key)) {
						if (this.pressedMovementKeys.has('h')) this.cursorCol = Math.max(0, this.cursorCol - 1);
						if (this.pressedMovementKeys.has('l')) this.cursorCol++;
						if (this.pressedMovementKeys.has('k')) this.cursorRow = Math.max(0, this.cursorRow - 1);
						if (this.pressedMovementKeys.has('j')) {
							if (this.cursorRow >= this.lines.length - 1) this.lines.push('');
							this.cursorRow++;
						}
					} else if (key === 'w') this.moveForwardWord();
					else if (key === 'b') this.moveBackwardWord();
					else if (key === 'e') this.moveEndWord();
					else if (key === '$') {
						const viewport = this.getViewport ? this.getViewport() : null;
						let end = (this.lines[this.cursorRow] || '').length - 1;
						if (viewport) end = Math.min(end, Math.max(0, viewport.endCol - 1));
						this.cursorCol = Math.max(0, end);
					}
				}

				if (this.pendingOperator === 'd' || this.pendingOperator === 'c') {
					let totalToDelete = 0;
					const op = this.pendingOperator;
					if (startRow === this.cursorRow) {
						const c1 = Math.min(startCol, this.cursorCol);
						let c2 = Math.max(startCol, this.cursorCol);
						if (key === 'e' || key === '$' || key === 'l') c2++;
						const line = this.lines[startRow] || '';
						totalToDelete = Math.max(0, Math.min(c2, line.length) - c1);
					} else {
						const minRow = Math.min(startRow, this.cursorRow);
						const maxRow = Math.max(startRow, this.cursorRow);
						for (let r = minRow; r <= maxRow; r++) {
							const line = this.lines[r] || '';
							let c1 = 0, c2 = line.length;
							if (r === startRow)      { if (startRow < this.cursorRow) c1 = startCol; else c2 = startCol; }
							if (r === this.cursorRow) { if (this.cursorRow < startRow) c1 = this.cursorCol; else c2 = this.cursorCol; }
							if (r === this.cursorRow && (key === 'e' || key === '$' || key === 'l')) c2++;
							totalToDelete += Math.max(0, Math.min(c2, line.length) - c1);
						}
					}

					if (this.onEnergyCost && !this.onEnergyCost(totalToDelete)) {
						this.pendingOperator = null;
						this.commandCount = 0;
						// Reset cursor position to where it was
						this.cursorCol = startCol;
						this.cursorRow = startRow;
						this.updateStatusBar();
						return;
					}

					this.onAction?.(op === 'c' ? 'change' : 'delete', 
						{ row: Math.min(startRow, this.cursorRow), col: Math.min(startCol, this.cursorCol) },
						{ row: Math.max(startRow, this.cursorRow), col: Math.max(startCol, this.cursorCol) }
					);
					if (startRow === this.cursorRow) {
						const c1 = Math.min(startCol, this.cursorCol);
						let c2 = Math.max(startCol, this.cursorCol);
						if (key === 'e' || key === '$' || key === 'l') c2++;
						const line = this.lines[startRow] || '';
						const n = Math.max(0, Math.min(c2, line.length) - c1);
						if (n > 0) {
							for (let i = c1; i < c1 + n; i++) this.backgroundCells.delete(`${startRow},${i}`);
							this.lines[startRow] = line.slice(0, c1) + ' '.repeat(n) + line.slice(c1 + n);
							this.onRenderRow?.(startRow);
						}
						this.cursorCol = c1;
					} else {
						const minRow = Math.min(startRow, this.cursorRow);
						const maxRow = Math.max(startRow, this.cursorRow);
						if (key === 'j' || key === 'k') {
							for (let r = minRow; r <= maxRow; r++) this.lines[r] = '';
						} else {
							for (let r = minRow; r <= maxRow; r++) {
								const line = this.lines[r] || '';
								let c1 = 0, c2 = line.length;
								if (r === startRow)      { if (startRow < this.cursorRow) c1 = startCol; else c2 = startCol; }
								if (r === this.cursorRow) { if (this.cursorRow < startRow) c1 = this.cursorCol; else c2 = this.cursorCol; }
								if (r === this.cursorRow && (key === 'e' || key === '$' || key === 'l')) c2++;
								const n = Math.max(0, Math.min(c2, line.length) - c1);
								if (n > 0) {
									for (let i = c1; i < c1 + n; i++) this.backgroundCells.delete(`${r},${i}`);
									this.lines[r] = line.slice(0, c1) + ' '.repeat(n) + line.slice(c1 + n);
								}
							}
							if (minRow === startRow) this.cursorCol = startCol;
						}
						this.cursorRow = minRow;
						this.onRenderAll?.();
					}
					if (this.pendingOperator === 'c') this.setMode('INSERT');
					this.pendingOperator = null;
				} else {
					this.onMotion?.(key, { row: startRow, col: startCol }, { row: this.cursorRow, col: this.cursorCol });
				}
				break;
			}
		}

		if (clearState) {
			this.commandCount = 0;
			this.pendingOperator = null;
			this.pendingAction = null;
			this.updateStatusBar();
		}

		this.triggerCursorMoved();
		this.updateStatusBar();
	}

	// Used by TowerSystem to erase characters when a tower dies
	public setChar(col: number, row: number, char: string): void {
		while (this.lines.length <= row) this.lines.push('');
		let line = this.lines[row] || '';
		if (col > line.length) line = line.padEnd(col, ' ');
		this.lines[row] = line.slice(0, col) + char + line.slice(col + 1);
		this.backgroundCells.delete(`${row},${col}`);
		this.onRenderRow?.(row);
	}

	private replaceChar(col: number, row: number, char: string): void {
		while (this.lines.length <= row) this.lines.push('');
		let line = this.lines[row] || '';
		if (col > line.length) line = line.padEnd(col, ' ');
		this.lines[row] = line.slice(0, col) + char + line.slice(col + 1);
		this.backgroundCells.delete(`${row},${col}`);
		this.onRenderRow?.(row);
	}

	private deleteText(col: number, row: number, count: number): void {
		if (row >= this.lines.length) return;
		const line = this.lines[row] || '';
		if (col >= line.length) return;
		const n = Math.min(count, line.length - col);
		for (let i = col; i < col + n; i++) this.backgroundCells.delete(`${row},${i}`);
		this.lines[row] = line.slice(0, col) + ' '.repeat(n) + line.slice(col + n);
		this.onRenderRow?.(row);
	}

	private getCharType(c: string): number {
		if (!c)           return -1;
		if (/\s/.test(c)) return 0;
		if (/^\w$/.test(c)) return 1;
		return 2;
	}

	private moveForwardWord(): void {
		let line = this.lines[this.cursorRow] || '';
		if (this.cursorCol >= line.length - 1) {
			if (this.cursorRow < this.lines.length - 1) {
				this.cursorRow++;
				this.cursorCol = 0;
				line = this.lines[this.cursorRow] || '';
				while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;
			}
			return;
		}
		const t = this.getCharType(line[this.cursorCol]);
		while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === t) this.cursorCol++;
		while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;
		if (this.cursorCol >= line.length && this.cursorRow < this.lines.length - 1) {
			this.cursorRow++;
			this.cursorCol = 0;
			line = this.lines[this.cursorRow] || '';
			while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;
		} else {
			this.cursorCol = Math.max(0, Math.min(this.cursorCol, line.length - 1));
		}
	}

	private moveBackwardWord(): void {
		let line = this.lines[this.cursorRow] || '';
		if (this.cursorCol <= 0) {
			this.cursorCol = 0;
			return;
		}
		this.cursorCol--;
		while (this.cursorCol > 0 && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol--;
		const t = this.getCharType(line[this.cursorCol]);
		while (this.cursorCol > 0 && this.getCharType(line[this.cursorCol - 1]) === t) this.cursorCol--;
	}

	private moveEndWord(): void {
		let line = this.lines[this.cursorRow] || '';
		if (this.cursorCol >= line.length - 1) {
			if (this.cursorRow < this.lines.length - 1) {
				this.cursorRow++;
				this.cursorCol = 0;
				line = this.lines[this.cursorRow] || '';
			} else return;
		} else {
			this.cursorCol++;
		}
		while (this.cursorCol < line.length - 1 && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;
		const t = this.getCharType(line[this.cursorCol]);
		while (this.cursorCol < line.length - 1 && this.getCharType(line[this.cursorCol + 1]) === t) this.cursorCol++;
	}

	private setMode(newMode: VimMode): void {
		this.mode = newMode;
		this.visualStart = newMode === 'VISUAL' ? { col: this.cursorCol, row: this.cursorRow } : null;
		this.updateStatusBar();
	}

	private updateStatusBar(): void {
		let left: string;
		if (this.mode === 'COMMAND') {
			left = this.commandBuffer;
		} else {
			left = `-- ${this.mode} --`;
			if (this.commandCount > 0)   left += `  ${this.commandCount}`;
			if (this.pendingRegister)     left += ` "${this.pendingRegister}`;
			if (this.pendingOperator)     left += this.pendingOperator;
		}
		this.onStatusUpdate?.(left, `${this.cursorRow + 1},${this.cursorCol + 1}`);
	}

	public triggerCursorMoved(): void {
		this.onCursorMoved?.();
		this.updateStatusBar();
	}
}
