# FloraLab Studio 1.1 — Anywhere

FloraLab 是一套 **0 OpenAI API、0 本地 AI** 的现实创意花艺工作流。

它由两个互补工作空间组成：

- **FloraLab 创作空间（ChatGPT Project）**：负责灵感、自然语言讨论、参考图理解、视觉探索、图片生成/修改与制作复盘。
- **FloraLab Studio**：负责确定性的 Recipe、预算、制作检查、Composition、Stem Blueprint、五视图、制作消耗、损耗、反馈和项目文件。

1.1 Anywhere 将 Studio 从本地 Node 服务迁移为 **纯前端 PWA**。正式使用时不需要运行 `server.js`、不需要电脑常开，也不需要同一 Wi‑Fi；GitHub Pages 可以直接在电脑、手机和平板访问。

## 1.1 核心能力

- 117 种核心/参考花材 + 13 类创意物料。
- Recipe：需要 / 已有 / 我的单价 / 还需购买 / 小计实时联动。
- Reality：预算、季节、供水、花泥适配、宠物风险、食品隔离、重物支撑、尺寸与稳定性。
- Composition：焦点、体块、线条、填充、留白和基础视觉重心建议，不输出假精确分数。
- Blueprint 2.0：稳定 Stem ID、x/y/z、长度、水平角、抬升角、阶段和锚点。
- Blueprint Editor：拖动、数值微调、锁定、镜像、复制、删除；五视图共享同一结构数据。
- Vessel + Mechanics：花器几何与固定结构锚点进入 Blueprint。
- Build Mode 2.0：分阶段制作、已用、剩余、损耗、缺口和替代建议。
- 成品文字记录、版本历史与上一版本地备份恢复。
- `.floralab` 导入/导出；兼容 V5 `floralab/0.5` 并验证重复 Stem ID、负数配方、非法坐标等错误。
- A4 打印制作单。
- IndexedDB 设备内项目保存。
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

Node.js 18+：

```bash
npm run test:release
npm start
```

完整本地 QA（包含浏览器 UI）使用：

```bash
npm run test:qa
```

`npm start` 只是开发/验收静态站点，不是正式用户运行 Studio 的要求。

## 资料入口

- `docs/COMPLETE_PLAN.md`：完整架构
- `docs/WORKFLOW.md`：从创作到归档的流程
- `docs/PROJECT_SETUP.md`：ChatGPT Project 设置
- `docs/DEPLOYMENT.md`：GitHub Pages 部署
- `DATA_FORMAT.md`：`.floralab` 格式
- `KNOWN_LIMITS.md`：真实边界
- `QA_REPORT.md`：最终验收
