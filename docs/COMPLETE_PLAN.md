# FloraLab 完整方案

## 产品目标

FloraLab 是一套“从一个想法，到真正做出来”的现实创意花艺工作流。它由两个互补空间组成：ChatGPT Project 负责创意、视觉和理解；FloraLab Studio 负责材料、结构、预算、制作和版本事实。

## 最终架构

```text
ChatGPT Project｜FloraLab 创作空间
  灵感 / 对话 / 看图 / 视觉探索 / 图像生成与修改 / 制作复盘
                    ⇅
                 .floralab
                    ⇅
FloraLab Studio 1.1 Anywhere｜GitHub Pages PWA
  Recipe / Reality / Composition / Blueprint / 五视图 / Build / Feedback
```

Studio 采用纯前端架构，不调用 OpenAI API，不运行本地模型，也不要求电脑作为服务器。确定性规则直接在浏览器执行，作品数据默认保存在设备 IndexedDB；跨设备使用 `.floralab` 文件。

## 设备与入口

- Windows：推荐把线上 Studio 安装为 PWA；交付包同时提供 `安装 FloraLab.cmd` 创建桌面与开始菜单快捷方式。
- iPhone：Safari 打开线上 Studio 后“添加到主屏幕”。
- Android：Chrome/兼容浏览器使用“安装应用”或“添加到主屏幕”。
- 浏览器：直接访问 GitHub Pages 地址即可。

## 数据原则

`.floralab` 是正式项目格式。它保存设计意图、Recipe、花器、Mechanics、Blueprint、Build、Feedback 和历史。浏览器自动保存只属于当前设备；用户主动导出 `.floralab` 才是跨设备和长期归档的可靠方式。

## 设计原则

Studio 继续使用 Atelier 视觉：暖象牙白、深梅紫、灰绿、墨黑褐，强调作品、留白与编辑感，避免 AI SaaS 仪表盘风格。创作空间的 Project Instructions 采用原则型设计，不固定模型回答步骤或方案数量。

## 当前不做

1.1 不加入账号系统、云数据库、自动跨设备同步、商城、支付、供应商、社区、广告、OpenAI API、本地 AI、AR 或实时花市价格。需要跨设备时导出 `.floralab`，通过微信、AirDrop、网盘或文件系统传输后导入。