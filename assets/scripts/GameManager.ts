import { _decorator, AudioSource, Component, Node, game, director } from 'cc';
import { ServiceLocator, Tokens } from "./core/ServiceLocator";
import { IAssetManager, IAudioManager, IEventManager, ISaveManager, isDisposable, IUIManager } from "./core/interfaces";
import { EventManagerImpl } from "./core/EventManagerImpl";
import { SaveManagerImpl } from "./core/SaveManagerImpl";
import { AudioManagerImpl } from "./core/AudioManagerImpl";
import { UIManagerImpl, WindowLayers } from "./core/UIManagerImpl";
import { AssetManagerImpl } from "./core/AssetManagerImpl";
import { AppFlow } from "./AppFlow";

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    
    // AudioManager Dependencies
    @property(AudioSource) private bgmSource: AudioSource = null!;
    @property(AudioSource) private sfxSource: AudioSource = null!;

    // UIManager Dependencies
    @property(Node) private layerNormal: Node = null!;
    @property(Node) private layerDialog: Node = null!;
    @property(Node) private layerPopup: Node = null!;
    @property(Node) private layerTop: Node = null!;
    @property(Node) private raycastBlocker: Node = null!;

    private static _instance: GameManager;
    static get instance(): GameManager { return GameManager._instance!; }

    private _isInitialized: boolean = false;    
    
    /* 公开API */
    restart(): void {
        this._dispose();
        this._init();
    }
    quit(): void {
        this._dispose();
        game.end();
    }
    
    /* 生命周期 */
    onLoad(): void {
        if (GameManager._instance && GameManager._instance !== this) {
            this.destroy();
            return;
        }
        
        GameManager._instance = this;
        director.addPersistRootNode(this.node);
        this._init();
    }
    
    onDestroy(): void {
        this._dispose();
        GameManager._instance = null;
    }
    
    /* 初始化 */
    private _initServices(): void {
        ServiceLocator.register<IEventManager>(Tokens.Event, new EventManagerImpl());
        
        const save = new SaveManagerImpl();
        ServiceLocator.register<ISaveManager>(Tokens.Save, save);
        save.load();
        
        ServiceLocator.register<IAudioManager>(Tokens.Audio, new AudioManagerImpl(this.bgmSource, this.sfxSource));
        
        const layers: WindowLayers = {
            normal: this.layerNormal,
            dialog: this.layerDialog,
            popup: this.layerPopup,
            top: this.layerTop,
            raycastBlocker: this.raycastBlocker,
        };

        ServiceLocator.register<IUIManager>(Tokens.UI, new UIManagerImpl(layers));

        ServiceLocator.register<IAssetManager>(Tokens.Asset, new AssetManagerImpl());
    }
    
    private _init(): void {
        if (this._isInitialized) return;
        this._isInitialized = true;
        this._initServices();
        this._onGameStart();
    }
    
    private _dispose(): void {
        if (!this._isInitialized) return;
        this._isInitialized = false;
        this._onGameStop();
        this._disposeServices();
    }
    
    private _disposeServices(): void {
        const reverseTokens = Object.values(Tokens).reverse(); 
        for (const token of reverseTokens) {
            if (!ServiceLocator.has(token)) continue;
            const service = ServiceLocator.get(token);
            if (isDisposable(service)) {
                service.dispose();
            }
        }

        ServiceLocator.clear();
    }

    private _onGameStart(): void {
        // 流程，启动！
        console.log("[GameManager] onGameStart");
        AppFlow.start();
    }
    private _onGameStop(): void {
        // 流程，结束！
        console.log("[GameManager] onGameStop");
        AppFlow.stop();
    }
}