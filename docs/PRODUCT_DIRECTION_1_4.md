# FloraLab 1.4｜Foundation & Creative Flow

## 产品方向修正

“好玩”不是把 FloraLab 游戏化，也不是把它做成抽卡、任务或挑战系统。

这里的“好玩”指：

> **创作过程有探索欲、有变化、有即时反馈，又不会被专业表单和制作细节过早打断。**

FloraLab 仍然是一套可以把想法落到现实制作的花艺系统，只是前半段应该更像自然创作，后半段在用户确认“我要做它”之后再切换到严谨制作。

## 1.4 的双目标

### A. Foundation

解决 1.3 之前暴露出来的开发问题：
- `public/app.js` 过大，状态、路由、视图、PWA、导入导出混在一起。
- `lib/studio.js` 同时承担 Recipe / Blueprint / Render / Build / migration 等多个 domain。
- `runtime.js` 通过源码正则转换与字符串拼接构建，长期较脆。
- UI QA 是一条很长的共享状态流程，容易互相污染。
- 某些静态测试只检查源码字符串，而非真实行为。
- 版本号和计划文档存在漂移。

1.4 Foundation 的目标：
- 模块化，不重写成 React/Vue。
- 优先使用原生 ES Modules 或轻量 bundler。
- 加入 `checkJs` / 类型检查，尽早抓到 element/NodeList 等低级错误。
- 拆分 UI tests，页面/功能自己建立状态。
- 建立 Fast / Targeted / Release 三层验证。
- 收敛版本号来源。
- 设计 `.floralab v2`，去掉顶层数据与 `plan` 的重复事实；保留旧文件迁移。

### B. Creative Flow

解决“作品能做，但创作过程还不够有吸引力”的问题。

不是增加游戏任务，而是把用户路径改成：

**想法 → 看见明显不同的方向 → 调整/锁定 → 收敛成一个版本 → 我要做它 → 进入现实制作**

核心能力：
- Variations：同一想法生成真正不同的构图方向，而不是只换颜色或套固定花材模板。
- Lock：可锁材料、颜色、数量、花器、特殊物件、轮廓，再变化其他部分。
- Remix：对当前版本做受控变化，例如更轻、更偏、更疏、更强方向感。
- Branch：从当前作品 Fork A/B/C，不破坏原版本。
- Compare：并排比较不同版本真正变化了什么。

## Composition Grammar

现有 deterministic Blueprint 的优点是稳定，但偏“稳定撒点”。1.4/1.5 开始把它升级为两层：

1. **Composition Grammar**
   - silhouette
   - visual mass
   - focus
   - direction
   - density
   - symmetry/asymmetry
   - negative space
   - texture

2. **Stem Placement**
   - 每一枝再落到具体三维点位

Blueprint 继续负责现实位置、长度、角度和施工，但它的上游会真正理解“为什么这枝在这里”。

## 不优先做

当前不把精力投入：
- CRM
- 合同/支付
- 报价工作流
- 客户门户
- 重型库存 ERP
- 为了数量而大规模扩充低质量材料库
- 表面游戏化

钱/采购仍保留为现实制作信息，但不再主导默认创作入口。

## 分阶段

### 1.4A｜Development Foundation
云端工作区、模块边界、Fast check、独立 UI QA、版本统一。

### 1.4B｜Creative State Model
明确哪些是事实、哪些可锁、哪些是 variation；为 Branch / Remix 做数据基础。

### 1.4C｜Creative Flow UI
首页/新建不再把预算放在最前；先表达主题、感觉、材料或参考，再逐渐收敛。

### 1.4D｜Variation + Lock
做第一版受控 variation，确保不同方向是真正的构图差异。

### 1.4E｜Release
完整回归、Desktop/Mobile 逐页、main、Pages、线上复验。

## 成功标准

不是“功能数量增加”，而是：
- 修改一个小功能时反馈明显更快。
- 低级错误在 FAST 阶段暴露，不靠最后人工才发现。
- 同一创意可以得到多个真正不同但合理的方向。
- 用户不会因为进入专业制作模式而失去前面的创作自由。
- 最终仍能把确定版本可靠交给 Recipe / Mechanics / Blueprint / Render / Build。
