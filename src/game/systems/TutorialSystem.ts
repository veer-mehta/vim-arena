import { Scene, GameObjects } from 'phaser';
import { VimEngine } from '../vim/VimEngine';

export class TutorialSystem {
    private scene: Scene;
    private engine: VimEngine;
    private step: number = 0;
    
    private instructionText!: GameObjects.Text;
    private progressText!: GameObjects.Text;
    
    private targetH = 0;
    private targetJ = 0;
    private targetK = 0;
    private targetL = 0;
    private targetW = 0;
    private targetB = 0;
    private targetE = 0;
    private targetNumber = 0;
    private targetMode: string | null = null;
    private requireYank = false;
    private requirePaste = false;
    private requireDelete = false;
    private requireChange = false;
    private requireZero = false;
    private requireDollar = false;
    private requireReg: string | null = null;
    private requireSearch = false;
    private targetSearchQuery: string | null = null;
    private requireX = false;
    private requireR = false;
    private requireUlt = false;
    private pendingR = false;
    
    private yankCompleted = false;
    private pasteCompleted = false;
    private deleteCompleted = false;
    private changeCompleted = false;
    private zeroCompleted = false;
    private dollarCompleted = false;
    private searchCompleted = false;
    private xCompleted = false;
    private rCompleted = false;
    private ultCompleted = false;
    private wCompleted = false;
    private bCompleted = false;
    private eCompleted = false;

    private startCol = 0;
    private startRow = 0;
    
    public isActive: boolean = false;
    private isTransitioning: boolean = false;

    constructor(scene: Scene, engine: VimEngine) {
        this.scene = scene;
        this.engine = engine;
        this.isActive = true;

        const cam = this.scene.cameras.main;
        
        this.instructionText = this.scene.add.text(cam.centerX, cam.centerY - 50, '', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '16px',
            color: '#e6b800', // warning color
            align: 'center',
            resolution: 3,
            backgroundColor: '#111111', // bgPanel
            padding: { x: 24, y: 24 }
        }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

        this.progressText = this.scene.add.text(cam.centerX, cam.centerY + 30, '', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ffffff', // text
            align: 'center',
            resolution: 3,
            backgroundColor: '#111111', // bgPanel
            padding: { x: 16, y: 16 }
        }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

        this.startStep(0);
        
        // Hook into cursor movement
        const origCursorMoved = this.engine.onCursorMoved;
        this.engine.onCursorMoved = () => {
            if (origCursorMoved) origCursorMoved.call(this.engine);
            this.checkProgress();
        };
        // Hook into status update (for mode changes)
        const origStatusUpdate = this.engine.onStatusUpdate;
        this.engine.onStatusUpdate = (left: string, right: string) => {
            if (origStatusUpdate) origStatusUpdate.call(this.engine, left, right);
            this.checkProgress();
        };
        // Hook into Yank
        const origYank = this.engine.onYank;
        this.engine.onYank = (pattern, reg) => {
            if (origYank) origYank.call(this.engine, pattern, reg);
            if (this.requireYank && (!this.requireReg || reg === this.requireReg)) {
                this.yankCompleted = true;
                this.checkProgress();
            }
        };
        // Hook into Paste
        const origPaste = this.engine.onPaste;
        this.engine.onPaste = (row, col, reg) => {
            if (origPaste) origPaste.call(this.engine, row, col, reg);
            if (this.requirePaste && (!this.requireReg || reg === this.requireReg)) {
                this.pasteCompleted = true;
                this.checkProgress();
            }
        };
        // Hook into Delete and Change
        const origAction = this.engine.onAction;
        this.engine.onAction = (type, start, end) => {
            if (origAction) origAction.call(this.engine, type, start, end);
            if (this.requireDelete && type === 'delete') {
                this.deleteCompleted = true;
                this.checkProgress();
            }
            if (this.requireChange && type === 'change') {
                this.changeCompleted = true;
                this.checkProgress();
            }
        };
        // Hook into Motion (w, b, e, etc)
        const origMotion = this.engine.onMotion;
        this.engine.onMotion = (motion, start, end) => {
            if (origMotion) origMotion.call(this.engine, motion, start, end);
            
            const count = (this.engine as any).commandCount || 1;
            const validNumber = this.targetNumber === 0 || count === this.targetNumber;
            
            if (this.targetW > 0 && motion === 'w' && validNumber) {
                this.wCompleted = true;
                this.checkProgress();
            }
            if (this.targetB > 0 && motion === 'b' && validNumber) {
                this.bCompleted = true;
                this.checkProgress();
            }
            if (this.targetE > 0 && motion === 'e' && validNumber) {
                this.eCompleted = true;
                this.checkProgress();
            }
            if (this.requireDollar && motion === '$') {
                this.dollarCompleted = true;
                this.checkProgress();
            }
        };
        // Hook into Search
        const origSearch = this.engine.onSearch;
        this.engine.onSearch = (query) => {
            if (origSearch) origSearch.call(this.engine, query);
            if (this.requireSearch && this.targetSearchQuery && query === this.targetSearchQuery) {
                this.searchCompleted = true;
                this.checkProgress();
            }
        };
        // Hook into KeyDown for x and r
        const origHandleKeyDown = this.engine.handleKeyDown;
        this.engine.handleKeyDown = (event) => {
            if (origHandleKeyDown) origHandleKeyDown.call(this.engine, event);
            if (this.requireX && event.key === 'x') {
                this.xCompleted = true;
                this.checkProgress();
            }
            if (this.requireZero && event.key === '0' && (this.engine as any).commandCount === 0) {
                this.zeroCompleted = true;
                this.checkProgress();
            }
            if (this.requireR && this.pendingR) {
                if (event.key.length === 1 && event.key !== 'Escape') {
                    this.rCompleted = true;
                    this.pendingR = false;
                    this.checkProgress();
                }
            } else if (this.requireR && event.key === 'r') {
                this.pendingR = true;
                this.updateProgressText();
            }
        };
        // Hook into Ultimate
        const origUltimate = this.engine.onUltimate;
        this.engine.onUltimate = () => {
            if (origUltimate) origUltimate.call(this.engine);
            if (this.requireUlt) {
                this.ultCompleted = true;
                this.checkProgress();
            }
        };
    }

