import {Node,Prefab,resources,instantiate} from 'cc';
import {IDisposable, IUIManager} from "./interfaces";
import {WindowControllerBase} from "../ui/base/WindowControllerBase";
import {WindowConfig} from "../ui/base/WindowConfig";
import {WindowLayer} from "../ui/base/WindowAttributes";
import {WindowRegistry} from "../ui/registry/WindowRegistry";

export interface WindowLayers {
    readonly normal: Node;
    readonly dialog: Node;
    readonly popup: Node;
    readonly top: Node;
    readonly raycastBlocker: Node;
}

// 用于存储一个有效UI窗实例
interface WindowEntry {
    readonly node: Node,
    readonly controller: WindowControllerBase,
    readonly config: WindowConfig,
}

// 用于表示某一个Show请求，做队列缓存
interface ShowRequest {
    readonly key: string;
    readonly data: unknown;
}

export class UIManagerImpl implements IUIManager, IDisposable {
    
    private _layers!: WindowLayers; // Layer Node引用
    private _cache: Map<string, WindowEntry> = new Map(); // 栈内核心data(entry)缓存
    private _stack: string[] = []; // 栈内key缓存
    private _queue: ShowRequest[] = []; // 临时请求缓存（批量处理）
    private _isBusy: boolean = false;
    
    constructor(layers: WindowLayers) {
        this._layers = layers;
    }
    
    /* 对外API */
    show(key: string, data?: unknown): void {
        this._queue.push({ key: key, data: data ?? null });
        if (!this._isBusy) this._processQueue();
    }

    hide(key: string): void {
        const entry = this._cache.get(key);
        if (!entry || !entry.node.active) return;

        entry.controller.preHide();
        entry.node.active = false;
        entry.controller.hide();
    }
    
    goBack(): void {
        if (this._isBusy) {
            throw new Error(`[UIManager] Cannot go back when busy.`);
        }
        
        if (this._stack.length > 0) {
            const key = this._stack.pop();
            if (this._cache.has(key)) {
                this._removeEntry(key);
            } else {
                throw new Error(`Could not find cache with key ${key}`);
            }
        }
        
        if (this._stack.length > 0) {
            const newTop = this._cache.get(this._stack[this._stack.length - 1]);
            if (newTop && !newTop.node.active) {
                newTop.controller.preShow();
                newTop.node.active = true;
                newTop.controller.show();
            }
        }
    }

    goBackTo(key: string): void {
        if (this._isBusy) {
            throw new Error(`[UIManager] Cannot go back when busy.`);
        }
        
        const idx = this._stack.indexOf(key);
        if (idx == -1) {
            throw new Error(`${key} could not be found in stack.`);
        }

        const toClose = this._stack.splice(idx + 1).reverse();
        toClose.forEach(k => {
            const entry = this._cache.get(k);
            if (entry) {
                this._removeEntry(k);
            } else {
                throw new Error(`Could not find cache with key ${k}`);
            }
        })
        
        const targetEntry = this._cache.get(key);
        if (targetEntry && !targetEntry.node.active) {
            targetEntry.controller.preShow();
            targetEntry.node.active = true;
            targetEntry.controller.show();
        }
    }

    isOpen(key: string): boolean {
        return (this._cache.get(key)?.node.active) ?? false;
    }
    
    dispose(): void {
        // 即刻清理queue, cache, stack
        this._queue.length = 0;
        this._cache.forEach(entry => {
            if (entry) {
                if (entry.node.active){
                    entry.controller.preHide();
                    entry.node.active = false;
                    entry.controller.hide();    
                }
                
                entry.controller.dispose();
                entry.node.destroy();
            }
        });
        this._cache.clear();
        this._stack.length = 0;
    }
    
    /* 内部功能 */
    private _processQueue(): void {
        if (this._queue.length < 1) {
            this._isBusy = false;
            return;
        }
        
        this._isBusy = true;
        this._setRaycastBlock(true);
        
        const req = this._queue.shift()!;
        this._showInternal(req.key, req.data).then(()=>{
            this._setRaycastBlock(false);
            this._processQueue(); // keep on doing till empty
        });
    }
    
    private async _showInternal(key: string, data: unknown): Promise<void> {
        if (!WindowRegistry.instance.has(key)) {
            console.error(`[UIManager] Window not registered: ${key}`);
            return;
        }
        
        if (this.isOpen(key)) return;

        const attrs = WindowRegistry.instance.getAttributes(key);
        const coveredIdx = attrs.stackable && this._stack.length > 0
            ? this._stack.length - 1
            : -1;

        const entry = await this._getOrLoadWindow(key);
        if (!entry) return;
        
        entry.controller.preShow(data);
        entry.node.active = true;
        entry.controller.show();
        
        if (attrs.stackable && !this._stack.includes(key)) {
            this._stack.push(key);
        }

        // 之前在栈内的也要处理
        if (coveredIdx != -1) {
            const coveredKey = this._stack[coveredIdx];
            const coveredAttrs = WindowRegistry.instance.getAttributes(coveredKey);
            const coveredEntry = this._cache.get(coveredKey);
            if (coveredEntry) {
                if (coveredAttrs.destroyOnCovered) { // 要么销毁？
                    this._stack.splice(coveredIdx, 1);
                    this._removeEntry(coveredKey);
                } else { // 要么直接隐藏
                    coveredEntry.controller.preHide();
                    coveredEntry.node.active = false;
                    coveredEntry.controller.hide();
                }
            }
        }
    }
    
    private async _getOrLoadWindow(key: string): Promise<WindowEntry> {
        if (this._cache.has(key)) {
            return Promise.resolve(this._cache.get(key));
        }

        const attrs = WindowRegistry.instance.getAttributes(key);
        return new Promise(resolve => {
            resources.load<Prefab>(attrs.prefabPath, Prefab, (err, prefab) => {
                if (err) {
                    console.error(`[UIManager] Error loading prefab for "${key}" at "${attrs.prefabPath}": ${err}`);
                    resolve(null);
                    return;
                }
                
                const node = instantiate(prefab);
                const config = node.getComponent(WindowConfig)!;
                const controller = WindowRegistry.instance.createWindowController(key);
                node.active = false;
                this._getLayerNode(attrs.layer).addChild(node);
                
                controller.init(config);
                
                const entry: WindowEntry = { node, controller, config };
                this._cache.set(key, entry);
                resolve(entry);
            })
        })
    }
    
    private _getLayerNode(layer: WindowLayer): Node {
        const map: Record<WindowLayer, Node> = {
            [WindowLayer.Normal]: this._layers.normal,
            [WindowLayer.Dialog]: this._layers.dialog,
            [WindowLayer.Popup]: this._layers.popup,
            [WindowLayer.Top]: this._layers.top,
        };
        return map[layer];
    }
    
    private _setRaycastBlock(isActive: boolean): void {
        this._layers.raycastBlocker.active = isActive;
    }
    
    private _removeEntry(key: string): void {
        const entry = this._cache.get(key);
        if (!entry) throw new Error(`[UIManager] Cache missing for key: ${key}`);
        entry.controller.preHide();
        entry.node.active = false;
        entry.controller.hide();
        entry.controller.dispose();
        entry.node.destroy();
        this._cache.delete(key);
    }
}