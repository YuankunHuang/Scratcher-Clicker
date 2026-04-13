import {
    Node, Prefab, resources, instantiate,
    UITransform, Sprite, SpriteFrame, Texture2D, RenderTexture,
    BlockInputEvents, Color,
    Camera, Canvas,
    director, Director, view, game, sys,
    gfx,
} from 'cc';
import { IDisposable, IUIManager } from "./interfaces";
import { WindowControllerBase } from "../ui/base/WindowControllerBase";
import { WindowConfig } from "../ui/base/WindowConfig";
import { WindowAttributes, WindowLayer } from "../ui/base/WindowAttributes";
import { WindowRegistry } from "../ui/registry/WindowRegistry";

export interface WindowLayers {
    readonly normal: Node;
    readonly dialog: Node;
    readonly popup: Node;
    readonly top: Node;
    readonly raycastBlocker: Node;
}

/**
 * Window node 层级结构：
 *   Window node
 *     ├── [0] Bg_*    全屏背景（模糊截图 or 纯黑）
 *     ├── [1] Mask_*  全屏触摸拦截
 *     └── [...] Prefab 原有内容
 */
interface WindowEntry {
    readonly node: Node;
    readonly controller: WindowControllerBase;
    readonly config: WindowConfig;
    bgNode: Node | null;
    maskNode: Node | null;
    blurSpriteFrame: SpriteFrame | null;
    /** native 方案（Camera+RT）才有值，web 方案是手动 new Texture2D */
    blurTexture: Texture2D | RenderTexture | null;
}

interface ShowRequest {
    readonly key: string;
    readonly data: unknown;
}

export class UIManagerImpl implements IUIManager, IDisposable {

    private readonly _layerMap: Record<WindowLayer, Node>;
    private _cache: Map<string, WindowEntry> = new Map();
    private _stack: string[] = [];
    private _queue: ShowRequest[] = [];
    private _isBusy: boolean = false;

    /** 懒加载并缓存，避免每次 blur 截图都遍历全场景 */
    private _mainCamera: Camera | null = null;

    /**
     * view.getVisibleSize() 每次调用都 new Size，改用两个数字缓存。
     * 在 _showInternal 开头刷新一次，同帧内所有 helper node 共享。
     */
    private _visW: number = 0;
    private _visH: number = 0;

    /** 复用 Color，避免每次 blur 截图都 new Color */
    private static readonly _CLEAR_COLOR = new Color(0, 0, 0, 255);

    constructor(layers: WindowLayers) {
        this._layerMap = {
            [WindowLayer.Normal]: layers.normal,
            [WindowLayer.Dialog]: layers.dialog,
            [WindowLayer.Popup]:  layers.popup,
            [WindowLayer.Top]:    layers.top,
        };
        // 对象字面量仍引用 layers，保存原始引用供 raycastBlocker 使用
        this._layers = layers;
    }

    // 仅用于 raycastBlocker，不进入 layerMap
    private readonly _layers: WindowLayers;

    /* ── 对外 API ─────────────────────────────────────────────────────────── */