    private startStep(stepIndex: number) {
        this.step = stepIndex;
        this.startCol = this.engine.cursorCol;
        this.startRow = this.engine.cursorRow;
        
        this.targetH = 0;
        this.targetJ = 0;
        this.targetK = 0;
        this.targetL = 0;
        this.targetW = 0;
        this.targetB = 0;
        this.targetE = 0;
        this.targetNumber = 0;
        this.targetMode = null;
        this.requireYank = false;
        this.requirePaste = false;
        this.requireDelete = false;
        this.requireChange = false;
        this.requireZero = false;
        this.requireDollar = false;
        this.requireSearch = false;
        this.requireX = false;
        this.requireR = false;
        this.requireUlt = false;
        this.pendingR = false;
        this.targetSearchQuery = null;
        this.requireReg = null;
        this.yankCompleted = false;
        this.pasteCompleted = false;
        this.deleteCompleted = false;
        this.changeCompleted = false;
        this.zeroCompleted = false;
        this.dollarCompleted = false;
        this.wCompleted = false;
        this.bCompleted = false;
        this.eCompleted = false;
        this.searchCompleted = false;
        this.xCompleted = false;
        this.rCompleted = false;
        this.ultCompleted = false;
        this.isTransitioning = false;

        switch (this.step) {
            case 0:
                this.instructionText.setText("By default, Vim is in NORMAL mode.\nHere you navigate and execute commands.\n\nLet's learn basic movement:\nPress 'l' to move RIGHT 5 times.");
                this.targetL = 5;
                break;
            case 1:
                this.instructionText.setText("Great! Now press 'h' to move LEFT 5 times.");
                this.targetH = 5;
                break;
            case 2:
                this.instructionText.setText("Good job! Press 'j' to move DOWN 5 times.");
                this.targetJ = 5;
                break;
            case 3:
                this.instructionText.setText("Excellent! Press 'k' to move UP 5 times.");
                this.targetK = 5;
                break;
            case 4:
                this.instructionText.setText("NORMAL mode is for navigation.\nTo type text, you need INSERT mode.\n\nPress 'i' to enter INSERT mode.");
                this.targetMode = 'INSERT';
                break;
            case 5:
                this.instructionText.setText("Notice the status bar says -- INSERT --.\nNow you can type!\n\nWhen done, ALWAYS return to NORMAL mode.\nPress 'Escape' to return.");
                this.targetMode = 'NORMAL';
                break;
            case 6:
                this.instructionText.setText("Vim also has VISUAL mode for selecting text.\n\nPress 'v' to enter VISUAL mode.");
                this.targetMode = 'VISUAL';
                break;
            case 7:
                this.instructionText.setText("Notice the -- VISUAL -- status.\n\nNow press 'l' 5 times to select some text.");
                this.targetMode = 'VISUAL';
                this.targetL = 5;
                break;
            case 8:
                this.instructionText.setText("Great! The text is highlighted.\n\nNow press 'y' to yank (copy) it.");
                this.requireYank = true;
                break;
            case 9:
                this.instructionText.setText("The text is copied and you are\nback in NORMAL mode.\n\nNow press 'p' to paste the text.");
                this.requirePaste = true;
                break;
            case 10: {
                this.instructionText.setText("Let's learn advanced motions.\n\nPress 'w' to move forward by a word.");
                const r = this.engine.cursorRow;
                this.engine.lines[r] = "navigate words fast with vim";
                this.engine.cursorCol = 0;
                if (this.engine.onRenderRow) this.engine.onRenderRow(r);
                this.targetW = 1;
                break;
            }
            case 11:
                this.instructionText.setText("Great! Press 'b' to move back by a word.");
                this.targetB = 1;
                break;
            case 12:
                this.instructionText.setText("Press 'e' to move to the end of a word.");
                this.targetE = 1;
                break;
            case 13:
                this.instructionText.setText("Now for operators.\n\nPress 'd' then 'w' to delete a word.");
                this.requireDelete = true;
                break;
            case 14:
                this.instructionText.setText("You can also change words.\n\nPress 'c' then 'w' to change a word.\n(This puts you in INSERT mode!)");
                this.requireChange = true;
                break;
            case 15:
                this.instructionText.setText("Don't forget to return to NORMAL mode!\n\nPress 'Escape'.");
                this.targetMode = 'NORMAL';
                break;
            case 16:
                this.instructionText.setText("Quickly jump to the start of a line.\n\nPress '0' (zero).");
                this.requireZero = true;
                break;
            case 17:
                this.instructionText.setText("Or jump to the end of a line.\n\nPress '$' (Shift+4).");
                this.requireDollar = true;
                break;
            case 18:
                this.instructionText.setText("Awesome! You can also combine numbers\nwith motions.\n\nType '3' then 'w' to move forward 3 words.");
                this.targetW = 1;
                this.targetNumber = 3;
                break;
            case 19:
                this.instructionText.setText("You can copy text to specific registers.\n\nPress 'v' to select some text,\nthen type \" a y to yank to register a.");
                this.requireYank = true;
                this.requireReg = 'a';
                break;
            case 20:
                this.instructionText.setText("Now paste it from register a!\n\nType \" a p to paste.");
                this.requirePaste = true;
                this.requireReg = 'a';
                break;
            case 21:
                this.instructionText.setText("Towers cost 'Buffer Units' (your Energy!).\nPasting consumes Buffer Units.\nWe have towers in registers s, r, p, b.\n\nType \" s p to build a Sniper tower.");
                this.requirePaste = true;
                this.requireReg = 's';
                break;
            case 22: {
                this.instructionText.setText("You can delete single characters easily.\n\nPress 'x' to delete the character under the cursor.");
                const r = this.engine.cursorRow;
                this.engine.lines[r] = "delete x me";
                this.engine.cursorCol = 7;
                if (this.engine.onRenderRow) this.engine.onRenderRow(r);
                this.requireX = true;
                break;
            }
            case 23: {
                this.instructionText.setText("You can replace single characters easily.\n\nPress 'r' then 'o' to change 'b' to 'o'.");
                const r = this.engine.cursorRow;
                this.engine.lines[r] = "bops";
                this.engine.cursorCol = 0;
                if (this.engine.onRenderRow) this.engine.onRenderRow(r);
                this.requireR = true;
                break;
            }
            case 24: {
                const enemySys = (this.scene as any).enemySystem;
                let bug: any = null;
                if (enemySys) {
                    const cam = this.scene.cameras.main;
                    for (let i = 0; i < 20; i++) {
                        enemySys.spawnEnemy(cam.scrollX, cam.scrollY, cam.width, cam.height, 1.0);
                        bug = enemySys.activeEnemies[enemySys.activeEnemies.length - 1];
                        if (bug.label) break;
                        bug.isDead = true;
                        bug.hasExited = true;
                        bug.destroy();
                        enemySys.activeEnemies.pop();
                    }
                    if (bug && bug.label) {
                        bug.x = cam.scrollX + cam.width * 0.6;
                        bug.y = cam.scrollY + cam.height * 0.5;
                        bug.targetX = bug.x;
                        bug.targetY = bug.y;
                        this.targetSearchQuery = bug.label;
                        this.requireSearch = true;
                    }
                }
                const label = this.targetSearchQuery || 'a';
                this.instructionText.setText(`Uh oh, there's a bug lurking nearby!\nSee the letter '${label}' over its head?\n\nType /${label} and press Enter to search and zap it!`);
                break;
            }
            case 25:
                this.instructionText.setText("When things get tough, use your Ultimate!\nIt costs 20 Buffer Units (Energy).\n\nType :ult and press Enter!");
                this.requireUlt = true;
                break;
            case 26:
                this.instructionText.setText("You are ready for the Arena!\n\nType :q! to exit the tutorial.");
                this.progressText.setText("");
                return;
        }
        
        this.updateProgressText();
    }

