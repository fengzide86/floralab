# FloraLab 代码结构与维护入口

适用于 1.5.3。完整产品方向见 [产品优化方案](PRODUCT_OPTIMIZATION.md)。

## 调用方向

```text
index.html
  ├─ runtime.js（生成文件）
  │    └─ browser/runtime-entry.js
  │         ├─ 目录加载：fetch、合并并发、失败后重试
  │         └─ lib/runtime.js：应用内请求适配器
  │              └─ lib/studio.js：作品操作与校验编排
  │                   ├─ engine.js：候选方案与现实规则
  │                   ├─ recipe.js：数量、已有、需购与金额
  │                   ├─ exploration.js：锁定与分支
  │                   ├─ composition-grammar.js：构图变化
  │                   └─ versions.js：文件格式版本
  ├─ core/storage.js：本机存储与恢复
  ├─ core/shell.js：全局导航
  ├─ views/*：读取状态，生成 HTML/SVG
  └─ app.js：装配依赖，绑定用户操作，保存与刷新
```

视图工厂接收明确依赖；不会依靠 app.js 的词法全局变量。Blueprint 视图读取当前节点，选择失效节点后的回退由 app 控制层完成。Render 视图接收 buildRenderSpec，不自行寻找全局运行时。

## 改动放在哪里

| 要改什么 | 源文件 | 主要验证 |
| --- | --- | --- |
| 方案生成、否定词与颜色解释 | lib/engine.js，后续可分离 intent | engine-regression + 场景回归；明确哪些基线行为要有意改变 |
| 需购、价格、预算 | lib/recipe.js、lib/studio.js 的更新入口 | Recipe 与导入导出一致性 |
| 五视图呈现 | public/views/blueprint.js | 冻结状态渲染 + 拖动和参数 UI 检查 |
| 成品、制作页面 | public/views/making.js | 制作步骤、实耗、反馈保存、手机逐页 |
| 作品总览、清单、打印 | public/views/work.js | 清单输入、详情入口、打印与导出 |
| 效果图交接 | public/views/render.js 与 lib/studio.js 的 Render Spec | 事实锁定、分枝材料说明、版本一致性 |
| 请求路由与错误 | lib/runtime.js | runtime-architecture 请求行为测试 |
| 浏览器目录加载 | browser/runtime-entry.js | 加载失败重试、并发合并、子路径 URL |
| 图像来源 | data/material-visual*、data/material-photo-sources.json | material_visual_sources.py |
| 新 JS 模块 | 对应源目录 | check:syntax 自动发现；视图还需接入 index 和离线资源清单 |

## 构建

`npm run build` 从 browser/runtime-entry.js 递归收集静态 CommonJS 依赖，把模块正文原样包装进 public/runtime.js。只有 crypto 使用显式列出的浏览器兼容模块。未知外部依赖、循环依赖、越出仓库根目录的模块在构建时失败。

打包器只支持当前项目采用的静态字符串 require，不支持动态 require、ESM、npm 依赖解析、代码分割或 source map。如这些需求出现，应采用成熟构建工具；不要继续扩展成自制通用打包器。保持无运行时第三方依赖，降低当前静态站部署复杂度。

public/runtime.js、public/library.js、public/data 与图标由现有脚本产生，不应直接修改生成内容。库源目前仍是 data/library-source-parts；这是保留的技术债务，不属于本轮已拆分部分。

## 兼容与测试

1. tests/fixtures/runtime-1.5.2.json 来自正式基线 commit 137f282，固定时间与 UUID 序列，记录花束、极简瓶插和创意花礼三个场景的完整输出摘要。
2. 每个场景覆盖生成、Render Spec、handoff、数量/已有/价格修改、锁定、变体、移动节点、制作进度、反馈及导入。结构重构必须保持一致。
3. 这些基线也包含旧产品局限。后续有意改变规则时，增加能解释新行为的测试，并有针对性地更新相关快照；不能通过整批重录来掩盖未知回归。
4. 新视图使用冻结的方案和状态执行渲染测试，避免渲染函数悄悄写入事实或应用状态。
5. 索引中加载的每个脚本必须在离线核心清单中；新增模块漏掉离线配置会被检测。

常用命令：`npm run check:fast`、`npm run test:release`、`npm run test:ui`。check:syntax 自动检查 browser、lib、public、scripts、tests 下的 JS 文件。

本轮没有修改 IndexedDB 版本、浏览器存储键、.floralab/2.0 schema、Node/浏览器中的历史散列算法，也没有批量迁移用户作品。新增目录加载重试只影响故障恢复。

## 后续技术债务

- app.js 仍负责多个工作区的控制逻辑，按功能迭代逐步抽控制器；本轮不是整个前端架构改写。
- studio.js 仍包含 Blueprint、制作与文件迁移编排，后续按行为测试保护逐步拆分。
- 部分历史测试检查源码字符串，仍较脆弱；新增验证优先选择真实输入输出与浏览器行为。
- 原始自由文本解析、空对象导入与恢复目标说明需要专项修正；保持兼容不等于这些行为已经正确。
- 媒体和跨设备能力需要先完成存储、大小限制、导出迁移和版本过期规则，再添加图片入口。
- 公开 API 路径是浏览器内部调用契约，不是远端服务器；不要为了调整 UI 引入不必要的后端。
