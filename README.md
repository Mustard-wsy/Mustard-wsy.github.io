# mustard-wiki

一个记录个人笔记、实验和喜欢的事物的网站。「迷途未远」是作者的建站初衷，在关于页说明。

项目已完成第一轮可运行界面：使用 Astro、TypeScript 和普通 CSS，实现首页、文章阅读、玩具架及关联页面。已加入桌面侧边 / 手机底部玩具速览。正式站已部署至 [mustard-wiki](https://mustard-wsy.github.io/)，预览样例继续隔离。

## 本地运行

环境：Node.js 22.12+，npm。当前验证环境为 Node.js 22.23.2、npm 11.14.1。

```sh
npm ci
npm run dev:demo
```

打开终端提示的本地地址，默认 `http://127.0.0.1:4321/`。`dev:demo` 使用 `fixtures/` 中隔离的预览样例，顶部会显示“设计预览”。它不会混入正式内容。

| 命令                    | 用途                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev:demo`      | 有样例内容的视觉开发预览                                         |
| `npm run dev`           | 仅使用 `content/` 中的正式内容                                   |
| `npm run check`         | Astro 与 TypeScript 检查                                         |
| `npm run build`         | 正式构建，输出 `dist/`                                           |
| `npm run build:demo`    | 样例构建，输出 `dist-demo/`                                      |
| `npm run preview`       | 查看已生成的正式构建                                             |
| `npm run preview:demo`  | 查看已生成的样例构建                                             |
| `npm test`              | 构建并检查生产、预览和 `/Blog/` 子路径，产物放在 `test-results/` |
| `npm run format`        | 统一代码和文档格式                                               |
| `npm run format:check`  | 检查格式                                                         |
| `npm run publish:watch` | 监测发布目录，检查通过后自动提交上传（需先连接仓库）             |
| `npm run publish:notes` | 单次检查、提交并上传内容（需先连接仓库）                         |
| `npm run verify:build`  | 检查 `dist/` 中的站内链接和资源                                  |

目前尚未录入作者的正式文章与玩具，因此正式模式的列表为空。这是预期行为；新增内容的字段见[内容指南](docs/04-content-guide.md)。关于页文本根据对话整理，正式发布前应复核。

## 修改入口

- `src/lib/site.ts`：站名、身份信息、简短个人介绍。
- `content/pages/about.md`：关于页正文。
- `content/writing/`、`content/toys/`、`content/topics/`：正式文章、玩具和专题。
- `src/styles/global.css`：视觉 token、排版、组件与响应式样式。
- `src/components/` 与 `src/layouts/`：共享组件和全局布局。
- `fixtures/`：仅供设计预览的样例，不是作者已发表的内容。

已连接公开个人站仓库 [Mustard-wsy.github.io](https://github.com/Mustard-wsy/Mustard-wsy.github.io)，首次上传、GitHub Pages 工作流与公网部署已验证，操作见[托管与日常发布](docs/08-publishing.md)。部署地址由 Pages 工作流传入；未配置 `SITE_URL` 的本地构建不生成 canonical。RSS 与站点图尚未补齐。

首次连接仓库后，运行 `npm run publish:watch`，再把打磨好的 Markdown 复制到 `content/writing/`，配图与脚本放入 `public/media/<slug>/`。文件稳定 10 秒且检查通过后自动提交上传；进程需保持运行。单次发布用 `npm run publish:notes`，笔记格式参考 `templates/note.md`。支持 Markdown 中的原生 HTML 与浏览器脚本。

## 文档导航

| 文档                                                   | 回答的问题                                         |
| ------------------------------------------------------ | -------------------------------------------------- |
| [总体规划](docs/01-product-plan.md)                    | 为什么做、为谁做、第一版做什么？                   |
| [设计哲学与视觉规范](docs/02-design-system.md)         | 网站应呈现什么气质，如何判断设计是否合适？         |
| [信息架构与页面模板](docs/03-page-templates.md)        | 每种页面如何组织，内容少或缺失时如何处理？         |
| [内容模型与写作模板](docs/04-content-guide.md)         | 如何新增文章、专题和玩具，而不修改页面代码？       |
| [工程与维护约定](docs/05-engineering.md)               | 如何实现、发布、检查和持续维护？                   |
| [决策记录与实施路线](docs/06-decisions-and-roadmap.md) | 哪些已经决定，哪些待定，下一步如何推进？           |
| [协作者入口](AGENTS.md)                                | 后续开发者或 AI 开始工作前需要知道什么？           |
| [首轮实现与验收](docs/07-implementation-status.md)     | 当前能运行什么、验证过什么、下一步做什么？         |
| [托管与日常发布](docs/08-publishing.md)                | 如何免费托管、复制笔记并自动发布、添加 HTML 交互？ |

## 当前共识

- 名称为 `mustard-wiki`，采用浅冷色底、阶梯像素边框、短硬阴影和工作台布局。首页仅展示个人介绍与玩具架、笔记库入口，具体内容放在各自页面，不使用励志标语或页边寄语。
- 主导航为「文章 / 玩具 / 关于」，站名返回首页。
- 玩具是正式内容，不以简历价值衡量；小玩具和完整项目共用可扩展模板。
- 不把具体玩具深度嵌入全站，不为每个作品增加专属布局或全局交互。
- 内容采用 Markdown 与结构化元数据，目标是新增内容时无需修改页面代码。
- 目标部署平台为 GitHub Pages，第一版不依赖服务端、数据库或付费域名。
- 技术框架为 Astro 7 + TypeScript，npm 管理依赖；规划功能与已实现能力通过实施记录区分。

## 阅读与更新

首次参与建议按文档编号阅读。讨论与文档发生变化时，应在同一次变更中更新对应规范；重要方向调整补充决策记录，不让多个文件保留互相冲突的结论。

本仓库不包含虚构文章、虚构使用数据或假定已经发布的项目成果。页面示意与内容模板中的占位内容不应进入正式发布。