    private updateProgressText() {
        if (this.step >= 26) return;
        
        let msg = "";
        if (this.targetL > 0) {
            let selected = Math.max(0, this.engine.cursorCol - this.startCol);
            if (this.targetMode === 'VISUAL' && this.engine.visualStart) {
                selected = Math.abs(this.engine.cursorCol - this.engine.visualStart.col);
            }
            msg = `Right (l): ${selected} / ${this.targetL}`;
        }
        else if (this.targetH > 0) msg = `Left (h): ${Math.max(0, this.startCol - this.engine.cursorCol)} / ${this.targetH}`;
        else if (this.targetJ > 0) msg = `Down (j): ${Math.max(0, this.engine.cursorRow - this.startRow)} / ${this.targetJ}`;
        else if (this.targetK > 0) msg = `Up (k): ${Math.max(0, this.startRow - this.engine.cursorRow)} / ${this.targetK}`;
        else if (this.requireYank) msg = this.requireReg ? `Action: "${this.requireReg}y` : `Action: Yank (y)`;
        else if (this.requirePaste) msg = this.requireReg ? `Action: "${this.requireReg}p` : `Action: Paste (p)`;
        else if (this.requireSearch) msg = `Action: /${this.targetSearchQuery} + Enter`;
        else if (this.requireX) msg = `Action: x`;
        else if (this.requireR) msg = this.pendingR ? `Action: Type a character (e.g. o)` : `Action: r`;
        else if (this.requireUlt) msg = `Action: :ult + Enter`;
        else if (this.targetW > 0) msg = this.targetNumber > 0 ? `Action: 3w` : `Action: w`;
        else if (this.targetB > 0) msg = `Action: b`;
        else if (this.targetE > 0) msg = `Action: e`;
        else if (this.requireDelete) msg = `Action: dw (delete word)`;
        else if (this.requireChange) msg = `Action: cw (change word)`;
        else if (this.requireZero) msg = `Action: 0`;
        else if (this.requireDollar) msg = `Action: $`;
        
        this.progressText.setText(msg);
    }

