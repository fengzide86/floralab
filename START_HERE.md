# FloraLab 1.1 — 从这里开始

你现在拿到的是一套完整的 FloraLab 工作流，不是单独一个网站。

## 你真正会用到的两部分

### 1. FloraLab｜花艺创作空间

运行在 ChatGPT Project 里。它负责灵感、审美、图片理解、效果参考、图像生成/修改、制作中照片判断和成品复盘。

设置方法：

1. 在 ChatGPT 新建 Project，名称建议：`FloraLab｜花艺创作空间`。
2. 打开 `project-kit/PROJECT_SYSTEM_PROMPT.md`，全文复制到 Project Instructions。
3. 将 `project-kit/` 里其余文件上传到该 Project。
4. 之后直接自然聊天即可，不需要记固定命令。

这套 Project Instructions 是原则型的：它告诉模型 FloraLab 的目标、Studio 的事实边界和设计气质，但不规定模型必须先问什么、必须给几个方案，也不会限制它使用图片、研究、推理或创意能力。

### 2. FloraLab Studio 1.1 Anywhere

Studio 负责 Recipe、材料数量、已有/需买、用户价格、Reality、Composition、花器/固定结构、Blueprint 五视图、制作消耗、损耗和版本。

正式形态是 GitHub Pages PWA：电脑、手机、平板都打开同一个线上 Studio，不需要 Node、不需要电脑常开、不需要 OpenAI API，也不需要本地 AI。

## 第一次启用线上 Studio

GitHub 仓库已经有完整源码和自动部署 workflow，GitHub runner 的 release tests 已全部通过。

现在只差一次仓库设置：

`GitHub floralab 仓库 → Settings → Pages → Build and deployment → Source → GitHub Actions`

设置后，到 `Actions → Deploy FloraLab Studio` 重新运行 workflow。成功后正式地址是：

`https://fengzide86.github.io/floralab/`

以后 main 分支更新会自动测试并部署，不需要重复设置。

## 电脑怎么用

最推荐：用 Edge / Chrome 打开线上 Studio，选择“安装 FloraLab”。安装后 Windows 开始菜单和应用列表里会像普通 App 一样打开。

如果只想要桌面快捷入口，解压 `FloraLab-Desktop-Shortcut-1.1.zip`，双击：

`安装 FloraLab.cmd`

它会在桌面和开始菜单创建 `FloraLab Studio` 快捷方式。

## 手机怎么用

- iPhone / iPad：Safari 打开 Studio → 分享 → 添加到主屏幕。
- Android：Chrome 打开 Studio → 安装应用 / 添加到主屏幕。

手机不依赖电脑开机。

## 跨设备怎么用

当前不做账号云同步。

电脑：`导出作品 → xxx.floralab`

通过微信 / AirDrop / 云盘 / 文件发送到手机。

手机 Studio：`导入作品`。

反向也一样。`.floralab` 是正式作品档案，也是 ChatGPT 创作空间与 Studio 之间的桥。

## 一套作品的完整流程

```text
ChatGPT 创作空间
  灵感 / 看图 / 视觉方向 / 效果参考
        ↓
FloraLab Studio
  Recipe → Reality → Composition → Blueprint → 五视图
        ↓
制作模式
  使用量 → 剩余 → 损耗 → 替代
        ↓
导出最新 .floralab
        ↓
ChatGPT 创作空间 + 实拍照片
  制作调整 / 成品复盘
```

## 建议下载顺序

如果只想最省事：下载 `FloraLab-Complete-1.1.zip`。

里面已经包含：Studio、Project Kit、Windows 快捷入口、完整方案、使用流程、Project 设置、部署说明、系统提示词和 QA 报告。
