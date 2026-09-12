# FloraLab Studio 1.4.0 — Release Candidate QA Report

验收日期：2026-09-12

## 结论

1.4.0 的本地 Release Candidate 已完成正式发布前验收。当前基线以 `floralab/2.0` 作为作品交接结构，新增 idea-first 创建、Direction 工作区、8 类锁定、6 个受控构图变化、非破坏式分支与方向对比，同时保留 1.3 Render Handoff、Blueprint、Build、Material Library 与既有导入兼容。

本地自动 Release Gate：**745 / 745**。完整浏览器 UI Gate：**103 / 103**，生成 **54 张逐页截图（26 Desktop + 28 Mobile）**。54 页已按实际页面尺度人工逐页检查；短暂 Toast 不进入最终验收截图，材料详情截图等待真实图片成功解码后再保存。

| 套件 | 结果 |
| --- | ---: |
| Engine regression | 126 / 126 |
| Render regression | 37 / 37 |
| Creative State 1.4 | 33 / 33 |
| Variation 1.4 | 46 / 46 |
| Creative Flow 1.4 | 14 / 14 |
| `.floralab` v2 handoff | 25 / 25 |
| Project Kit | 40 / 40 |
| Static contracts | 66 / 66 |
| PWA logic | 35 / 35 |
| Icon / asset dimensions | 16 / 16 |
| Material Library | 191 / 191 |
| 38 个真实场景 | 116 / 116 |
| **Release Gate 合计** | **745 / 745** |
| Browser UI | **103 / 103** |
| Visual pages | **54：26 Desktop + 28 Mobile** |

## 1. 1.4 Creative Flow

- 新建作品先表达想法、感觉、形式、颜色和已确定物件；预算、尺寸、月份、宠物与 Mechanics 收进现实制作约束。
- 新作品生成后先进入「方向」，而不是被专业表单过早打断。
- Creative State 保存 branch / family / locks / lastVariation。
- 锁定维度：materials / colors / quantities / vessel / special_objects / packaging / mechanics / structure。
- 六个受控方向：轻盈留白、右上延伸、左侧舒展、低位横向、雕塑感、收束聚焦。
- Variation 采用非破坏式 Fork；原方向保留，并可在同一作品家族中切换和对比。

## 2. `.floralab` 2.0

`floralab/2.0` 使用一个 canonical authoritative plan 作为单一事实源。Recipe / Mechanics / Blueprint 仍是确定性事实；Render Spec 为由这些事实推导的非权威快照，不建立第二份可编辑 Recipe。旧 `floralab/1.0` 与 `0.5` 文件保持可导入并迁移。

## 3. Foundation

- `package.json` 是 Studio 应用版本唯一事实源；1.4.0 的 runtime / service worker 构建从这里派生版本。
- Studio schema / Blueprint / Render / Engine 版本集中在 `lib/versions.js`。
- 浏览器存储使用稳定、版本无关的 key，并迁移既有 1.1 / 1.0 / V5 / V4 数据。
- Storage、Shell、Home、Create、Direction 已从旧单体前端中拆分，并纳入语法 / Fast Gate。

## 4. Material Library 与现实信息

发布前材料图审计保持 130 个可视条目全部可解析，发布包继续由 `qa/material_visual_sources.py` 生成本地镜像资源。人工逐页特别复查：

- 猫环境高风险不泄露内部值 `block_cat`。
- 创意物料详情不出现字面量 `\n`、`undefined`、`null`、`[object Object]` 等内部 token。
- 参考条目明确标记需核实，不把未知宠物风险、季节或结构适配写成确定事实。
- 食品物料保留与花水 / 湿花泥隔离提醒。

## 5. Visual Gate

1.4 完整视觉 Gate 为 `qa/ui_1_4.py`：

- Desktop 26 页。
- Mobile 28 页。
- 保留 1.3 的首页、创建、Overview、Recipe、Structure、Render、Build、Feedback、History、材料库、安装与 Creative Space 覆盖。
- 新增 Direction 初始状态、Variation 列表、Branch Compare 的 Desktop / Mobile 页面。
- 截图前等待 transient toast 消失；材料详情等待 `<img>` 完成解码并具有有效 naturalWidth / naturalHeight。

## 6. 发布边界

本报告记录 **1.4.0 本地 RC** 的最终发布前事实。正式交付还必须经过 GitHub release branch runner、合入 `main`、Pages 部署以及线上同一套 54 页 Gate；最终 commit SHA、Actions run 和线上结果记录在 FloraLab 的 Google Drive 长期进度文档中。
