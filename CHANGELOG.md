# FloraLab Changelog

## 1.1.1 — Visual acceptance

- 对照 Linear 2026、Figma UI3、Raycast 2.0、Apple WWDC26/HIG 与 Material 3 Expressive 做线上视觉验收。
- 提高小号灰字、Tab、Kicker 的对比度；补充键盘 focus-visible。
- 手机关键按钮/Tab/数量控件扩大到约 40–44px 触控目标。
- 手机顶栏新增“菜单”，恢复材料库 / 新建 / 安装入口，不再为适配窄屏直接隐藏功能。
- 作品页视觉参考区改用当前 Blueprint 生成 composition study，避免大块空占位。
- 桌面导航保持静态，手机/窄屏使用轻量 sticky + 半透明层级，避免桌面长页工具条过度抢占内容。
- 品牌图标重新简化为植物 F 字标，16/32px 仍可辨识，并重新生成 PWA/Windows 图标。
- Service Worker 缓存版本升级到 `floralab-1.1.1`，确保线上视觉更新能替换旧缓存。
- Browser UI QA 增至 44 项，完整本地 QA 为 392 / 392。

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