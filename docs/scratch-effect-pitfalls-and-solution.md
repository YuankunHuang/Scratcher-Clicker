# 刮擦效果实现复盘：踩坑记录与最终方案

> **适用版本**：Cocos Creator 3.8.x  
> **语言**：TypeScript  
> **日期**：2026-04

---

## 背景

目标是实现一个"刮刮乐"式的触摸擦除效果：屏幕上有一层"脏污"贴图（dirt），玩家用手指划过后，划过的区域逐渐变为透明，露出底下的文物原图。

---

## 方案一：RenderTexture + MaskCamera + Sprite 印章池

### 思路

1. 创建一个 `RenderTexture`（RT）作为遮罩。
2. 新建一个专用 `Camera`（`maskCam`），令其 `targetTexture = RT`，只渲染自定义 Layer（`SCRATCH`）。
3. 每次触摸时，从对象池取出一个 `Sprite`（画刷印章），放到 `maskCam` 可见的 `stampRoot` 下，下一帧回收。
4. `maskCam` 持续将印章渲染进 RT，RT 作为 `scratchMaskTex` 传给 Shader，Shader 据此遮罩 dirt 的 alpha。

### 踩坑过程

#### 坑 1：`getMaterialInstance()` 在 `onLoad` 中调用导致 dirt 不可见

**现象**：运行时 dirt 一片漆黑；手动在编辑器里移除 dirt 上的 Custom Material 后，dirt 变为可见。

**根因**：`ScratchRenderer.onLoad()` 时宿主节点尚处于 `inactive` 状态（DemoWindow 尚未显示），此时调用 `sprite.getMaterialInstance(0)` 会破坏 Sprite 内部的 `RenderData`，导致渲染数据损坏。

**修复**：将 `_setupRT()` 从 `onLoad` 移至 `onEnable`，确保在节点激活后才获取 material instance。

---

#### 坑 2：Shader 使用了 3D 顶点着色器导致 dirt 不可见

**现象**：效果文件中使用了 `vert: general-vs:vert`，编辑器预览正常，但运行时 dirt 不可见。

**根因**：`general-vs:vert` 是 3D 通用顶点着色器，变换公式为 `cc_matProj * cc_matView * cc_matWorld * a_position`。  
Cocos Creator 3.x 的 2D Sprite 顶点已经在**世界空间**，不需要再乘 `cc_matWorld`，否则会将顶点推到屏幕之外。编辑器 Preview 走的是另一套渲染路径，所以不会暴露此问题。

**修复**：自定义 2D 专用顶点着色器，直接用 `cc_matViewProj` 变换：

```glsl
CCProgram scratch-vs %{
  precision highp float;
  #include <builtin/uniforms/cc-global>

  in vec3 a_position;
  in vec2 a_texCoord;
  in vec4 a_color;

  out vec2 v_uv;
  out vec4 v_color;

  vec4 vert () {
    vec4 pos = cc_matViewProj * vec4(a_position, 1.0);
    v_uv    = a_texCoord;
    v_color = a_color;
    return pos;
  }
}%
```

> **通用规则**：在 Cocos Creator 3.x 中，为 2D Sprite 编写自定义 Shader，顶点阶段一律使用 `cc_matViewProj`，不要乘 `cc_matWorld`。

---

#### 坑 3：Shader 属性名不合法

**现象**：Console 持续报 `illegal property name: mainTexture`、`illegal property name: maskTexture`。

**根因**：Cocos Creator 3.x 的 Effect 属性名不能和引擎内置保留字（如 `mainTexture`）重名，且大小写敏感。

**修复**：将所有属性改为项目自定义名称：

```yaml
properties:
  dirtTex:        { value: white }
  scratchMaskTex: { value: black }
```

TypeScript 侧同步修改：

```typescript
mat.setProperty('dirtTex',        spriteFrame.texture);
mat.setProperty('scratchMaskTex', rt);
```

---

