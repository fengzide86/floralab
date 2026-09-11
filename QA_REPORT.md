# FloraLab Studio 1.2.0 Material Library — QA Report

验收日期：2026-09-11

## 结论

1.2.0 的目标是在保留 1.1.2 Workspace UI、1.1 Anywhere、Recipe、Reality、Composition、Blueprint 2.0、Build、文件兼容和 Project 工作流的前提下，把材料库从检索列表升级为真正可浏览、可理解、可核实的 Material Library / Botanical Archive，并把逐页视觉验收纳入正式发布门槛。

当前 1.2 发布前自动验收通过：**409 项非视觉 release checks + 67 项浏览器 UI checks = 476 项检查全部通过**。最终视觉集包含 **44 张独立页面截图（21 Desktop + 23 Mobile）**，按页面与关键滚动位置逐张人工检查；Contact Sheet 不作为单页通过依据。部署到 GitHub Pages 后，正式线上 URL 再重复同一套 **67 项 / 44 页** Visual Gate 并通过。

| 套件 | 结果 |
| --- | ---: |
| Core / Reality / Recipe / Blueprint / Build | 126 / 126 |
| 38 套真实场景 | 116 / 116 |
| Project Kit 1.1 | 27 / 27 |
| Static / GitHub Pages architecture | 39 / 39 |
| PWA / Service Worker logic | 28 / 28 |
| Icon / asset dimensions | 16 / 16 |
| Material Library 1.2 | 57 / 57 |
| Desktop + Mobile browser UI | 67 / 67 |
| **发布前自动检查合计** | **476 / 476** |
| 构建态逐页视觉截图 | **44 页：21 Desktop + 23 Mobile** |
| 正式 Pages 线上复验 | **67 / 67 + 44 页** |

## 1. 浏览器化迁移

验证 1.1 Runtime 能在浏览器直接执行原 Studio 的设计生成、Recipe 更新、Blueprint 编辑、Build 损耗、反馈与导入校验，不再通过 HTTP `/api/*` 网络请求。1.0 的 126 项核心回归与 38 套场景全部保持通过。

## 2. GitHub Pages / PWA

验证：

- HTML/CSS/JS/数据/图标均使用相对路径，可部署到 `/floralab/`。
- manifest 为 standalone PWA，start_url 与 scope 为相对路径。
- Service Worker 预缓存首页、Runtime、样式、应用脚本、材料数据、主视觉和关键图标。
- Service Worker install / activate / fetch 逻辑在 VM 中执行验证。
- GitHub Actions workflow 在发布前运行 release tests，并部署 `public/`。

## 3. IndexedDB 与跨设备

浏览器 UI 验证项目会写入设备存储语义层，并保留旧 localStorage 迁移/回退逻辑。跨设备正式方式仍为导出 `.floralab` → 传输 → 另一设备导入；没有虚构云同步。

## 4. Project Kit 1.1

验证系统提示词包含：FloraLab 身份、Studio/创作空间关系、`.floralab`、图像能力、现实事实边界和“相信模型综合判断”的原则；并明确检查提示词没有强制固定方案数量或硬编码“必须先问预算”等流程门槛。

## 5. 浏览器 UI

真实 Chromium 执行前端和 Runtime，覆盖：

- 首页 / 创建 / 作品 / 材料 / 结构 / 制作 / 材料库。
- Recipe 修改。
- Blueprint 五视图、复制、删除、结构字段。
- Build 使用量与损耗。
- 成品反馈。
- `.floralab` 导出与另一会话导入。
- 桌面与手机无核心横向溢出；手机结构标签降噪。
- 安装入口与 PWA 提示。
- 页面运行期间没有未处理 console error。

### 环境说明

发布前 Build Visual Gate 通过 Playwright `set_content` 加载真实 `public/` 构建产物，并用路由拦截返回真实 Runtime/CSS/JSON/SVG 资源；这一模式使用轻量 IndexedDB/localStorage mock，目的是稳定验证页面逻辑与视觉。

1.2 最终流程另外增加 **post-deploy online verify**：Pages deploy 成功后，Playwright 直接访问正式 `https://fengzide86.github.io/floralab/`，不再使用本地路由或存储 mock，并重新执行同一套 67 项浏览器检查与 44 张截图。由此实际覆盖 GitHub Pages 子路径、线上静态资源加载、真实浏览器存储 API 路径与正式部署后的页面视觉。

仍不把 headless 浏览器等同于用户真实设备：操作系统级 PWA 安装体验、不同手机浏览器的系统分享/安装 UI、跨浏览器重启后的长期 IndexedDB 持久性，仍属于真实设备接受性范围。

## 6. 人工视觉检查

人工查看 1.1 桌面和手机截图。Atelier 设计方向保持：作品和任务优先、暖象牙白、深梅紫、编辑式排版、少 Badge / 少后台感。最终截图前清除短暂 Toast，避免把运行状态混入正式验收图。

## 7. GitHub Runner 验证

正式仓库 `fengzide86/floralab` 的 GitHub Actions 已在 Ubuntu runner 上执行与本地相同的 `npm run test:release`。在修复首次上传时被中转连接器截断的 `data/catalog.json` 后，GitHub runner 实际输出为：

- engine-regression：126 / 126
- project-kit-1.1：27 / 27
- static-1.1：37 / 37
- pwa-1.1：26 / 26
- assets-1.1：16 / 16
- scenarios-regression：116 / 116（38 套场景）

即 **GitHub release gate 348 / 348 通过**；1.1.1 浏览器 UI 已扩展到 44 项，因此完整本地 QA 为 **392 / 392**。

GitHub Pages 已由仓库所有者切换为 **GitHub Actions** 发布源，随后 workflow 的 build 与 deploy 均成功；正式地址为 `https://fengzide86.github.io/floralab/`。


