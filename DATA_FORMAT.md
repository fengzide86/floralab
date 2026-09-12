# FloraLab Data Format — floralab/2.0

## 文件扩展名

主扩展名仍为 `.floralab`。文件内容为 UTF-8 JSON。

Studio 同时接受 `.floralab.json` 与普通 `.json` 导入，用于兼容旧版本和调试。

## 2.0 的核心原则

`floralab/2.0` 只保留**一份权威作品状态**：

> `plan` 是唯一可编辑、可迁移、可继续制作的事实源。

顶层不再复制 Recipe、Blueprint、Mechanics、exploration 等字段，避免同一事实存在两份版本。

## 顶层结构

```json
{
  "schema": "floralab/2.0",
  "project": {
    "id": "...",
    "title": "...",
    "version": 1,
    "branch_id": "...",
    "family_id": "..."
  },
  "render": {},
  "plan": {}
}
```

字段含义：

- `schema`：当前文件格式版本。
- `project`：轻量元数据，仅用于识别作品、版本和分支关系。
- `render`：派生 Render Spec 快照，非权威。
- `plan`：完整权威作品状态。

## plan

常见内容：

```text
creativeBrief
exploration
request
recipe
dimensions
vessel
mechanics
blueprint
composition
compositionIntent
checks / assessment
build
resultFeedback
history
handoff
```

### Creative Brief

`creativeBrief.idea` 保存用户最初的想法。它不会取代 Recipe 或 Blueprint，而是给分支与受控 Variation 保留创作上下文。

### Exploration / Branch

`exploration` 保存：
- branch id / parent / family
- locks
- lastVariation

Lock 用来限制未来 Variation 可以改变哪些维度，不会反向篡改当前作品事实。

## Recipe

每一项至少表达：

```text
key
kind
id / name
quantity
owned
unit
unit_price
to_buy
subtotal
```

核心恒等式：

```text
to_buy = max(0, quantity - owned)
subtotal = to_buy × unit_price
```

材料身份、颜色/variant 和数量以 `plan.recipe` 为权威。

## Mechanics

固定、支撑与供水方式以 `plan.mechanics` 为权威。

## Blueprint 2.0

同一作品的所有施工视图共享一份三维点位：

```json
{
  "version": "2.0",
  "views": ["front", "left", "back", "right", "top"],
  "vessel": {},
  "mechanics": {"anchors": []},
  "nodes": []
}
```

Stem node 主要字段：

```text
id
material_id
name
kind
x y z
length_cm
yaw_deg
pitch_deg
head_cm
stage
anchor_id
locked
```

Blueprint 坐标用于保持视图身份、方向和层级一致，不代表毫米级物理测量。

## Render Spec 1.0

顶层 `render` 是由以下事实即时推导的非权威快照：

- `plan.recipe`
- `plan.mechanics`
- `plan.blueprint`

它可以包含尺寸、主要视图、材料与数量交接、包装、花器、特殊物件锚点、焦点、轮廓、视觉重量、高低/前后层次、方向、推导留白区、视觉自由区与生成后自检项。

若 `render` 与 `plan` 冲突，`plan` 胜出并重新生成 Render Spec。

不保存生成图“还原率”百分比。

## Build

记录当前制作阶段、已用材料、损耗、缺口、备注和完成状态。

## Result Feedback

只记录现实事实：实际难度、耗时、问题、备注与完成时间，不保存虚假“还原百分比”。

## History

Recipe、Blueprint、Creative State、Build 与反馈的主要变化都会写入历史。设计版本号位于 `plan.handoff.version`。

## 导入校验

Studio 导入前检查：

- 是否存在可识别的作品对象；
- Recipe 是否为数组；
- 数量 / 已有 / 单价是否为非负有限数值；
- Blueprint node 是否有 ID；
- Stem ID 是否重复；
- x / y / z 是否为有限数值；
- 未知 schema 与未收录材料会给兼容提醒；
- 若派生 Render Spec 与 Recipe 数量冲突，会提示并以权威 `plan` 重新生成。

## 旧格式迁移

继续兼容：

- `floralab/1.0`
- `floralab/0.5`

1.0 旧文件可能同时含有顶层 Recipe / Blueprint 与 `plan`。迁移时以完整 `plan` 为作品状态，补齐当前 Creative State / Blueprint 等必要字段，并转换到当前运行 schema。

0.5 文件继续走旧版本迁移，再进入当前 2.0 运行结构。

重新导出时统一写出 `floralab/2.0`。
