import { Node, SpriteFrame } from 'cc';

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

// 动态资源加载与缓存
export interface IAssetManager extends IDisposable {
    /** 异步加载 SpriteFrame，命中缓存时同步返回（包装为 Promise）。 */
    loadSpriteFrame(path: string): Promise<SpriteFrame | null>;
    /** 同步读取缓存，未加载则返回 null。 */
    getSpriteFrame(path: string): SpriteFrame | null;
    /** 异步加载并直接赋值给节点上的 Sprite 组件。 */
    setSpriteToNode(node: Node, path: string): void;
    /** 批量预加载。 */
    preload(paths: string[]): Promise<void>;
    /** 手动释放所有已缓存资源（decRef）并清空缓存。 */
    releaseUnused(): void;
}

export interface IDisposable {
    dispose(): void;
}
export function isDisposable(obj: unknown): obj is IDisposable {
    return typeof (obj as IDisposable)?.dispose === 'function';
}