#### 坑 4：MaskCamera 无法将 2D Sprite 渲染到 RenderTexture（根本性限制）

**现象**：通过诊断 Shader（mask.r > 0.05 时输出红色）确认 RT 始终为空；将 `maskCam.clearColor` 设为红色后，整个 RT 变红，证明 `maskCam` 确实能清空 RT，但从未接收到任何 Sprite 内容。

**根因**：**这是 Cocos Creator 3.x 渲染管线的根本性限制。**

Cocos Creator 3.x 的 2D 渲染由 `UIStage` 负责，其 DrawCall 提交逻辑与 3D `ForwardStage` 完全独立。`Renderable2D` 组件（Sprite、Label 等）的 DrawCall **只会提交给主显示 Pass 中的 Camera，不会提交给 `targetTexture != null` 的离屏 Camera**。

因此，无论如何配置 Layer、Priority、Visibility，`maskCam` 的 RT 都不会收到 Sprite 印章的渲染结果。方案一在架构层面不可行。

---

### 方案一结论

| 问题 | 结论 |
|------|------|
| RenderTexture 能否接收 2D Sprite DrawCall | ❌ 不能（UIStage 限制） |
| 该方案是否可以通过配置修复 | ❌ 不可修复，属架构限制 |

---

## 方案二（最终方案）：CPU 侧 Texture2D 像素写入

### 核心思路

放弃 GPU 渲染管线，**完全在 CPU 侧用 `Uint8Array` 维护一张遮罩贴图**，触摸时直接操作像素数据，然后调用 `Texture2D.uploadData()` 一次性上传 GPU。

### 架构

```
触摸输入
  → 屏幕坐标 → 世界坐标 → scratchArea 局部坐标
  → _paintBrush()：在 _maskData (Uint8Array) 中写白色像素
  → _maskDirty = true

每次 TOUCH_MOVE 结束：
  → if (_maskDirty) _maskTex.uploadData(_maskData)
  → _maskDirty = false

Shader：
  → dirtTex * (1.0 - mask.r) 得到被擦除的 dirt 透明度
```

### 关键代码

**初始化**（在 `onEnable` 中调用）：

```typescript
private _setupMask() {
    const size = this.maskTextureSize; // 建议 256
    this._maskData = new Uint8Array(size * size * 4); // RGBA，初始全黑

    const tex = new Texture2D();
    tex.reset({
        width:  size,
        height: size,
        format: Texture2D.PixelFormat.RGBA8888,
        mipmapLevel: 1, // 注意：应为 1（一层基础 mip），不是 0
    });
    tex.uploadData(this._maskData);
    this._maskTex = tex;

    // 在 onEnable（节点已激活）时获取 instance，不会破坏 RenderData
    const mat = this.dirtSprite.getMaterialInstance(0);
    mat?.setProperty('scratchMaskTex', tex);
}
```

**像素绘制**（软边缘、支持叠加"越擦越白"）：

```typescript
private _paintBrush(x: number, y: number) {
    const size  = this.maskTextureSize;
    const halfW = this.scratchArea.contentSize.width  * 0.5;
    const halfH = this.scratchArea.contentSize.height * 0.5;

    // 局部坐标 → UV（注意：不翻转 Y，uploadData 内部已有一次翻转）
    const uvX = (x + halfW) / (halfW * 2);
    const uvY = (y + halfH) / (halfH * 2);

    const cx = uvX * size;
    const cy = uvY * size;
    const radiusPx = (this.brushSize / (halfW * 2)) * size * 0.5;
    const radiusSq = radiusPx * radiusPx;

    // ...遍历覆盖像素，线性衰减叠加...
    const t = 1.0 - Math.sqrt(distSq) / radiusPx;
    const newVal = Math.min(255, old + Math.floor(t * 255));
    this._maskData[idx]     = newVal; // R
    this._maskData[idx + 1] = newVal; // G
    this._maskData[idx + 2] = newVal; // B
    this._maskData[idx + 3] = 255;    // A
    this._maskDirty = true;
}
```

