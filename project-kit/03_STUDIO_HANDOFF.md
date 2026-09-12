# Studio Handoff

`.floralab` 是创作空间与 Studio 共享的作品档案。

## floralab/2.0

2.0 采用**单一权威事实源**：

- 顶层 `plan` 保存完整、可编辑、权威的作品状态。
- Recipe / Mechanics / Blueprint / exploration / Build / Feedback 等都从 `plan` 读取。
- 顶层 `project` 只保存轻量项目元数据，方便识别文件和分支。
- 顶层 `render` 是由 `plan.recipe`、`plan.mechanics`、`plan.blueprint` 即时推导的 Render Spec 快照，**不是第二份 Recipe，也不是权威状态**。
- 不再把 Recipe、Blueprint、exploration 等同时复制到顶层和 `plan`，避免同一事实出现两份互相冲突的数据。

典型结构：

```text
schema
project
render          # derived / non-authoritative
plan            # authoritative
  creativeBrief
  exploration
  request
  recipe
  dimensions
  vessel
  mechanics
  blueprint
  build
  resultFeedback
  history
```

## Render Handoff

当文件带有顶层 `render` / Render Spec：

- 材料种类、颜色和数量始终以 `plan.recipe` 为准。
- 固定、支撑与供水始终以 `plan.mechanics` 为准。
- 高低、左右、前后、方向、特殊物件点位和主要轮廓始终以 `plan.blueprint` 为准。
- 若 Render Spec 与上述事实冲突，忽略冲突快照并从当前 `plan` 重新生成。
- Render Spec 用于表达焦点、轮廓、视觉重量、层次、前后、主要方向、稀疏区、特殊物件位置和生成后自检项。
- 不使用“还原率 94%”这类假精确分数。

## Creative State

`plan.exploration` 保存分支与锁定状态。它描述“未来允许改变什么”，不会反向覆盖已经确定的 Recipe / Mechanics / Blueprint。

`plan.compositionIntent` 可记录当前受控 Variation 的构图方向，例如轻盈留白、右上延伸、低位横向等。

## 兼容导入

Studio 继续接受：
- `floralab/1.0`
- `floralab/0.5`

旧文件导入后迁移为当前运行结构；重新导出时使用 `floralab/2.0`。

使用原则：
- 当前问题与数量、成本、结构、制作进度相关时，以最新文件中的 `plan` 为强事实来源。
- 用户说“做效果图 / 看看成品 / 按这个生成”时，默认可视化当前版本，不重新设计。
- 用户明确说“重新设计 / 推翻 / 做另一版”时，可以突破旧版本，并视为新方向。
- 不要默默改掉用户要求保持不变的部分。
