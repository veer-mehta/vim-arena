import { VimMode } from './VimState';

export class VimEngine {
	public cursorCol: number = 0;
	public cursorRow: number = 0;
	public lines: string[] = Array(30).fill('');
	public mode: VimMode = 'NORMAL';
	public commandCount: number = 0;
	public pendingOperator: 'd' | 'y' | 'c' | null = null;
	public pendingAction: 'r' | 'f' | 'F' | 't' | 'T' | null = null;
	public visualStart: {col: number, row: number} | null = null;

	// View callbacks
	public onRenderRow?: (row: number) => void;
	public onRenderAll?: () => void;
	public onCursorMoved?: () => void;
	public onStatusUpdate?: (leftStatus: string, rightStatus: string) => void;
	public onPaste?: (row: number, col: number, index: number) => void;
	public onYank?: (pattern: string[]) => void;

	public handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			this.setMode('NORMAL');
			this.commandCount = 0;
			this.pendingOperator = null;
			this.pendingAction = null;
			this.triggerCursorMoved();
			return;
		}

		// Standard Arrow Key Navigation (works in all modes)
		if (event.key === 'ArrowUp') {
			this.cursorRow = Math.max(0, this.cursorRow - 1);
			this.triggerCursorMoved();
			return;
		} else if (event.key === 'ArrowDown') {
			this.cursorRow++;
			this.triggerCursorMoved();
			return;
		} else if (event.key === 'ArrowLeft') {
			this.cursorCol = Math.max(0, this.cursorCol - 1);
			this.triggerCursorMoved();
			return;
		} else if (event.key === 'ArrowRight') {
			this.cursorCol++;
			this.triggerCursorMoved();
			return;
		}

		if (this.mode === 'INSERT') {
			this.handleInsertMode(event);
			return;
		}

		if (this.mode === 'NORMAL' || this.mode === 'VISUAL') {
			this.handleNormalMode(event);
		}
	}

	private handleInsertMode(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			this.cursorRow++;
			this.cursorCol = 0;
			this.triggerCursorMoved();
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

	private handleNormalMode(event: KeyboardEvent) {
		const key = event.key;

		// Handle pending action `r` (replace)
		if (this.pendingAction === 'r') {
			if (key.length === 1 && !event.ctrlKey) {
				const count = this.commandCount === 0 ? 1 : this.commandCount;
				const limit = Math.min(count, (this.lines[this.cursorRow] || '').length - this.cursorCol);
				for (let i = 0; i < limit; i++) {
					this.replaceChar(this.cursorCol + i, this.cursorRow, key);
				}
			}
			this.resetState();
			this.triggerCursorMoved();
			return;
		}

		// Handle pending action `f` (find)
		if (this.pendingAction === 'f') {
			if (key.length === 1 && !event.ctrlKey) {
				const count = this.commandCount === 0 ? 1 : this.commandCount;
				let foundCount = 0;
				let line = this.lines[this.cursorRow] || '';
				for (let i = this.cursorCol + 1; i < line.length; i++) {
					if (line[i] === key) {
						foundCount++;
						if (foundCount === count) {
							this.cursorCol = i;
							break;
						}
					}
				}
			}
			this.resetState();
			this.triggerCursorMoved();
			return;
		}

		// Accrue command counts
		if (/^[0-9]$/.test(key)) {
			if (this.commandCount === 0 && key === '0') {
				// Special motion `0`
				this.cursorCol = 0;
				this.updateStatusBar();
				this.triggerCursorMoved();
				return;
			} else {
				this.commandCount = this.commandCount * 10 + parseInt(key);
				this.updateStatusBar();
				return;
			}
		}

		const count = this.commandCount === 0 ? 1 : this.commandCount;
		let clearState = true;

		switch (key) {
			case 'i': this.setMode('INSERT'); break;
			case 'I':
				let lineStr = this.lines[this.cursorRow] || '';
				let firstNonBlank = 0;
				while (firstNonBlank < lineStr.length && /\s/.test(lineStr[firstNonBlank])) firstNonBlank++;
				this.cursorCol = firstNonBlank;
				this.setMode('INSERT');
				break;
			case 'v': this.setMode('VISUAL'); break;
			case 'O':
				for (let i = 0; i < count; i++) {
					while (this.lines.length <= this.cursorRow) this.lines.push('');
					this.lines.splice(this.cursorRow, 0, '');
				}
				this.triggerRenderAll();
				this.cursorCol = 0;
				this.setMode('INSERT');
				break;
			case 'o':
				for (let i = 0; i < count; i++) {
					while (this.lines.length <= this.cursorRow) this.lines.push('');
					this.lines.splice(this.cursorRow + 1, 0, '');
				}
				this.triggerRenderAll();
				this.cursorRow++;
				this.cursorCol = 0;
				this.setMode('INSERT');
				break;
			case 'a':
				this.cursorCol++;
				this.setMode('INSERT');
				break;
			case 'A':
				this.cursorCol = (this.lines[this.cursorRow] || '').length;
				this.setMode('INSERT');
				break;
			case 'x':
				const delCount = Math.min((this.lines[this.cursorRow] || '').length - this.cursorCol, count);
				if (delCount > 0) this.deleteText(this.cursorCol, this.cursorRow, delCount);
				break;
			case 's':
				const subCount = Math.min((this.lines[this.cursorRow] || '').length - this.cursorCol, count);
				if (subCount > 0) this.deleteText(this.cursorCol, this.cursorRow, subCount);
				this.setMode('INSERT');
				break;
			case 'r': this.pendingAction = 'r'; clearState = false; break;
			case 'f': this.pendingAction = 'f'; clearState = false; break;
			case 'd':
			case 'c':
				if (this.pendingOperator === key) {
					// Linewise operator
					const countToModify = count === 0 ? 1 : count;
					for (let i = 0; i < countToModify; i++) {
						if (this.cursorRow + i < this.lines.length) {
							this.lines[this.cursorRow + i] = '';
						}
					}
					this.triggerRenderAll();
					this.pendingOperator = null;
					this.commandCount = 0;
					clearState = false; // logic resolved
				} else {
					this.pendingOperator = key;
					clearState = false;
				}
				break;
			case 'y':
				if (this.mode === 'VISUAL' && this.visualStart) {
					const startRow = Math.min(this.visualStart.row, this.cursorRow);
					const endRow = Math.max(this.visualStart.row, this.cursorRow);
					const startCol = Math.min(this.visualStart.col, this.cursorCol);
					const endCol = Math.max(this.visualStart.col, this.cursorCol);
					
					const pattern: string[] = [];
					for (let r = startRow; r <= endRow; r++) {
						let line = this.lines[r] || '';
						if (line.length < endCol + 1) line = line.padEnd(endCol + 1, ' ');
						pattern.push(line.slice(startCol, endCol + 1));
					}
					
					if (this.onYank) {
						this.onYank(pattern);
					}
					
					this.setMode('NORMAL');
					clearState = true;
				} else if (this.pendingOperator === key) {
					// Linewise operator (we don't strictly implement clipboard text yet)
					this.pendingOperator = null;
					this.commandCount = 0;
					clearState = false;
				} else {
					this.pendingOperator = key;
					clearState = false;
				}
				break;
			case 'p':
				if (this.onPaste) {
					this.onPaste(this.cursorRow, this.cursorCol, this.commandCount === 0 ? 0 : this.commandCount - 1);
				}
				this.commandCount = 0;
				clearState = false;
				break;
			case 'h':
			case 'j':
			case 'k':
			case 'l':
			case 'w':
			case 'b':
			case 'e':
			case '$':
			case '0':
				// Motions
				for (let i = 0; i < count; i++) {
					if (key === 'h') this.cursorCol = Math.max(0, this.cursorCol - 1);
					else if (key === 'j') this.cursorRow++;
					else if (key === 'k') this.cursorRow = Math.max(0, this.cursorRow - 1);
					else if (key === 'l') this.cursorCol++;
					else if (key === 'w') this.moveForwardWord();
					else if (key === 'b') this.moveBackwardWord();
					else if (key === 'e') this.moveEndWord();
					else if (key === '$') this.cursorCol = Math.max(0, (this.lines[this.cursorRow] || '').length - 1);
					else if (key === '0') this.cursorCol = 0;
				}

				if (this.pendingOperator) {
					this.pendingOperator = null;
					clearState = true;
				}
				break;
		}

		if (clearState) {
			this.resetState();
		}

		this.triggerCursorMoved();
		this.updateStatusBar();
	}

	private resetState() {
		this.commandCount = 0;
		this.pendingOperator = null;
		this.pendingAction = null;
		this.updateStatusBar();
	}

	private getCharType(c: string) {
		if (!c) return -1;
		if (/\s/.test(c)) return 0;
		if (/^\w$/.test(c)) return 1;
		return 2;
	}

	private moveForwardWord() {
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

		const currentType = this.getCharType(line[this.cursorCol]);
		while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === currentType) this.cursorCol++;
		while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;

		if (this.cursorCol >= line.length) {
			if (this.cursorRow < this.lines.length - 1) {
				this.cursorRow++;
				this.cursorCol = 0;
				line = this.lines[this.cursorRow] || '';
				while (this.cursorCol < line.length && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;
			} else {
				this.cursorCol = Math.max(0, line.length - 1);
			}
		}
	}

	private moveBackwardWord() {
		let line = this.lines[this.cursorRow] || '';

		if (this.cursorCol <= 0) {
			if (this.cursorRow > 0) {
				this.cursorRow--;
				line = this.lines[this.cursorRow] || '';
				this.cursorCol = Math.max(0, line.length - 1);
			} else {
				return;
			}
		} else {
			this.cursorCol--;
		}

		while (this.cursorCol > 0 && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol--;
		const targetType = this.getCharType(line[this.cursorCol]);
		while (this.cursorCol > 0 && this.getCharType(line[this.cursorCol - 1]) === targetType) this.cursorCol--;
	}

	private moveEndWord() {
		let line = this.lines[this.cursorRow] || '';

		if (this.cursorCol >= line.length - 1) {
			if (this.cursorRow < this.lines.length - 1) {
				this.cursorRow++;
				this.cursorCol = 0;
				line = this.lines[this.cursorRow] || '';
			} else {
				return;
			}
		} else {
			this.cursorCol++;
		}

		while (this.cursorCol < line.length - 1 && this.getCharType(line[this.cursorCol]) === 0) this.cursorCol++;
		const targetType = this.getCharType(line[this.cursorCol]);
		while (this.cursorCol < line.length - 1 && this.getCharType(line[this.cursorCol + 1]) === targetType) this.cursorCol++;
	}

	private setMode(newMode: VimMode) {
		this.mode = newMode;
		if (newMode === 'VISUAL') {
			this.visualStart = { col: this.cursorCol, row: this.cursorRow };
		} else {
			this.visualStart = null;
		}
		this.updateStatusBar();
	}

	private updateStatusBar() {
		let statusText = `-- ${this.mode} --`;
		if (this.commandCount > 0) statusText += `  ${this.commandCount}`;
		if (this.pendingOperator) statusText += `${this.pendingOperator}`;
		
		const rightText = `${this.cursorRow + 1},${this.cursorCol + 1}`;
		
		if (this.onStatusUpdate) {
			this.onStatusUpdate(statusText, rightText);
		}
	}

	/** Public: replace a single character in the buffer (used by TowerSystem on tower death). */
	public setChar(col: number, row: number, char: string) {
		this.replaceChar(col, row, char);
	}

	private replaceChar(col: number, row: number, char: string) {
		while (this.lines.length <= row) this.lines.push('');
		let line = this.lines[row] || '';
		if (col > line.length) line = line.padEnd(col, ' ');

		this.lines[row] = line.slice(0, col) + char + line.slice(col + 1);
		this.triggerRenderRow(row);
	}

	private deleteText(col: number, row: number, count: number) {
		if (row >= this.lines.length) return;
		let line = this.lines[row] || '';
		if (col >= line.length) return;

		this.lines[row] = line.slice(0, col) + line.slice(col + count);
		this.triggerRenderRow(row);
	}

	// Triggers
	private triggerRenderRow(row: number) {
		if (this.onRenderRow) this.onRenderRow(row);
	}

	private triggerRenderAll() {
		if (this.onRenderAll) this.onRenderAll();
	}

	public triggerCursorMoved() {
		if (this.onCursorMoved) this.onCursorMoved();
		this.updateStatusBar();
	}
}
