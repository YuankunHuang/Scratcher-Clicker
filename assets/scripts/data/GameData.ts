export interface SaveData {
    coins: number,
    totalScratches: number, // 刮擦总数
    autoScratchLevel: number, // 自动刮擦器等级
    autoScratchRate: number, // 每秒自动收益（金币/秒）
    lastSaveTimestamp: number, // 上次离开的Unix时间戳，用于计算离线收益
}

export const DEFAULT_SAVE_DATA: Readonly<SaveData> = {
    coins: 0,
    totalScratches: 0,
    autoScratchLevel: 0,
    autoScratchRate: 0,
    lastSaveTimestamp: 0,
};

/*
 * GameData是纯数据结构，作为“样板”DataCenter层。后面应该会拆分子模块实现。
 */
export class GameData {
    private static _instance: GameData | null = null;
    static get instance(): GameData {
        if (!this._instance) this._instance = new GameData();
        return this._instance;
    }
    
    private _data: SaveData = { ...DEFAULT_SAVE_DATA };
    
    get coins(): number { return this._data.coins; }
    get totalScratches(): number { return this._data.totalScratches; }
    get autoScratchLevel(): number { return this._data.autoScratchLevel; }
    get autoScratchRate(): number { return this._data.autoScratchRate; }
    get lastSaveTimestamp(): number { return this._data.lastSaveTimestamp; }
    
    addCoins(amount: number): void {
        this._data.coins = Math.max(this._data.coins + amount, 0);
    }
    
    trySpendCoins(amount: number): boolean {
        if (this._data.coins < amount) return false;
        this._data.coins -= amount;
        return true;
    }
    
    recordScratch(): void {
        this._data.totalScratches++;
    }
    
    upgradeAutoScratch(newLevel: number, newRate: number): void {
        this._data.autoScratchLevel = newLevel;
        this._data.autoScratchRate = newRate;
    }
    
    serialize(): SaveData {
        return {...this._data, lastSaveTimestamp: Date.now()};
    }
    
    deserialize(data: SaveData): void {
        this._data = { ...DEFAULT_SAVE_DATA, ...data };
    }
}