# FloraLab 开发工作流

## 目标

从 1.4 开始，FloraLab 不再把 GitHub `main` 当试验台，也不再把每一次小改动都送进完整发布 Gate。

开发目标同时满足两件事：

1. **更快反馈**：低级语法、核心逻辑、Render 和静态契约在几十秒到几分钟内暴露。
2. **最终质量不降**：真正进入 `main` 前，仍执行完整自动测试、本地 Desktop/Mobile 逐页、Pages 部署、线上逐页和人工检查。

## 工作区职责

### Cloud Dev Workspace / Codespace

真正的源码工作台。拥有完整 Git 目录，可搜索、重构、运行脚本、查看 diff、启动本地页面。

仓库已加入 `.devcontainer/devcontainer.json`：
- Node 22
- Python 3.12
- 2 CPU / 4 GB 的最低主机要求
- 自动转发 4173 端口
- 创建后先执行源码语法检查

不启用 Codespaces prebuild，避免没有必要的额外构建和存储消耗。

### Google Drive

项目大脑，不作为源码工作目录。保存：
- 长期进度与跨对话记忆
- 产品方向与 UX 决策
- 设计参考和素材
- 代表性 `.floralab` fixtures
- Release / QA 摘要

### GitHub

版本事实源。

分支：
- `main`：只放通过正式验收的版本
- `dev/1.4-foundation-creative-flow`：1.4 集成分支
- `feature/*`：独立开发事项

### GitHub Pages

正式产品。

## 反馈层级

### FAST

每次 feature / dev push 运行：

`npm run check:fast`

当前包含：
- JavaScript syntax
- browser runtime build
- engine regression
- Render regression
- static contract

它不是发布验收，只用于快速发现开发错误。

### TARGETED

当某个界面或模块有明显视觉变化时，只检查受影响页面。例如：
- 首页修改 → Desktop Home + Mobile Home
- Render 修改 → Desktop Render + Mobile Render
- Blueprint 修改 → Blueprint 相关视图

1.4 已新增 `ui_1_4.py` 作为 54 页完整发布 Gate，并继续用 FAST / TARGETED 做日常增量验证。后续再把完整 Gate 按页面族进一步拆分，避免一个长流程的状态污染另一个流程。

### RELEASE GATE

只有准备合并 `main` 时执行：
1. 完整自动测试
2. Desktop 逐页
3. Mobile 逐页
4. 人工修复真实 UI 缺陷
5. squash / merge main
6. Actions / Pages
7. 正式线上逐页复验
8. Drive 记录最终 SHA / run / 下一接回点

## 0 成本优先

仓库是 public，因此标准 GitHub-hosted Actions runner 对 public repo 免费。GitHub Pages 也可用于 public repo。

Codespaces 使用个人账户每月包含额度；当前 GitHub Free 为 120 core-hours + 15 GB-month。开发默认只需要 2-core 规格，并且用完就 Stop。不要启用 prebuild。

为了避免任何意外付费，账户层建议把 Codespaces 预算设置成 **$0 / Stop usage when budget limit is reached**。这是 GitHub 账户级设置，不能由仓库文件替代。

## 原则

- 不为了“快”降低最终验收门槛。
- 不为了“严格”让每次小改都承担完整发布成本。
- 自动测试应该尽量测行为，不只测源码字符串。
- 真实图片必须验证成功解码，不只验证路径。
- 导航和交互必须实际点击验证，不只检查文字存在。
