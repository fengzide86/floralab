# GitHub Pages 部署

正式仓库：`fengzide86/floralab`

目标地址：`https://fengzide86.github.io/floralab/`

仓库包含 `.github/workflows/deploy-pages.yml`。每次推送 `main` 后，GitHub Actions 会运行 release tests，通过后将 `public/` 部署到 GitHub Pages。

首次部署还需要在 GitHub 仓库完成一次设置：

`Settings → Pages → Build and deployment → Source → GitHub Actions`

完成一次后，后续推送可自动测试并部署。

## 本地检查

```bash
npm run test:release
npm start
```

`npm start` 只用于开发/验收，不是用户使用 Studio 的前提。正式用户使用 GitHub Pages/PWA。

## 当前首次上线状态

源码已提交，GitHub runner 的 `npm run test:release` 已全部通过。当前只差仓库所有者首次开启 Pages：

1. 打开 `Settings`。
2. 左侧进入 `Pages`。
3. 在 `Build and deployment` 中将 `Source` 设为 **GitHub Actions**。
4. 回到 `Actions → Deploy FloraLab Studio`，重新运行失败的 workflow，或在仓库产生一次新提交后等待自动运行。

这一步完成后，后续 `main` 更新会自动测试并部署，不需要重复开启。