**Fragment Shader**：

```glsl
vec4 frag () {
    vec4 dirt = texture(dirtTex, v_uv);
    // 注意：采样 scratchMaskTex 时需翻转 V（与 uploadData 内部翻转对消）
    vec4 mask = texture(scratchMaskTex, vec2(v_uv.x, 1.0 - v_uv.y));
    float erased = mask.r;
    dirt.a *= (1.0 - erased);
    if (dirt.a < 0.01) discard;
    return CCFragOutput(dirt);
}
```

---

### V 轴翻转说明（必读）

这是最容易搞错的地方，涉及两处翻转的叠加：

| 位置 | 翻转行为 |
|------|----------|
| `uploadData(Uint8Array)` | Cocos 内部将数组行序（行 0 = 图像顶部）映射到 OpenGL 纹理（行 0 = 纹理底部），**内部自动翻转一次** |
| Shader `texture(scratchMaskTex, ...)` | 采样时再翻转 V：`1.0 - v_uv.y`，**对消**上面那次翻转 |
| `_paintBrush` 中 `uvY` 计算 | **不翻转**，直接 `(y + halfH) / (2 * halfH)`，让内部翻转保留 |

两处翻转加在一起恰好正确；任何一处多翻或少翻，都会导致上下颠倒的擦除效果。

---

### 场景结构（最小配置）

```
DemoWindow
└── Canvas
    ├── baseArtifact    (Sprite，文物底图，DEFAULT 层)
    ├── dirt            (Sprite，Custom Material = ScratchMaterial.mtl，DEFAULT 层)
    └── scratchHitArea  (Node，与 dirt 同尺寸，透明，专门接收 touch)
                           ↑ 推荐加 BlockInputEvents 防止穿透
```

`ScratchRenderer` Component 挂在任意节点上，两个 `@property` 引用：
- `scratchArea` → `scratchHitArea` 的 `UITransform`
- `dirtSprite`  → `dirt` 的 `Sprite`

> **为什么用 `scratchHitArea` 而不是 dirt 本身？**  
> 随着 dirt 被擦透明，透明像素不再响应 touch 事件，会造成"擦到一半后触摸失效"的问题。专用透明节点始终覆盖全区域。

---

### 方案二的优缺点

| | 方案二（CPU 像素写入）|
|---|---|
| **兼容性** | ✅ 不依赖任何渲染管线假设，Cocos 2.x/3.x 均可用 |
| **GC 压力** | ✅ 无运行时分配，`_maskData` 和 `_maskTex` 仅初始化时创建 |
| **性能** | 256×256 贴图 = 64KB，每帧 `uploadData` 约 0.1ms（移动端可接受） |
| **精度** | 取决于 `maskTextureSize`，256 足够日常使用；超大笔刷可降至 128 |
| **上传频率** | 每次 `TOUCH_MOVE` 事件上传**一次**（批量写像素后统一上传）|
| **"越擦越白"** | ✅ 天然支持，像素值叠加至 255 |
| **缺点** | 极高分辨率贴图（>512）时 CPU 开销会上升 |

---

## 总结：核心结论

1. **Cocos Creator 3.x 的 2D Sprite 不会渲染到离屏 Camera 的 RenderTexture**，该限制无法通过配置绕过。
2. **自定义 2D Shader 顶点阶段必须用 `cc_matViewProj`**，不能用含 `cc_matWorld` 的 3D 着色器。
3. **`getMaterialInstance()` 必须在节点 `active` 后（`onEnable`）调用**，否则破坏 RenderData。
4. **CPU 侧 `Texture2D.uploadData()` 是 Cocos 3.x 下实现动态遮罩贴图的正确且高效路径。**
5. **V 轴翻转**：`_paintBrush` 不翻转 uvY；Shader 采样时翻转 `1.0 - v_uv.y`；两者缺一不可。
