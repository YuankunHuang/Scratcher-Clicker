# Dev Plan

## Phase 0 — 基础设施 ✅

- [x] 项目架构（Clean Architecture / Service Locator / Composition Root）
- [x] GameManager（init / dispose / restart 幂等生命周期）
- [x] ServiceLocator + Tokens
- [x] EventManagerImpl
- [x] AudioManagerImpl（stub）
- [x] SaveManagerImpl（stub）
- [x] UIManagerImpl（窗口栈、异步加载、show 队列、WindowAttributes 全功能）
- [x] WindowControllerBase（Template Method 生命周期）
- [x] @windowController 装饰器 + WindowRegistry 自动注册
- [x] AppFlow 启动流程
- [x] Services 门面
- [x] 窗口：Loading / Login / Main / Confirm / Demo
- [x] Editor Toolbox 扩展（Window Manager）
- [x] 竖屏分辨率（720×1280，Fit Width）

---

## Phase 1 — 技术验证 ✅（待真机确认）

目标：刮擦手感足够爽。非玩家拿到手划 30 秒说"好解压"即通过。

- [x] ScratchRenderer（CPU 像素操作，Texture2D + Uint8Array，零 GC）
- [x] scratch_dirt_mask.effect 自定义着色器
- [x] DemoWindow 集成（onProgress 回调、resetScratch）
- [x] 已擦除面积百分比计算（coverage grid）
- [ ] 替换软边笔刷图（画刷边缘羽化，美术资产任务）
- [ ] 真机测试：快速划动维持 60fps

---

## Phase 2 — MVP 单局闭环

目标：一个完整的单局，从头到尾没有死路，数值有意义。

**数据层**
- [ ] GameData：coins / reputation / artifactSlots / museumCollection
- [ ] ArtifactConfig（配表）：id / name / rarity / baseValue / isNationalTreasure
- [ ] ArtifactInstance（运行时）：configId / cleanPercent / condition

**流程**
- [ ] 刮擦进度达 90% 自动触发鉴定
- [ ] AppraisalWindow：名称 + 估值 + 品相 + 卖出/捐献
- [ ] 国宝级：强制捐献，卖出禁用
- [ ] 卖出/捐献后更新数据，金币飞入动画
- [ ] 流程结束随机生成下一件文物

**工具升级**
- [ ] 3 档工具：刷子 / 抛光机 / 高压水枪（影响画刷半径）
- [ ] UpgradeWindow：当前工具 + 升级费用

**博物馆（最小版本）**
- [ ] MuseumWindow：已捐献文物列表
- [ ] 未收集显示黑色剪影

**音效（从 stub 接入真实实现）**
- [ ] 刮擦音效（划动速度影响音量）
- [ ] 发现文物音效
- [ ] 金币音效

---

## Phase 3 — 内容填充

前提：Phase 2 已被真实玩家验证好玩。

**文物内容**
- [ ] 至少 30 件文物（跨 5 个历史时期）
- [ ] 5 种材质（陶瓷/青铜/玉器/书画/金器），不同手感和音效
- [ ] 3 件流失国宝（真实历史原型，捐献触发专属动画）
- [ ] 套装系统：集齐同系列解锁全局 Buff

**探索层**
- [ ] 出海打捞地图：4~6 个区域，消耗燃料，随机叙事事件卡

**喜剧层**
- [ ] NPC 送宝：每日 1~2 个，搞笑文物，砍价小游戏

**深度层**
- [ ] 鉴定问答：3 道选择题，答对影响估值 +30%
- [ ] 开场剧情：外公手记第一页 + 房东催租事件

**Idle 层**
- [ ] 雇佣学徒：自动处理普通文物，支持离线收益

**工程**
- [ ] 配表工具：CSV/Excel → JSON
- [ ] 资源命名规范 + 打包策略
- [ ] SaveManager 从 stub 变为真实实现

---

## Phase 4 — 社交 & 联机

前提：单机有稳定玩家基础，且有后端工程师。**Phase 2 完成前不碰。**

- [ ] 微信账号登录 + 云存档
- [ ] 博物馆互访（异步）
- [ ] 文物碎片交换
- [ ] 声望排行榜
- [ ] 全服限时协作事件
- [ ] 后端（Golang）

---

## 横切关注点

- 每个功能完成后立刻真机跑一遍
- 每周检查 DrawCall 和 Overdraw
- SaveManager 数据结构变更必须做版本迁移
- 每进入新阶段前重新评估并删掉不必要的项

---

## 决策记录

| 日期 | 决策 | 原因 |
|---|---|---|
| 2026-04 | 竖屏 720×1280，Fit Width | 微信小游戏主战场全竖屏，Fit Width 适配最稳定 |
| 2026-04 | 题材：文物修复/寻宝 | 情感上限高，图鉴终局强于纯数值，口碑传播力强 |
| 2026-04 | Phase 1 只验证手感 | 刮擦若不够爽，题材和逻辑都白写 |
| 2026-04 | 联机推迟到 Phase 4 | 后端成本极高，单机未验证前接入必死 |
| 2026-04 | 配表用 CSV/Excel | 策划可独立维护，降低主程瓶颈 |
