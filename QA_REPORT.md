# FloraLab Studio 1.1 Anywhere — QA Report

验收日期：2026-09-11

## 结论

1.1 的核心目标是把 1.0 的 Studio 能力迁移为 GitHub Pages/PWA，而不牺牲 Recipe、Reality、Composition、Blueprint 2.0、Build、文件兼容和 Project 工作流。

当前本地 release gate 通过：**392 项检查全部通过**。

| 套件 | 结果 |
| --- | ---: |
| Core / Reality / Recipe / Blueprint / Build | 126 / 126 |
| 38 套真实场景 | 116 / 116 |
| Project Kit 1.1 | 27 / 27 |
| Static / GitHub Pages architecture | 37 / 37 |
| PWA / Service Worker logic | 26 / 26 |
| Icon / asset dimensions | 16 / 16 |
| Desktop + Mobile browser UI | 44 / 44 |
| **合计** | **392 / 392** |

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