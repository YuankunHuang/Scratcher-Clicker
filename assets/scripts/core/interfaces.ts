// 音频
export interface IAudioManager {
    playBGM(clipName: string): void;
    playSFX(clipName: string): void;
    stopBGM(): void;
    setMasterVolume(vol: number): void;
}

// UI栈管理
export interface IUIManager {
    show(key: string, data?: unknown): void;
    hide(key: string): void;
    goBack(): void;
    goBackTo(key: string): void;
    isOpen(key: string): boolean;
}

// 存档
export interface ISaveManager {
    save(): void;
    load(): void;
    get<T>(key: string, defaultVal: T): T;
    set<T>(key: string, val: T): void;
}

// Idle系统
export interface IIdleSystem {
    start(): void;
    stop(): void;
    getOfflineEarnings(): number;
}

// 事件总线
export interface IEventManager {
    on<T>(eventName: string, callback: (data: T) => void, target?: object): void;
    off<T>(eventName: string, callback: (data: T) => void, target?: object): void;
    emit<T>(eventName: string, data?: T): void;
}

// 事件枚举
export enum GameEvent {
    COIN_CHANGED = 'coin_changed',
    CARD_SCRATCHED = 'card_scratched',
    UPGRADE_BOUGHT = 'upgrade_bought',
    IDLE_TICK = 'idle_tick',
    PANEL_OPEN = 'panel_open',
    PANEL_CLOSE = 'panel_close',
}

export interface IDisposable {
    dispose(): void;
}
export function isDisposable(obj: unknown): obj is IDisposable {
    return typeof (obj as IDisposable)?.dispose === 'function';
}
