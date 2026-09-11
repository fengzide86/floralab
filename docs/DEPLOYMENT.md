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