## 8. 1.1.1 视觉验收

本轮以 2026 主流专业工具和平台设计系统作为参照，不直接复制视觉语言：

- Linear 2026 UI refresh：更安静、一致、易扫读，外围导航弱化，内容区更突出。
- Figma UI3：工作/画布中心化，工具位置可预测，极简不能牺牲专业效率与可访问标签。
- Raycast 2.0：原生感、熟悉感与克制的材质层级；视觉效果必须服务功能。
- Apple WWDC26 / HIG：内容优先、跨尺寸适配、可读性、清楚命名、熟悉交互。
- Material 3 Expressive：用尺度、颜色、形状、动效与容器有目的地突出关键动作，并强调更大的触控目标和高对比度。

FloraLab 保留 Atelier 编辑感，不跟随“大量玻璃、漂浮卡片、霓虹渐变”的泛化趋势。采用的改动集中在信息层级、可读性、触控、轻量材质感和品牌图标简化。

视觉自动验收新增：手机菜单完整性、菜单触控目标、Recipe 数量控件触控目标、Tab 触控目标、项目副标题对比度、非激活 Tab 对比度、Kicker 对比度。

## 9. 1.1.2 工作尺度与发布收口

1.1.2 重点不是增加新能力，而是把已有能力整理成真正可工作的界面：

- Desktop：保留编辑式排版，但 Recipe、Blueprint Editor、Build、反馈和材料库使用更大的正文、字段和操作目标。
- Mobile：不再把桌面版机械压缩；工具页使用紧凑作品头部、横向 Tab、分块 Recipe、大触控 Blueprint 控件和现场制作按钮。
- Blueprint：未选中标签默认降噪；选中/hover 后显示，避免结构图被编号覆盖。
- Library：修复搜索输入窄屏溢出。
- Branding：使用用户确认的紫色花叶 F 图标作为唯一图标源，由构建脚本生成各平台资源。
- Cache：Service Worker 升级为 `floralab-1.1.2`。

GitHub Actions 对 1.1.2 UI 与图标提交的最新发布运行已完成：build 成功、release gate 成功、Pages deploy 成功。随后补齐 1.1.2 的 package / Runtime / static gate / README / Changelog / QA Report 版本一致性，并以新的 Actions 运行作为最终发布门禁。


## 10. 1.2 Material Library 与逐页视觉门禁

1.2 将 Material Library 作为独立前端模块接入，不重构 Recipe / Blueprint / Build 引擎。Catalog 仍是现实材料事实来源，前端新增公开枝长、花头、重量、茎强度、脆弱度、高峰月份和市场等级等已存在字段；创意物料公开重量、固定、防水与食品属性。

Material Library 的现实边界：

- `reference_only` 始终可见，不把资料不完整的条目包装成完整事实。
- 宠物风险未知时显示“需核实”，不等同于安全。
- 静态价格继续标为方案内参考，不冒充实时花市价。
- verified 材料事实图必须在 `material-visuals.json` 记录来源与许可；当前没有可靠图时使用明确占位，禁止用生成图冒充植物识别事实。
- 创意物料使用独立详情模板，食品、湿区、重量和固定方式优先于花材字段。

### 1.2 自动发布门禁

- engine-regression：126 / 126
- project-kit-1.1：27 / 27
- static-1.1：39 / 39
- pwa-1.1：28 / 28
- assets-1.1：16 / 16
- library-1.2：57 / 57
- scenarios-regression：116 / 116（38 套场景）
- ui-1.2：67 / 67

非视觉 release gate 合计 **409 / 409**；加发布前浏览器 UI 检查后为 **476 / 476**。Pages 部署后再重复 **67 / 67** online browser checks。

### 逐页视觉验收

- Desktop：21 个状态；Mobile：23 个状态；合计 44 张独立截图。
- 除首页、新建、作品总览、Recipe、Structure、Build、Library 外，还覆盖 Feedback、History、移动菜单、安装弹窗、创作空间弹窗、搜索/筛选/Empty State、核心与参考材料详情，以及长页下半段的生成按钮、Composition、Structure Inspector、Build Actions、Feedback 保存按钮、宠物安全与食品隔离。
- 额外逐一渲染全部 **117 花材 + 13 创意物料 = 130 个详情页**，扫描内部枚举、undefined、null、NaN、字面量转义等开发痕迹；最终无泄漏。
- 逐页人工检查中实际发现并修复：Recipe 材料详情绑定空值回归、筛选状态误导、详情页进入位置、内部枚举直出、reference-only 新手状态被布尔化、宠物风险等级混用、HTML 字面量转义、CJK QA 字体、作品标题孤字换行、移动 History 标题被按钮挤压、安装弹窗后菜单未收起，以及安全警告/长页关键控制未进入原验收视口等问题。
- 正式 Pages deploy 后使用线上 URL 重跑同一套 67 项 / 44 页。以 Run #90 为基准，构建态与线上态逐页像素比较：**39 页完全 0 差异，5 页仅历史时间字符区域有极小预期差异**；这 5 页每页仅 57 个像素点变化，未发现布局、资源、字体、颜色或交互状态漂移。
- 发布只有在 **build → release gate → build visual gate → Pages deploy → online visual verify** 全部成功后才成立。


## 11. 1.2 最终发布状态

最终发布工作流采用三段式门禁：

1. **build**：409 项非视觉 release checks + 67 项 build browser checks + 44 张构建态截图。
2. **deploy**：GitHub Pages 正式发布。
3. **verify**：直接访问正式 Pages URL，重复 67 项 browser checks、44 张线上截图与 130 个材料详情 surface audit。

三个 job 均成功才视为 1.2 发布完成。正式地址：`https://fengzide86.github.io/floralab/`。
