import { TowerType, TOWER_TYPES } from '../entities/TowerTypes';
import { GameState } from '../GameState';

export interface ClipboardEntry {
	towerType: TowerType;
	pattern: string[];
	baseEnergyCost: number;
}

export class ClipboardSystem {
	private unnamedRegister: ClipboardEntry | null = null;
	private namedRegisters: Map<string, ClipboardEntry> = new Map();

	constructor(private gameState: GameState) {
		const defaultTowers: Array<[string, string]> = [
			['sniper', 's'],
			['rapid', 'r'],
			['pulse', 'p'],
			['bomb', 'b'],
		];
		for (const [id, reg] of defaultTowers) {
			const t = TOWER_TYPES[id];
			if (t) {
				const width = Math.max(...t.pattern.map(l => l.length));
				const height = t.pattern.length;
				const entry = {
					towerType: t,
					pattern: [...t.pattern],
					baseEnergyCost: width * height
				};
				this.namedRegisters.set(reg, entry);
			}
		}
	}

	getEntryCost(entry: ClipboardEntry): number {
		if (entry.baseEnergyCost === 0) return 0;
		const timePenalty = Math.floor(this.gameState.elapsedSeconds / 120) * 5;
		return entry.baseEnergyCost + timePenalty;
	}

	private cropPattern(p: string[]): string[] {
		if (p.length === 0) return [];
		// Remove empty rows from top/bottom
		let top = 0;
		while (top < p.length && p[top].trim() === '') top++;
		let bottom = p.length - 1;
		while (bottom >= top && p[bottom].trim() === '') bottom--;
		if (top > bottom) return [];

		const rows = p.slice(top, bottom + 1);
		// Find min leading spaces
		let minLeading = Infinity;
		for (const row of rows) {
			const trimmed = row.trimStart();
			if (trimmed.length > 0) {
				minLeading = Math.min(minLeading, row.length - trimmed.length);
			}
		}

		return rows.map(row => row.slice(minLeading).trimEnd());
	}

	yankPattern(pattern: string[], register: string): boolean {
		if (!this.gameState.tryConsumeEnergy(5)) return false;

		const width = Math.max(...pattern.map(l => l.length));
		const height = pattern.length;
		const areaSize = width * height;

		const croppedYank = this.cropPattern(pattern);
		if (croppedYank.length === 0) return false;

		const known = Object.values(TOWER_TYPES).find(t => {
			const croppedT = this.cropPattern(t.pattern);
			if (croppedT.length !== croppedYank.length) return false;
			return croppedT.every((line, i) => line === croppedYank[i]);
		});

		const towerType: TowerType = known ?? {
			char: 'W',
			name: 'Custom Structure',
			maxHp: 1,
			damage: 0,
			range: 0,
			fireRate: 0,
			projectileSpeed: 0,
			color: 0x888888,
			scoreValue: 0,
			pattern: croppedYank,
		};

		const cWidth = Math.max(...croppedYank.map(l => l.length));
		const cHeight = croppedYank.length;
		const entry = { towerType, pattern: croppedYank, baseEnergyCost: cWidth * cHeight };
		this.unnamedRegister = entry;
		if (register !== '"') {
			this.namedRegisters.set(register, entry);
		}
		return true;
	}

	useEntry(register: string): ClipboardEntry | null {
		const entry = register === '"' ? this.unnamedRegister : this.namedRegisters.get(register);
		if (entry && this.gameState.tryConsumeEnergy(this.getEntryCost(entry))) {
			return entry;
		}
		return null;
	}

	getRegisters(): Map<string, ClipboardEntry> {
		return this.namedRegisters;
	}

	getUnnamed(): ClipboardEntry | null {
		return this.unnamedRegister;
	}

	onEnemyKilled(): void { }
}
