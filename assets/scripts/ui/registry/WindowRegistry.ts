import {WindowControllerBase} from "../base/WindowControllerBase";
import {WindowAttributes, DEFAULT_WINDOW_ATTRIBUTES} from "../base/WindowAttributes";

interface RegistryEntry {
    readonly factory: () => WindowControllerBase;
    readonly attributes: WindowAttributes;
}


export class WindowRegistry {
    private static _instance: WindowRegistry;
    static get instance(): WindowRegistry {
        if (!this._instance) this._instance = new WindowRegistry();
        return this._instance;
    }
    
    private readonly _entries: Map<string, RegistryEntry> = new Map();
    
    // 由每个WindowController（自动）主动调用
    register(key: string, factory: () => WindowControllerBase, attributes: WindowAttributes): void {
        if (this._entries.has(key)) {
            console.warn(`[WindowRegistry] ${key} already registered, overwriting`);
        }
        this._entries.set(key, { factory, attributes });
    }
    
    createWindowController(key: string): WindowControllerBase {
        const entry = this._entries.get(key);
        if (!entry) throw new Error(`[WindowRegistry] Unknown window key: ${key}`);
        return entry.factory();
    }
    
    getAttributes(key: string) : WindowAttributes {
        const entry = this._entries.get(key);
        if (!entry) throw new Error(`[WindowRegistry] Unknown window key: ${key}`);
        return entry.attributes;
    }
    
    has(key: string): boolean {
        return this._entries.has(key);
    }
}

export function windowController(
    key: string,
    attributes: Partial<WindowAttributes> & Pick<WindowAttributes, 'prefabPath'>
) {
    return function <T extends new () => WindowControllerBase>(ctor: T): T {
        WindowRegistry.instance.register(
            key,
            () => new ctor(),
            { ...DEFAULT_WINDOW_ATTRIBUTES, ...attributes },
        )
        return ctor;
    }
}