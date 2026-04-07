export class GameState {
    public kills: number = 0;
    public elapsedSeconds: number = 0;
    public isGameOver: boolean = false;
    public towerCount: number = 0;

    public onKillsChange?: (kills: number) => void;
    public onGameOver?: () => void;
    public onTowerCountChange?: (count: number) => void;

    constructor() {
        // No more player lives - game ends when all towers are destroyed
    }

    get difficulty(): number {
        return 1 + this.elapsedSeconds / 20;
    }

    get difficultyLabel(): string {
        const d = this.difficulty;
        if (d < 1.5) return 'EASY';
        if (d < 2.5) return 'MEDIUM';
        if (d < 4.0) return 'HARD';
        return 'INSANE';
    }

    update(delta: number): void {
        if (this.isGameOver) return;
        this.elapsedSeconds += delta / 1000;
    }

    setTowerCount(count: number): void {
        this.towerCount = count;
        this.onTowerCountChange?.(count);
        if (count === 0) {
            this.isGameOver = true;
            this.onGameOver?.();
        }
    }

    addKill(): void {
        this.kills += 1;
        this.onKillsChange?.(this.kills);
    }

    getTimeString(): string {
        const m = Math.floor(this.elapsedSeconds / 60);
        const s = Math.floor(this.elapsedSeconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
