# FloraLab Studio 1.4.1 — Sprout Identity QA Report

验收日期：2026-09-12

## 结论

1.4.1 是 1.4.0 Foundation & Creative Flow 之上的品牌与视觉补丁，不改变 Recipe、Mechanics、Blueprint、Render Spec、Build 或 `.floralab` 的事实语义。主品牌从旧紫色切换到 Sprout Green，首页使用用户确认的“结构线稿 → 真实花艺”视觉；花材和作品自身颜色仍保持事实颜色。

## 本地自动验收

- Release Gate：745 / 745
- FAST：65 / 65
- Static：66 / 66
- UI Gate：103 / 103
- 视觉页：54 页（26 Desktop + 28 Mobile）

## 人工逐页验收

已按实际页面截图逐页检查 26 个 Desktop 与 28 个 Mobile 状态。重点复核：首页 Hero、PWA/品牌 Icon、全站 active / focus / primary action、材料真实颜色、Blueprint 选中态、Render 结构轮廓、Direction / Variation / Branch、材料库、安装与 Creative Space 弹窗。

人工检查发现 Render View 的 silhouette / focus guide 仍残留旧紫色；已改为 Sprout Green 后重跑 54 页 Gate。紫色花材、紫白作品 Palette 与对应 Blueprint 节点仍保留紫色，这是作品事实，不属于品牌残留。

## 视觉边界

1.4.1 只完成 Sprout Identity，不把 1.5 产品重构混进补丁。Direction 首屏大留白、Variation 缺视觉预览、Branch Compare 偏文字、Render 结果优先级、Feedback 照片对照等问题继续作为 1.5 Visual Creative Loop 的产品事项。

## 发布边界

本报告记录本地 1.4.1 RC。正式交付仍需：GitHub release branch Gate → main 单一提交 → Pages → 线上同一套 54 页 Gate → build / online 逐页比对。最终 SHA 与 Actions run 写回 FloraLab 长期进度文档。
