# 美术资产清单 · 寻宝人

> 所有文件均为 **PNG / RGBA / 尺寸为 4 的倍数**。
> 处理方式：去白底 → 裁剪包围盒 → 等比缩放 Fit → 透明像素填充 Pad，不拉伸内容。

---

## artifacts/ · 文物图

### bronze_ding/ · 商代饕餮纹青铜鼎

| 文件 | 规格 | 界面 | 元素 | 说明 |
|---|---|---|---|---|
| `bronze_ding_dirty.png` | 512×512 · RGBA | MainWindow（刮擦界面） | 文物底图（Dirt 层下方） | 刮擦游戏中被 Dirt 层覆盖，随刮擦逐步露出；作为 `ScratchRenderer.baseSprite` 的 SpriteFrame 使用 |
| `bronze_ding_clean.png` | 512×512 · RGBA | AppraisalWindow（鉴定弹窗） | 文物展示图 | 刮擦进度≥90% 后在鉴定弹窗内展示，代表完整清洁后的文物外观 |

### ceramic_vase/ · 宋代影青釉梨形瓶

| 文件 | 规格 | 界面 | 元素 | 说明 |
|---|---|---|---|---|
| `ceramic_vase_dirty.png` | 512×512 · RGBA | MainWindow（刮擦界面） | 文物底图 | 同 bronze_ding_dirty，第二件可用文物；接入 `ArtifactConfig` 后通过 configId 动态加载 |
| `ceramic_vase_clean.png` | 512×512 · RGBA | AppraisalWindow（鉴定弹窗） | 文物展示图 | 同 bronze_ding_clean |

---

## scratch/ · 刮擦系统纹理

| 文件 | 规格 | 界面 | 元素 | 说明 |
|---|---|---|---|---|
| `brush_tip_soft.png` | 128×128 · RGBA | — | `ScratchRenderer` 笔刷贴图 | 亮度已转为 Alpha 通道（黑底白圆 → 透明软边圆）。在 `_paintBrush` 中用于 CPU 像素写入时的权重蒙版：`brushAlpha[u,v] / 255` 乘以涂抹强度。**替换项目内现有笔刷图时，将此文件放入 `assets/textures/scratch/` 并在 Inspector 中重新拖入 `ScratchRenderer.brushTex`** |
| `dirt_overlay.png` | 512×512 · RGBA | MainWindow（刮擦界面） | Dirt Sprite 的 SpriteFrame | 深棕泥土无缝纹理，覆盖在文物底图之上构成"待清洁"外观；配合 `scratch_dirt_mask.effect` 使用，由 `scratchMaskTex`（CPU Texture2D）控制透明度 |

---

## tools/ · 工具图标

| 文件 | 规格 | 界面 | 元素 | 说明 |
|---|---|---|---|---|
| `tool_brush.png` | 128×128 · RGBA | MainWindow 工具栏 / UpgradeWindow | 软毛刷图标 | 第一档工具（已解锁默认），画刷半径系数 ×1.0；显示于底部工具栏按钮及升级弹窗卡片 |
| `tool_polisher.png` | 128×128 · RGBA | MainWindow 工具栏 / UpgradeWindow | 抛光机图标 | 第二档工具，画刷半径系数 ×1.8；适合去除顽固锈迹 |
| `tool_watergun.png` | 128×128 · RGBA | MainWindow 工具栏 / UpgradeWindow | 高压水枪图标 | 第三档工具，画刷半径系数 ×3.0；需花费 🪙 30,000 解锁 |

---

## ui/ · 通用 UI 图标

| 文件 | 规格 | 界面 | 元素 | 说明 |
|---|---|---|---|---|
| `icon_coin.png` | 128×128 · RGBA | 所有界面顶部资源栏 / AppraisalWindow / UpgradeWindow | 金币图标 | 游戏内货币图标，方孔铜钱造型；建议在引擎中缩放至 40×40 px 使用 |
| `icon_reputation.png` | 128×128 · RGBA | 所有界面顶部资源栏 / AppraisalWindow | 声望图标 | 代表玩家社会声望积分，五角星 + 祥云纹徽章；建议在引擎中缩放至 40×40 px 使用 |

---

## museum/ · 博物馆

| 文件 | 规格 | 界面 | 元素 | 说明 |
|---|---|---|---|---|
| `artifact_locked.png` | 128×128 · RGBA | MuseumWindow（博物馆） | 未收集文物占位图 | 深色剪影，用于博物馆收藏网格中尚未入馆的格子；实际显示时建议叠加一层半透明蒙版以强化"未知"感 |

---

## 导入规范

```
assets/
└── textures/
    ├── artifacts/
    │   ├── bronze_ding/
    │   │   ├── bronze_ding_dirty.png
    │   │   └── bronze_ding_clean.png
    │   └── ceramic_vase/
    │       ├── ceramic_vase_dirty.png
    │       └── ceramic_vase_clean.png
    ├── scratch/
    │   ├── brush_tip_soft.png
    │   └── dirt_overlay.png
    ├── tools/
    │   ├── tool_brush.png
    │   ├── tool_polisher.png
    │   └── tool_watergun.png
    ├── ui/
    │   ├── icon_coin.png
    │   └── icon_reputation.png
    └── museum/
        └── artifact_locked.png
```

**Cocos 导入注意事项：**

1. `brush_tip_soft.png` 导入后，在 SpriteFrame Inspector 中确认 **Packable = false**（避免 DynamicAtlasManager 破坏 alpha 通道）。
2. `dirt_overlay.png` 同上，Packable = false，Wrap Mode 可设为 **Repeat** 以支持平铺。
3. 文物图（512×512）直接作为 Sprite 的 SpriteFrame 使用，SizeMode = **Custom**，并通过 Widget 组件适配不同屏幕比例。
4. 图标（128×128）在 Sprite 上缩放使用，无需 Widget。

---

## 待补充（Phase 3）

- 每件新增文物的 `_dirty.png` / `_clean.png`（共 30 件）
- 5 种材质的刮擦音效对应笔刷变体贴图
- NPC 立绘（外公、房东王姐、周教授、阿涛）
- 博物馆背景纹理 / 陈列柜装饰元素
- 稀有度边框贴图（金框、紫框、绿框）
