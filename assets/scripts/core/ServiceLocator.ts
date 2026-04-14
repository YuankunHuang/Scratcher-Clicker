export class ServiceLocator {
    private static _services: Map<symbol, unknown> = new Map();
    
    static register<T>(token: symbol, impl: T): void {
        if (this._services.has(token)) {
            console.warn(`[ServiceLocator] Token already registered: ${String(token)}, overwriting.`);
        }
        this._services.set(token, impl);
    }
    
    static get<T>(token: symbol): T {
        const service = this._services.get(token);
        if (service == undefined) {
            throw new Error(`[ServiceLocator] No service found for token: ${String(token)}}`);
        }
        return service as T;
    }
    
    static has<T>(token: symbol): boolean {
        return this._services.has(token);
    }
    
    static unregister<T>(token: symbol): void {
        this._services.delete(token);
    }

    static clear(): void {
        this._services.clear();
    }
}

export const Tokens = {
    Audio: Symbol(`IAudioManager`),
    UI:    Symbol(`IUIManager`),
    Save:  Symbol(`ISaveManager`),
    Idle:  Symbol(`IIdleSystem`),
    Event: Symbol(`IEventManager`),
    Asset: Symbol(`IAssetManager`),
} as const;


