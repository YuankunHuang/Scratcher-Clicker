import { isValid, Node, resources, Sprite, SpriteFrame } from 'cc';
import { IAssetManager, IDisposable } from './interfaces';

/**
 * AssetManagerImpl
 *
 * 全局动态资源加载与缓存服务。
 *
 * - 所有 SpriteFrame 在加载成功后调用 addRef()，防止引擎 GC 回收。
 * - dispose() 调用时对所有缓存资源 decRef()，并清空缓存。
 * - 通过 Services.asset 访问。
 */
export class AssetManagerImpl implements IAssetManager, IDisposable {

    /** path → SpriteFrame 缓存 */
    private readonly _cache: Map<string, SpriteFrame> = new Map();

    // ── IAssetManager ─────────────────────────────────────────────────────────

    /**
     * 异步加载 SpriteFrame。
     * - 命中缓存：同步返回（包装为 Promise）。
     * - 未命中：通过 resources.load 加载，成功后缓存并 addRef。
     *
     * @param path 相对于 resources/ 的路径，不含扩展名（例如 'textures/ui/icon_coin'）
     */
    loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
        const cached = this._cache.get(path);
        if (cached) return Promise.resolve(cached);

        return new Promise((resolve) => {
            resources.load(path, SpriteFrame, (err, sf) => {
                if (err || !sf) {
                    console.warn(`[AssetManager] Failed to load SpriteFrame: "${path}"`, err);
                    resolve(null);
                    return;
                }
                sf.addRef();
                this._cache.set(path, sf);
                resolve(sf);
            });
        });
    }

    /**
     * 同步读取缓存中的 SpriteFrame（未加载则返回 null）。
     * 不触发任何加载。
     */
    getSpriteFrame(path: string): SpriteFrame | null {
        return this._cache.get(path) ?? null;
    }

    /**
     * 异步加载 SpriteFrame 并赋给目标节点上的 Sprite。
     * 若节点在加载完成前已被销毁，则安全跳过。
     *
     * @param node  目标节点（需挂有 Sprite 组件）
     * @param path  同 loadSpriteFrame 的路径规则
     */
    setSpriteToNode(node: Node, path: string): void {
        this.loadSpriteFrame(path).then((sf) => {
            if (!sf || !isValid(node, true)) return;
            const sprite = node.getComponent(Sprite);
            if (sprite) sprite.spriteFrame = sf;
        });
    }

    /**
     * 批量预加载，在进入场景前提前填充缓存。
     * @param paths 路径列表
     */
    preload(paths: string[]): Promise<void> {
        return Promise.all(paths.map((p) => this.loadSpriteFrame(p))).then(() => void 0);
    }

    /**
     * 手动释放所有缓存资源（decRef），并清空缓存。
     * 调用后已缓存资源的引用计数归零，引擎可回收。
     */
    releaseUnused(): void {
        this._cache.forEach((sf) => sf.decRef());
        this._cache.clear();
    }

    // ── IDisposable ───────────────────────────────────────────────────────────

    dispose(): void {
        this.releaseUnused();
    }
}
