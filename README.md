# Scratcher Clicker

A fast-paced idle game prototype built with **Cocos Creator 3.8.8**, designed foremost as a **production-ready client architecture** — clean, extensible, and immediately portable to any Cocos project.

> Intended for any Unity developer (like me :D) transitioning to TypeScript, and for small teams that need a strict, conflict-free collaboration foundation.

---

## Architecture Overview

```
GameManager  (Composition Root — the only class that knows everything)
│
├── ServiceLocator          pure static registry, hidden from all UI
│     ├── IEventManager  ←─ EventManagerImpl
│     ├── ISaveManager   ←─ SaveManagerImpl
│     ├── IAudioManager  ←─ AudioManagerImpl
│     └── IUIManager     ←─ UIManagerImpl
│
├── Services               thin façade over ServiceLocator (import as needed)
│
└── AppFlow                application entry point, fires first window
      └── UIManagerImpl
            └── WindowRegistry   auto-registers via @windowController decorator
                  └── WindowControllerBase   lifecycle template for all UI windows
```

---

## Core Design Principles

### Composition Root
`GameManager` is the sole `cc.Component` in the core layer. It instantiates every service implementation (`Impl`), injects engine dependencies (e.g. `AudioSource` nodes), and registers them into `ServiceLocator`. No other class is aware of concrete implementations.

The equivalent of Unity's `Bootstrapper` scene + `ModuleRegistry`.

### Service Locator + Interface Segregation
All services are accessed via interfaces (`IUIManager`, `IAudioManager`, …), never via concrete classes. Swapping an implementation requires changing exactly one line in `GameManager`.

### Principle of Least Privilege
Service access is not inherited — it is **declared via `import`**.

```typescript
// A window that needs audio explicitly imports Services
import { Services } from '../../Services';

Services.audio.playSFX('click');   // needs audio — imported ✓
// Services.save is not imported → cannot access save — by design
```

The TypeScript module system enforces this: no import, no access, no accidental coupling.

### Idempotent Lifecycle
`_init()` and `_dispose()` are guarded by an `_isInitialized` flag, making them safe to call multiple times. `restart()` is simply `dispose → init`.

```typescript
restart(): void {
    this._dispose();   // idempotent — safe even if called twice
    this._init();
}
```

### Window Lifecycle via Template Method
`WindowControllerBase` defines a fixed sequence (`init → preShow → show → preHide → hide → dispose`) and exposes protected hooks (`onInit`, `onShow`, …) for subclasses to override selectively. The framework always drives the sequence; the controller only fills in behavior.

### Auto-Registration via Decorator
Each window controller self-registers using `@windowController`. No central registry file to maintain manually.

```typescript
@windowController(WindowNames.ShopWindow, {
    prefabPath: 'prefabs/ui/windows/ShopWindow/ShopWindow',
    layer: WindowLayer.Dialog,
    destroyOnCovered: false,
})
export class ShopWindowController extends WindowControllerBase<ShopWindowConfig> { ... }
```

---

## Project Structure

```
assets/scripts/
│
├── core/
│   ├── interfaces.ts          All I-interfaces + IDisposable + GameEvent enum
│   ├── ServiceLocator.ts      Static registry + Tokens
│   ├── GameManager.ts         Composition Root (the only cc.Component in core)
│   ├── EventManagerImpl.ts
│   ├── AudioManagerImpl.ts
│   ├── SaveManagerImpl.ts
│   └── UIManagerImpl.ts       Window stack, async prefab loading, queue
│
├── ui/
│   ├── base/
│   │   ├── WindowAttributes.ts   WindowLayer enum + WindowAttributes interface
│   │   ├── WindowConfig.ts       Base cc.Component for prefab UI bindings
│   │   └── WindowControllerBase.ts
│   ├── registry/
│   │   └── WindowRegistry.ts     @windowController decorator + factory map
│   ├── windows/
│   │   ├── index.ts              Import all controllers here to trigger registration
│   │   ├── LoadingWindow/
│   │   ├── LoginWindow/
│   │   └── MainWindow/
│   └── WindowNames.ts            Type-safe window key constants
│
├── data/
│   └── GameData.ts               Pure TS runtime data model + serialization
│
├── AppFlow.ts                    Application entry point (static, stateless)
└── Services.ts                   Thin façade: Services.ui / .audio / .save / .event
```

---

## Game Flow

```
GameManager.onLoad()
  └─ _init()
       ├─ _initServices()       Event → Save → Audio → UI  (in dependency order)
       └─ AppFlow.start()
            └─ show(LoadingWindow)
                 └─ [click] → show(LoginWindow)   destroyOnCovered: true on LoadingWindow
                       └─ [click] → show(MainWindow)   destroyOnCovered: true on LoginWindow
                             └─ [restart] → GameManager.restart()
                                   └─ dispose → init → AppFlow.start()
```

---

## For Unity Developers

| Unity | This Project |
|---|---|
| `[SerializeField]` | `@property` decorator (must be public — no `_` prefix) |
| `DontDestroyOnLoad` | `director.addPersistRootNode(this.node)` |
| `MonoBehaviour.OnDestroy` | `Component.onDestroy()` |
| `ScriptableObject` / pure C# class | Pure TypeScript class (no `cc.Component`) |
| `ModuleRegistry` / Zenject / VContainer | `ServiceLocator` + `Tokens` |
| `UnityEvent` / `MessageBroker` | `EventTarget` via `IEventManager` |
| Scene Bootstrapper | `GameManager` as Composition Root |
| `onClick.AddListener(cb)` | `node.on(Button.EventType.CLICK, cb, this)` |
| `onClick.RemoveListener(cb)` | `node.targetOff(this)` (removes all listeners for target) |

---

## Editor Toolbox (extension)

The project includes a dockable editor panel at [`extensions/toolbox`](extensions/toolbox):

- **Panels → Tools Panel** — left sidebar lists tools; **Window Manager** creates / edits / deletes window scripts and updates `WindowNames.ts` + `ui/windows/index.ts`.
- Enable it in **Extension Manager** (refresh extensions if the panel does not appear).

---

## Prerequisites

- **Cocos Creator 3.8.8**
- Open the project via Cocos Dashboard → *Add existing project* → select this folder
- No additional setup required; all dependencies are in `assets/`
