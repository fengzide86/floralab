# FloraLab 1.1 Data Format

## 文件扩展名

1.1 继续使用主扩展名 `.floralab`，并保持 `floralab/1.0` schema 兼容。

文件内容为 UTF-8 JSON。Studio 仍兼容 `.floralab.json` 和普通 `.json` 导入，用于兼容旧版本与调试。

## 顶层 schema

```json
{
  "schema": "floralab/1.0",
  "project": {},
  "intent": {},
  "assessment": {},
  "composition": {},
  "recipe": [],
  "dimensions": {},
  "mechanics": {},
  "blueprint": {},
  "build": {},
  "resultFeedback": null,
  "history": [],
  "plan": {}
}
```

`plan` 保存完整 Studio 作品状态；顶层关键字段方便创作空间快速读取。

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
id              稳定 Stem ID
material_id     材料 ID
name            材料名
kind            flower / creative
x y z           作品坐标
length_cm       结构长度
yaw_deg         水平角
pitch_deg       抬升角
head_cm         花头/主体视觉尺寸
stage           制作阶段
anchor_id       固定结构锚点
locked          是否锁定
```

Blueprint 坐标用于保持视图身份、方向和层级一致，不代表毫米级物理测量。

## Build

记录当前制作阶段、已用材料、损耗、缺口、备注和完成状态。

## Result Feedback

只记录现实事实：实际难度、耗时、问题、备注与完成时间。不保存虚假“还原百分比”。

## History

Recipe、Blueprint 与成品记录的主要变更都会写入版本历史。设计版本号位于 `handoff.version`。

## 导入安全

Studio 1.0 在导入前检查：

- 是否存在可识别作品结构；
- Recipe 是否为数组；
- 数量/已有/单价是否为非负有限数值；
- Blueprint node 是否有 ID；
- Stem ID 是否重复；
- x/y/z 是否为有限数值；
- 未知 schema 与未收录材料会给兼容提醒。

旧 `floralab/0.5` 会迁移到当前运行结构，包括补齐 Blueprint 2.0 的 vessel / mechanics / anchor 字段。

## Render Handoff 1.3

FloraLab 1.3 does **not** create a second editable Recipe. A top-level `render` section may be included in exported `.floralab` files as a deterministic handoff snapshot.

Authoritative sources remain:
- `recipe`: material identity, color/variant, quantity.
- `mechanics`: fixing, support and hydration structure.
- `blueprint`: 3D node positions, high/low, left/right, front/back, directions and silhouette.

`render` is regenerated from those sources and never overwrites them. Import validation warns when a stale Render Spec disagrees with Recipe quantities.

Render Spec v1.0 includes dimensions, primary view, exact material/count handoff, countability notes, packaging, vessel, Mechanics, special-object anchors, focus nodes, silhouette, visual mass, height/depth layers, directional flow, inferred sparse zones, visual freedom and post-generation self-check items.

No fidelity percentage is stored because generative imagery cannot support that precision.
