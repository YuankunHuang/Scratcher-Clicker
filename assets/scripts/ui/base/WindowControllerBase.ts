import { WindowConfig } from './WindowConfig';

export abstract class WindowControllerBase<
    TConfig extends WindowConfig = WindowConfig,
    TData = unknown
> {
    // 可供子类随时取用的核心组件
    protected _config: TConfig;
    protected _data: TData;
    
    // 供UIManager调用的公开流程函数
    init(config: TConfig): void {
        this._config = config;
        this.onInit();
    }
    
    preShow(data?: TData): void {
        this._data = data as TData;
        this.onPreShow();
    }
    
    show(): void {
        this.onShow();
    }
    
    preHide(): void {
        this.onPreHide();
    }
    
    hide(): void {
        this.onHide();
    }
    
    dispose(): void {
        this.onDispose();
    }
    
    // 供子类（各窗Controller）选择性覆写的函数
    protected onInit(): void {}
    protected onPreShow(): void {}
    protected onShow(): void {}
    protected onPreHide(): void {}
    protected onHide(): void {}
    protected onDispose(): void {}
}