    private checkProgress() {
        if (!this.isActive || this.isTransitioning) return;

        let completed = false;
        
        let selectedL = this.engine.cursorCol - this.startCol;
        if (this.targetMode === 'VISUAL' && this.engine.visualStart) {
            selectedL = Math.abs(this.engine.cursorCol - this.engine.visualStart.col);
        }

        if (this.targetL > 0 && selectedL >= this.targetL && (!this.targetMode || this.engine.mode === this.targetMode)) completed = true;
        if (this.targetH > 0 && this.startCol - this.engine.cursorCol >= this.targetH) completed = true;
        if (this.targetJ > 0 && this.engine.cursorRow - this.startRow >= this.targetJ) completed = true;
        if (this.targetK > 0 && this.startRow - this.engine.cursorRow >= this.targetK) completed = true;
        
        if (this.targetMode && this.engine.mode === this.targetMode && this.targetL === 0) completed = true;
        
        if (this.requireYank && this.yankCompleted) completed = true;
        if (this.requirePaste && this.pasteCompleted) completed = true;
        if (this.requireSearch && this.searchCompleted) completed = true;
        if (this.requireX && this.xCompleted) completed = true;
        if (this.requireR && this.rCompleted) completed = true;
        if (this.requireUlt && this.ultCompleted) completed = true;
        
        if (this.targetW > 0 && this.wCompleted) completed = true;
        if (this.targetB > 0 && this.bCompleted) completed = true;
        if (this.targetE > 0 && this.eCompleted) completed = true;
        if (this.requireDelete && this.deleteCompleted) completed = true;
        if (this.requireChange && this.changeCompleted) completed = true;
        if (this.requireZero && this.zeroCompleted) completed = true;
        if (this.requireDollar && this.dollarCompleted) completed = true;

        this.updateProgressText();

        if (completed) {
            this.isTransitioning = true;
            // Next step
            this.scene.time.delayedCall(500, () => {
                this.startStep(this.step + 1);
            });
        }
    }
}
