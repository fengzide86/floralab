# FloraLab Studio — Render Handoff & Build Workspace

FloraLab 是一套 **0 OpenAI API、0 本地 AI** 的现实创意花艺工作流。

它由两个互补工作空间组成：

- **FloraLab 创作空间（ChatGPT Project）**：负责灵感、自然语言讨论、参考图理解、视觉探索、图片生成/修改与制作复盘。
- **FloraLab Studio**：负责确定性的 Recipe、预算、制作检查、Composition、Stem Blueprint、五视图、Render Handoff、制作消耗、损耗、反馈和项目文件。
- **Render Handoff**：从 Recipe / Mechanics / Blueprint 即时生成效果图交接，不复制第二份可编辑 Recipe；冲突时始终以作品事实源为准。

Studio 现在是 **纯前端 PWA**。正式使用时不需要运行 `server.js`、不需要电脑常开，也不需要同一 Wi‑Fi；GitHub Pages 可以直接在电脑、手机和平板访问。

当前版本 **1.6.0**：四个任务区串起想法、方案比较、材料准备、制作与成品记录。新建首屏即可开始，明确排除材料、配色与数字数量可核对；图片归属作品并标记旧设计版本，支持含图片导出、材料替换、采购、实耗撤销与快照恢复。IndexedDB v2 原位升级保留旧作品，图片和作品原子提交；继续保留既有模块化与格式兼容能力。

- [产品优化方案](docs/PRODUCT_OPTIMIZATION.md)：竞品取舍、逐页设计、分期与验收。
- [代码结构与维护入口](docs/ARCHITECTURE.md)：模块边界、源文件与兼容测试。
- [1.6.0 发布记录](docs/release-1.6.0.md)：本次已实现范围、验收与使用边界。
- [1.5.3 发布记录](docs/release-1.5.3.md)。
- [1.5.2 视觉更新记录](docs/release-1.5.2.md)。

以下 1.2 段落保留早期演进背景；当前验收数量与结果以最新发布记录为准。

1.2 在 1.1.2 工作尺度基础上，把原来的材料搜索列表升级为真正的 **Material Library / Botanical Archive**：117 种花材与 13 类创意物料可以按名称、别名、角色、颜色、季节和制作属性检索；详情页展示尺寸、需水、脆弱度、瓶插/花泥适配、季节、替代关系与现实提醒，并与当前 Recipe 建立查看关系。

1.2 同时把 **逐页视觉验收** 升级为正式发布门槛：21 个 Desktop 状态 + 23 个 Mobile 状态，共 48 张独立截图，覆盖主页面、长页关键滚动位置与弹窗；Contact Sheet 不再代替单页验收。GitHub Pages 部署后还会用正式线上 URL 再跑同一套 48 页。

## 当前核心能力

- 117 种核心/参考花材 + 13 类创意物料；Material Library 支持搜索、角色/颜色/季节/制作筛选与独立详情。
- Recipe：需要 / 已有 / 我的单价 / 还需购买 / 小计实时联动。
- Reality：预算、季节、供水、花泥适配、宠物风险、食品隔离、重物支撑、尺寸与稳定性。
- Composition：焦点、体块、线条、填充、留白和基础视觉重心建议，不输出假精确分数。
- Blueprint 2.0：稳定 Stem ID、x/y/z、长度、水平角、抬升角、阶段和锚点。
- Blueprint Editor：拖动、数值微调、锁定、镜像、复制、删除；五视图共享同一结构数据。
- Vessel + Mechanics：花器几何与固定结构锚点进入 Blueprint。
- Build Mode 2.0：分阶段制作、已用、剩余、损耗、缺口和替代建议。
- 成品文字记录、版本历史与上一版本地备份恢复。
- `.floralab` 2.0 导入/导出：`plan` 是唯一权威事实源，顶层 Render 仅为派生快照；兼容 `floralab/1.0` 与 V5 `floralab/0.5`，并验证重复 Stem ID、负数配方、非法坐标等错误。
- A4 打印制作单。
- IndexedDB 设备内项目保存。
- Material Detail：形态、制作、季节时间轴、宠物/食品等现实提醒、替代关系与当前作品用量。
- Verified Visual Registry：材料事实图必须记录来源与许可；没有可靠图片时明确显示占位，不用生成图冒充材料识别图。
- PWA 安装与离线缓存。
- Windows 桌面快捷入口安装包。
- Principle-based ChatGPT Project Kit：保留模型自身判断和创造能力，不把对话锁进固定步骤。

## 正式使用

线上目标地址：

`https://fengzide86.github.io/floralab/`

Windows 推荐直接安装 PWA；也可以运行 `desktop/安装 FloraLab.cmd` 创建桌面与开始菜单快捷方式。

iPhone 使用 Safari 的“添加到主屏幕”；Android 使用浏览器“安装应用/添加到主屏幕”。

跨设备不依赖账号系统：在一台设备导出 `.floralab`，通过微信 / AirDrop / 云盘 / 文件发送到另一台设备后导入。

## ChatGPT Project

打开 `project-kit/00_START_HERE.md`。最重要的文件是 `project-kit/PROJECT_SYSTEM_PROMPT.md`，全文复制到 Project Instructions；其余资料上传到 Project。

## 开发与验收

Node.js 18+ 与 Python 3.12+。先安装构建和完整验收依赖：

```bash
python -m pip install pillow cairosvg playwright
```

浏览器验收可使用已安装的 Chrome、Chromium 或 Windows Edge；必要时用 `FLORALAB_BROWSER` 指定浏览器可执行文件。然后执行：

```bash
npm run test:release
npm start
```

完整本地 QA（包含浏览器 UI）使用：

```bash
npm run test:qa
npm run test:storage
```

`npm start` 只是开发/验收静态站点，不是正式用户运行 Studio 的要求。正式仓库的 GitHub Actions 会执行 release gate、48 页构建态 Visual Gate、Pages 部署，再对正式 Pages URL 重跑同一套线上 Visual Gate。

## 资料入口

- `docs/COMPLETE_PLAN.md`：完整架构
- `docs/WORKFLOW.md`：从创作到归档的流程
- `docs/PROJECT_SETUP.md`：ChatGPT Project 设置
- `docs/DEPLOYMENT.md`：GitHub Pages 部署
- `DATA_FORMAT.md`：`.floralab` 格式
- `KNOWN_LIMITS.md`：真实边界
- `QA_REPORT.md`：最终验收
