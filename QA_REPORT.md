# FloraLab Studio 1.2.0 Material Library — QA Report

验收日期：2026-09-11

## 结论

1.2.0 的目标是在保留 1.1.2 Workspace UI、1.1 Anywhere、Recipe、Reality、Composition、Blueprint 2.0、Build、文件兼容和 Project 工作流的前提下，把材料库从检索列表升级为真正可浏览、可理解、可核实的 Material Library / Botanical Archive，并把逐页视觉验收纳入正式发布门槛。

当前 1.2 自动验收通过：**404 项非视觉 release checks + 56 项浏览器 UI checks = 460 项检查全部通过**。此外，最终视觉集包含 **27 张独立页面截图（13 Desktop + 14 Mobile）**，按页面逐张人工检查；Contact Sheet 不作为单页通过依据。

| 套件 | 结果 |
| --- | ---: |
| Core / Reality / Recipe / Blueprint / Build | 126 / 126 |
| 38 套真实场景 | 116 / 116 |
| Project Kit 1.1 | 27 / 27 |
| Static / GitHub Pages architecture | 39 / 39 |
| PWA / Service Worker logic | 28 / 28 |
| Icon / asset dimensions | 16 / 16 |
| Material Library 1.2 | 52 / 52 |
| Desktop + Mobile browser UI | 56 / 56 |
| **自动检查合计** | **460 / 460** |
| 逐页视觉截图 | **27 页：13 Desktop + 14 Mobile** |

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

本次执行环境中的 Chromium 被管理员策略禁止直接导航 localhost / file URL。UI QA 因此通过 Playwright `set_content` 加载真实 `public/` 页面，并用路由拦截返回真实 Runtime/CSS/JSON/SVG 资源。为绕过 about:blank 的浏览器存储权限限制，QA 注入轻量 IndexedDB/localStorage mock 仅验证应用的存储调用与恢复语义。

因此，**原生 Service Worker 注册、浏览器真正的“安装 PWA”按钮、真实设备 IndexedDB 持久性**无法在该沙箱中声称完成端到端自动化验证。它们已通过静态/VM/资源结构检查，并应在 GitHub Pages 首次上线后用用户真实 Windows + 手机做最终接受性检查。

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
- library-1.2：52 / 52
- scenarios-regression：116 / 116（38 套场景）
- ui-1.2：56 / 56

非视觉 release gate 合计 **404 / 404**；加浏览器 UI 检查后为 **460 / 460**。

### 逐页视觉验收

- Desktop：D01–D13，共 13 页。
- Mobile：M01–M14，共 14 页。
- 覆盖首页、新建、作品总览、Recipe、Structure、Build、移动菜单、Library 首页、搜索、筛选、核心花材详情、参考条目、宠物安全、创意物料与 Empty State。
- 逐页人工检查中实际发现并修复：Recipe 材料详情绑定空值回归、筛选状态误导文案、详情页进入位置、内部枚举直出英文、CJK QA 字体、作品预览标题孤字换行，以及安全警告截图未真正进入视口等问题。
- 每次修复后重新运行全部 release tests 和 27 页浏览器 Visual Gate；发布仅在 build / visual gate / Pages deploy 全部成功后成立。
