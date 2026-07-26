import { VimEngine } from '../vim/VimEngine';

// Programming / terminal themed words that give meaningful w/e/b targets
const WORDS = [
    'function', 'return', 'const', 'let', 'type', 'class', 'import', 'export',
    'interface', 'array', 'string', 'number', 'boolean', 'object', 'async',
    'await', 'promise', 'error', 'debug', 'stack', 'loop', 'while', 'break',
    'switch', 'default', 'filter', 'reduce', 'map', 'find', 'sort', 'slice',
    'parse', 'format', 'render', 'update', 'delete', 'insert', 'search',
    'replace', 'buffer', 'cursor', 'motion', 'normal', 'visual', 'insert',
    'yank', 'paste', 'macro', 'register', 'pattern', 'regex', 'match',
    'token', 'syntax', 'scope', 'block', 'inline', 'offset', 'index',
    'value', 'target', 'source', 'result', 'output', 'input', 'config',
    'system', 'engine', 'plugin', 'module', 'widget', 'signal', 'event',
    'queue', 'cache', 'flush', 'drain', 'spawn', 'merge', 'diff', 'patch',
    'clone', 'proxy', 'guard', 'route', 'state', 'store', 'action', 'slice',
    'arena', 'tower', 'enemy', 'spawn', 'range', 'damage', 'combat', 'kill',
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export class BackgroundTextSystem {
    private readonly vim: VimEngine;
    public isCellProtected?: (col: number, row: number) => boolean;
    private generatedCols: Map<number, number> = new Map();

    constructor(vim: VimEngine) {
        this.vim = vim;
    }

    /** Seeds the buffer with random words, skipping rows/cols already occupied by tower patterns. */
    populate(totalRows: number, targetCols: number): void {
        while (this.vim.lines.length < totalRows) this.vim.lines.push('');
        for (let row = 0; row < totalRows; row++) {
            this.generateSegment(row, 0, targetCols);
        }
    }

    private generateSegment(row: number, startCol: number, endCol: number): void {
        const toGenerate = endCol - startCol;
        if (toGenerate <= 0) return;

        const line: string[] = [];
        let len = 0;

        while (len < toGenerate) {
            const word = pick(WORDS);
            if (len + word.length > toGenerate) break;
            if (line.length > 0) { line.push(' '); len++; }
            line.push(word);
            len += word.length;
        }

        if (line.length === 0) {
            this.generatedCols.set(row, Math.max(this.generatedCols.get(row) || 0, endCol));
            return;
        }
        
        const text = line.join('');

        let existingLine = this.vim.lines[row] || '';
        existingLine = existingLine.padEnd(startCol + text.length, ' ');

        let newLine = existingLine.slice(0, startCol);
        for (let c = 0; c < text.length; c++) {
            const globalCol = startCol + c;
            const protectedCell = this.isCellProtected && this.isCellProtected(globalCol, row);
            
            if (existingLine[globalCol] !== ' ' || protectedCell) {
                newLine += existingLine[globalCol] || ' ';
            } else {
                newLine += text[c];
                if (text[c] !== ' ') {
                    this.vim.backgroundCells.add(row * 4096 + globalCol);
                }
            }
        }

        if (existingLine.length > startCol + text.length) {
            newLine += existingLine.slice(startCol + text.length);
        }

        this.vim.lines[row] = newLine;
        this.generatedCols.set(row, Math.max(this.generatedCols.get(row) || 0, startCol + text.length));
    }

    extendIfNeeded(currentLastRow: number, targetCols: number): void {
        this.ensureVisiblePopulated(currentLastRow, currentLastRow + 10, targetCols);
    }

    ensureVisiblePopulated(startRow: number, endRow: number, targetCols: number): void {
        while (this.vim.lines.length <= endRow) {
            this.vim.lines.push('');
        }
        for (let row = startRow; row <= endRow; row++) {
            const currentMax = this.generatedCols.get(row) || 0;
            if (currentMax < targetCols) {
                this.generateSegment(row, currentMax, targetCols);
            }
        }
    }
}
