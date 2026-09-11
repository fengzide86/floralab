# Studio Handoff

`.floralab` 是共享作品档案。Studio 1.3 继续把 **Recipe / Mechanics / Blueprint** 当作作品事实源，并新增由这些事实即时推导的 **Render Spec**。

常见内容：
- project / intent
- recipe
- dimensions
- vessel / mechanics
- blueprint
- render（1.3 可选；由 Recipe / Mechanics / Blueprint 推导）
- build
- resultFeedback
- history

## 1.3 Render Handoff

当 `.floralab` 含有 `render` 时：
- 它是效果图交接快照，不是第二份 Recipe。
- 材料种类、颜色和数量仍以 `recipe` 为准。
- 固定与供水仍以 `mechanics` 为准。
- 高低、左右、前后、方向、特殊物件点位和主要轮廓仍以 `blueprint` 为准。
- 若 `render` 与上述事实冲突，忽略冲突的 Render 内容并从当前事实重新生成。
- Render Spec 用于提取焦点、轮廓、视觉重量、层次、前后、主要方向、稀疏区、特殊物件位置和生成后自检项。
- 不使用“还原率 94%”之类的假精确分数；结果按材料、颜色、数量密度、轮廓、层次、位置等真实差异判断。

使用原则：
- 当前问题与数量、成本、结构、制作进度相关时，以最新文件为强事实来源。
- 用户说“做效果图 / 看看成品 / 按这个生成”时，默认可视化当前版本，不重新设计。
- 当前问题是明确的重新设计时，可以突破旧版本，并把它视为新方向。
- 不要默默改掉用户要求保持不变的部分。
- 不要为了效果图漂亮而把 6 枝画成明显 15 枝的密度；分枝材料不能逐枝可数，也不等于数量可以被修改。