    show(key: string, data?: unknown): void {
        this._queue.push({ key, data: data ?? null });
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
        if (this._isBusy) throw new Error('[UIManager] Cannot go back when busy.');

        if (this._stack.length > 0) {
            const key = this._stack.pop()!;
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
        if (this._isBusy) throw new Error('[UIManager] Cannot go back when busy.');

        const idx = this._stack.indexOf(key);
        if (idx === -1) throw new Error(`${key} could not be found in stack.`);

        // 从末尾向前关闭，避免 splice+reverse 产生临时数组
        for (let i = this._stack.length - 1; i > idx; i--) {
            const k = this._stack[i];
            const entry = this._cache.get(k);
            if (!entry) throw new Error(`Could not find cache with key ${k}`);
            this._removeEntry(k);
        }
        this._stack.length = idx + 1;

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
        this._queue.length = 0;
        this._cache.forEach(entry => {
            if (entry.node.active) {
                entry.controller.preHide();
                entry.node.active = false;
                entry.controller.hide();
            }
            this._releaseBlurAssets(entry);
            entry.controller.dispose();
            entry.node.destroy();
        });
        this._cache.clear();
        this._stack.length = 0;
        this._mainCamera = null;
    }

    /* ── 队列 ─────────────────────────────────────────────────────────────── */

    private _processQueue(): void {
        if (this._queue.length < 1) {
            this._isBusy = false;
            return;
        }
        this._isBusy = true;
        this._setRaycastBlock(true);
        const req = this._queue.shift()!;
        this._showInternal(req.key, req.data).then(() => {
            this._setRaycastBlock(false);
            this._processQueue();
        });
    }

    private async _showInternal(key: string, data: unknown): Promise<void> {
        if (!WindowRegistry.instance.has(key)) {
            console.error(`[UIManager] Window not registered: ${key}`);
            return;
        }
        if (this.isOpen(key)) return;

        const attrs = WindowRegistry.instance.getAttributes(key);

        const shouldHideCovered = attrs.stackable && attrs.showMask && !attrs.isTransparent;
        const coveredIdx = shouldHideCovered && this._stack.length > 0
            ? this._stack.length - 1
            : -1;

        const entry = await this._getOrLoadWindow(key);
        if (!entry) return;

        // 截屏必须在窗口 active 之前，确保 popup 自身不出现在模糊背景中
        let blurSF: SpriteFrame | null = null;
        if (attrs.blurBackground && attrs.isTransparent && !entry.bgNode) {
            blurSF = await this._captureBlur(entry);
        }

        // 一次性读取可见区尺寸，避免 helper node 各自调用 view.getVisibleSize()
        const vs = view.getVisibleSize();
        this._visW = vs.width;
        this._visH = vs.height;
        this._ensureHelperNodes(key, attrs, entry, blurSF);

        entry.controller.preShow(data);
        entry.node.active = true;
        entry.controller.show();

        if (attrs.stackable && !this._stack.includes(key)) {
            this._stack.push(key);
        }

        if (coveredIdx !== -1) {
            const coveredKey = this._stack[coveredIdx];
            const coveredAttrs = WindowRegistry.instance.getAttributes(coveredKey);
            const coveredEntry = this._cache.get(coveredKey);
            if (coveredEntry) {
                if (coveredAttrs.destroyOnCovered) {
                    this._stack.splice(coveredIdx, 1);
                    this._removeEntry(coveredKey);
                } else {
                    coveredEntry.controller.preHide();
                    coveredEntry.node.active = false;
                    coveredEntry.controller.hide();
                }
            }
        }
    }

    /* ── Helper nodes ─────────────────────────────────────────────────────── */

    private _ensureHelperNodes(
        key: string,
        attrs: WindowAttributes,
        entry: WindowEntry,
        blurSF: SpriteFrame | null = null,
    ): void {
        const needsBg = attrs.showMask && (!attrs.isTransparent || attrs.blurBackground);
        if (needsBg && !entry.bgNode) {
            entry.bgNode = this._createBgNode(key, attrs, entry.node, blurSF);
        }
        if (attrs.showMask && !entry.maskNode) {
            entry.maskNode = this._createMaskNode(key, attrs, entry.node);
        }
    }

    private _createBgNode(
        key: string,
        attrs: WindowAttributes,
        windowNode: Node,
        blurSF: SpriteFrame | null,
    ): Node {
        const node = new Node(`Bg_${key}`);
        node.layer = windowNode.layer;
        const uit = node.addComponent(UITransform);
        uit.setContentSize(this._visW, this._visH);
        const sprite = node.addComponent(Sprite);
        // CUSTOM：Sprite 不自动把 UITransform 缩成贴图尺寸，始终保持全屏
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (blurSF) {
            sprite.spriteFrame = blurSF;
        } else {
            sprite.spriteFrame = null;
            sprite.color = new Color(0, 0, 0, attrs.isTransparent ? 80 : 178);
        }
        windowNode.addChild(node);
        node.setSiblingIndex(0);
        return node;
    }

    private _createMaskNode(key: string, attrs: WindowAttributes, windowNode: Node): Node {
        const node = new Node(`Mask_${key}`);
        node.layer = windowNode.layer;
        node.addComponent(UITransform).setContentSize(this._visW, this._visH);
        node.addComponent(BlockInputEvents);
        if (attrs.maskClickClose) {
            node.on(Node.EventType.TOUCH_END, () => this.goBack(), this);
        }
        windowNode.addChild(node);
        const bgNode = windowNode.getChildByName(`Bg_${key}`);
        node.setSiblingIndex(bgNode ? bgNode.getSiblingIndex() + 1 : 0);
        return node;
    }

    /* ── 模糊背景截图 ──────────────────────────────────────────────────────── */

    /**
     * 截取当前画面并缩小，上采样显示时产生天然模糊效果，全平台通用。
     *
     * - Web：CC3 UIStage 不向自定义 Camera 提交 2D draw call，Camera+RT 在 Web
     *   下永远得到空 RT。改用 game.canvas（WebGL 帧缓冲）→ 临时 2D canvas → Texture2D。
     * - Native：Camera+RT（Metal/Vulkan 后端 2D 渲染管线可正常向自定义 Camera 提交）。
     *
     * blurScale 越小越模糊（0.5 ≈ 轻微模糊，0.25 ≈ 强模糊）。
     */
    private static readonly BLUR_SCALE = 0.45;

    private async _captureBlur(entry: WindowEntry): Promise<SpriteFrame | null> {
        const vs = view.getVisibleSize();
        this._visW = vs.width;
        this._visH = vs.height;

        return sys.isBrowser
            ? this._captureBlurWeb(entry)
            : this._captureBlurNative(entry);
    }

    private async _captureBlurWeb(entry: WindowEntry): Promise<SpriteFrame | null> {
        await this._waitAfterDraw();

        try {
            const srcCanvas = game.canvas as HTMLCanvasElement | null;
            if (!srcCanvas) return null;

            const scale = UIManagerImpl.BLUR_SCALE;
            const w = Math.max(1, Math.floor(srcCanvas.width  * scale));
            const h = Math.max(1, Math.floor(srcCanvas.height * scale));

            const tmp = document.createElement('canvas');
            tmp.width  = w;
            tmp.height = h;
            const ctx = tmp.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(srcCanvas, 0, 0, w, h);

            const tex = new Texture2D();
            tex.reset({ width: w, height: h, format: Texture2D.PixelFormat.RGBA8888, mipmapLevel: 1 });
            tex.uploadData(tmp);
            entry.blurTexture = tex;

            const sf = new SpriteFrame();
            sf.texture  = tex;
            sf.flipUVY  = false;   // uploadData(canvas) 时 CC3 内部已处理 Y 轴翻转
            sf.packable = false;   // 禁止 DynamicAtlasManager 打包（不兼容 texSubImage2D）
            entry.blurSpriteFrame = sf;
            return sf;
        } catch (e) {
            console.warn('[UIManager] Blur capture failed:', e);
            return null;
        }
    }

    private async _captureBlurNative(entry: WindowEntry): Promise<SpriteFrame | null> {
        const scale = UIManagerImpl.BLUR_SCALE;
        const rtW = Math.max(1, Math.floor(this._visW * scale));
        const rtH = Math.max(1, Math.floor(this._visH * scale));

        const rt = new RenderTexture();
        rt.reset({ width: rtW, height: rtH });
        entry.blurTexture = rt;

        const mainCam = this._getMainCamera();
        const camNode = new Node('_BlurCapture');
        if (mainCam) {
            camNode.setWorldPosition(mainCam.node.worldPosition);
            camNode.setWorldRotation(mainCam.node.worldRotation);
        }
        director.getScene()!.addChild(camNode);

        const cam = camNode.addComponent(Camera);
        if (mainCam) {
            cam.projection  = mainCam.projection;
            cam.orthoHeight = mainCam.orthoHeight;
            cam.near        = mainCam.near;
            cam.far         = mainCam.far;
            cam.visibility  = mainCam.visibility;
            cam.priority    = mainCam.priority + 1; // 高于主相机，确保在同帧内渲染
        } else {
            cam.projection  = Camera.ProjectionType.ORTHO;
            cam.orthoHeight = this._visH * 0.5;
            cam.near        = -1000;
            cam.far         = 3000;
            cam.visibility  = 0xffffffff;
        }
        cam.clearFlags    = gfx.ClearFlagBit.ALL;
        cam.clearColor    = UIManagerImpl._CLEAR_COLOR;
        cam.targetTexture = rt;

        await this._waitAfterDraw();
        camNode.destroy();

        const sf = new SpriteFrame();
        sf.texture  = rt;
        sf.flipUVY  = (rt as unknown as { flipUVY?: boolean }).flipUVY ?? true;
        sf.packable = false;
        entry.blurSpriteFrame = sf;

        return sf;
    }

    /**
     * 缓存主相机引用，场景内只遍历一次。
     * 若缓存失效（场景切换导致 Camera 被销毁），重新搜索。
     */
    private _getMainCamera(): Camera | null {
        if (this._mainCamera?.isValid && !this._mainCamera.targetTexture) {
            return this._mainCamera;
        }
        this._mainCamera = this._findMainDisplayCamera();
        return this._mainCamera;
    }

    private _findMainDisplayCamera(): Camera | null {
        const scene = director.getScene();
        if (!scene) return null;

        for (const canvas of scene.getComponentsInChildren(Canvas)) {
            const cam = (canvas as unknown as { cameraComponent?: Camera }).cameraComponent;
            if (cam?.enabled && !cam.targetTexture) return cam;
        }
        return scene.getComponentsInChildren(Camera).find(c => c.enabled && !c.targetTexture) ?? null;
    }

    private _waitAfterDraw(): Promise<void> {
        return new Promise<void>(resolve => {
            const cb = () => { director.off(Director.EVENT_AFTER_DRAW, cb); resolve(); };
            director.on(Director.EVENT_AFTER_DRAW, cb);
        });
    }

    /** SpriteFrame 和底层贴图均为手动 new，必须手动销毁 */
    private _releaseBlurAssets(entry: WindowEntry): void {
        entry.blurSpriteFrame?.destroy();
        entry.blurTexture?.destroy();
        entry.blurSpriteFrame = null;
        entry.blurTexture     = null;
    }

    /* ── 窗口加载 / 卸载 ──────────────────────────────────────────────────── */

    private async _getOrLoadWindow(key: string): Promise<WindowEntry | null> {
        if (this._cache.has(key)) {
            return Promise.resolve(this._cache.get(key)!);
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
                this._layerMap[attrs.layer].addChild(node);
                controller.init(config);
                const entry: WindowEntry = {
                    node, controller, config,
                    bgNode: null, maskNode: null,
                    blurSpriteFrame: null, blurTexture: null,
                };
                this._cache.set(key, entry);
                resolve(entry);
            });
        });
    }

    private _setRaycastBlock(isActive: boolean): void {
        this._layers.raycastBlocker.active = isActive;
    }

    private _removeEntry(key: string): void {
        const entry = this._cache.get(key);
        if (!entry) throw new Error(`[UIManager] Cache missing for key: ${key}`);
        entry.maskNode?.targetOff(this);
        this._releaseBlurAssets(entry);
        entry.controller.preHide();
        entry.node.active = false;
        entry.controller.hide();
        entry.controller.dispose();
        entry.node.destroy();
        this._cache.delete(key);
    }
}
