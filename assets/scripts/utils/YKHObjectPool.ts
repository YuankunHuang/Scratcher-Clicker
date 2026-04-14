/**
 * YKHObjectPool<T>
 *
 * 极简通用对象池。纯 TypeScript 泛型类，不继承任何 Cocos 类型，无引擎依赖。
 *
 * 设计原则：
 *  - 内部是一个 T[] 栈（pop/push），零 GC 路径
 *  - factory：池为空时创建新对象
 *  - onGet：从池中取出时调用（激活/重置）
 *  - onPut：归还到池时调用（隐藏/清理）
 *  - 超过 maxSize 的归还直接丢弃（不回池）
 *
 * 用法示例：
 *   // 池化 Cocos Node
 *   const pool = new YKHObjectPool<Node>(
 *       () => instantiate(prefab),
 *       (n) => { n.active = true; parentNode.addChild(n); },
 *       (n) => { n.active = false; n.removeFromParent(); },
 *   );
 *
 *   // 池化纯数据（Vec3 复用）
 *   const vecPool = new YKHObjectPool<Vec3>(
 *       () => new Vec3(),
 *       (v) => Vec3.zero(v),
 *   );
 *
 *   const node = pool.get();   // 取出
 *   pool.put(node);            // 归还
 */
export class YKHObjectPool<T> {
    private readonly _pool: T[] = [];

    constructor(
        private readonly _factory:  () => T,
        private readonly _onGet?:   (obj: T) => void,
        private readonly _onPut?:   (obj: T) => void,
        private readonly _maxSize:  number = 64,
    ) {}

    /** 取出一个对象（池空则由 factory 创建）。 */
    get(): T {
        const obj = this._pool.length > 0 ? this._pool.pop()! : this._factory();
        this._onGet?.(obj);
        return obj;
    }

    /** 归还一个对象。超过 maxSize 则丢弃，不入池。 */
    put(obj: T): void {
        if (this._pool.length >= this._maxSize) return;
        this._onPut?.(obj);
        this._pool.push(obj);
    }

    /**
     * 预热：提前创建 count 个对象放入池中。
     * 实际创建数量 = min(count, maxSize - currentSize)。
     */
    prewarm(count: number): void {
        const needed = Math.min(count, this._maxSize - this._pool.length);
        for (let i = 0; i < needed; i++) {
            this._pool.push(this._factory());
        }
    }

    /** 清空池，丢弃所有已缓存对象。 */
    clear(): void {
        this._pool.length = 0;
    }

    /** 当前池中可用对象数量。 */
    get size(): number {
        return this._pool.length;
    }
}
