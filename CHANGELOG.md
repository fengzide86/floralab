# FloraLab Changelog

## 1.1.0 — Anywhere

- Studio 从常驻 Node/API 架构迁移为浏览器内确定性 Runtime；正式使用不需要本地服务器。
- 保持 `floralab/1.0` 项目 schema 和 Blueprint 2.0，避免 1.0 项目因部署架构升级失效。
- 新增 IndexedDB 设备内项目存储，并迁移旧本地保存键。
- 新增 PWA manifest、Service Worker、离线核心资源缓存和安装入口。
- 全站资源改为相对路径，适配 GitHub Pages `/floralab/` 子路径。
- 新增正式图标体系：浏览器、PWA、iOS、Android、Windows 快捷方式。
- 新增 Windows `安装 / 打开 / 卸载 FloraLab` 快捷入口。
- 新增 GitHub Actions：push `main` 后先运行 release tests，再部署 Pages。
- Project Kit 升级为 1.1：系统提示词从“流程规则”改为“原则与事实边界”，明确保留模型自身推理、视觉、研究和创造能力。
- 增加完整架构、使用流程、Project 设置和部署文档。

## 1.0.0

- Blueprint 2.0、可交互五视图、Vessel/Mechanics、Build Mode 2.0、Composition、117 种花材、成品记录、版本历史、安全导入与 A4 制作单。