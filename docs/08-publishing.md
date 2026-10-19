# 托管与日常发布

更新日期：2026-10-12。公开仓库 [Mustard-wsy/Mustard-wsy.github.io](https://github.com/Mustard-wsy/Mustard-wsy.github.io) 已创建并上传，正式站 [mustard-wiki](https://mustard-wsy.github.io/) 已上线。首次 Actions 构建与部署成功，四个主要页面均返回 HTTP 200。

## 免费托管

采用 GitHub Free 的公开个人站仓库 `Mustard-wsy/Mustard-wsy.github.io`，目标网址为 `https://mustard-wsy.github.io/`。默认域名无需购买；公开仓库使用标准 GitHub-hosted runner 构建，不引入付费服务。免费政策应以平台当前规则为准。

依据：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Actions 费用](https://docs.github.com/en/billing/concepts/product-billing/github-actions)、[Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

公开仓库中的源文件和 Git 历史可被查看，`draft: true` 只隐藏网站内容。未打磨好的笔记继续留在作者的其他笔记目录；复制到本站的 `content/` 和 `public/` 代表允许上传这些文件。邮箱不写入网站配置，Git 提交建议使用 GitHub 的 noreply 地址。

## 首次配置

本机与当前仓库已完成以下配置，无需重复初始化。Git 使用本机现有系统代理 `http://127.0.0.1:7897`（仅仓库本地配置），证书校验开启；日后代理端口改变时更新 `git config --local http.proxy <地址>`，不再使用代理时运行 `git config --local --unset http.proxy`。认证由 Git Credential Manager 管理，未把凭据写入源码。

1. 登录 GitHub，新建公开仓库 `Mustard-wsy.github.io`，不自动生成 README、许可或 gitignore。
2. 网站目录首次建立 Git 仓库并提交代码；这一步只做一次。登录可通过 Git Credential Manager 首次 push 的提示完成，勿把令牌放入仓库。

```powershell
git init -b main
git config user.name Mustard-wsy
git config user.email 183261549+Mustard-wsy@users.noreply.github.com
git add .
git commit -m "Initial mustard-wiki site"
git remote add origin https://github.com/Mustard-wsy/Mustard-wsy.github.io.git
git push -u origin main
```

3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 Actions 中运行 **Publish mustard-wiki**，等待成功后访问页面，并检查首页、关于页、笔记库与玩具架。

`.github/workflows/pages.yml` 会在 `main` 收到提交时检查 Astro、构建正式内容、校验生成的内链与资源，再部署 `dist/`。仅使用 `content/`、`public/`，不会发布 fixtures 样例。构建失败不进行新的部署，原网站保留。

首次部署时没有真实文章、玩具与专题，正式站展示首页入口和内容页空状态。2026-10-15 已手动提交发布计算机网络前三章，配图和字段交互资源同步上线；部署与验证详情见实施记录。RSS 与站点图尚未补齐。

## 先在本地查看（不上传）

在网站目录运行：

```powershell
npm run dev:local
```

这个命令读取 `content/` 与 `public/`，包括 `draft: true` 的草稿，顶部显示“本地预览”。浏览器打开终端给出的 `127.0.0.1` 地址。它只启动本机服务器，不执行 Git 提交、push 或部署。Ctrl+C 停止。不要同时运行 `publish:watch` 或 `publish:notes`，这两个命令会上传文件，包括草稿源文件。

目前的本地笔记示例为 `content/writing/计算机网络/第1章_网络概述.md`：

```yaml
---
title: '网络概述 Introduction'
slug: 'network-01'
description: '概括文章讨论的内容。'
publishedAt: '2026-10-13'
draft: true
tags: ['计算机网络', '课程笔记']
---
## 1.1 因特网、协议与服务

正文从这里开始。
```

配置流程：

1. 把 `.md` 复制到 `content/writing/`，放在哪个文件夹就归属哪个合集。
2. 在文件最上方加入两行 `---` 包围的 YAML 元数据。title 是页面标题；slug 是稳定的文章地址，整个文章库内不可重复，只能用小写英文字母、数字和短横线（例如 `network-01`，不能写 `Network_01`），修改后访问地址也会改变；description 显示在文章列表；publishedAt 是计划发布日期，公开前改成实际日期；draft 保持 true；tags 可选。
3. 正文不用重复一级标题，因为页面会从 title 自动显示标题。保留 `##`、`###` 章节即可。
4. 合集默认使用文件夹名；需要名称、简介或 Logo 时添加 `_collection.json`。Logo 可省略，不必准备图片才能看文章。
5. 运行 `npm run dev:local`，从首页进入文章库 → 计算机网络 → 对应文章，也可直接打开 `/writing/network-01/`。
6. 修改并保存 Markdown，浏览器会更新；需要检查内容与代码配置时运行 `npm run check`。

`dev:local` 是真实内容及草稿预览，`dev:demo` 是 fixtures 样例预览，`dev` 只显示非草稿的真实内容。正式 `npm run build` 始终排除草稿，即使环境中遗留 `LOCAL_PREVIEW=true`。这个预览开关不会写进文章字段；今后准备发布时再把 draft 改为 false，并单独执行发布流程。

## 一键发布整个博客

可以保持本地预览运行再执行发布. 类型检查、测试构建与正式构建使用独立临时工作目录, 避免 Windows 下与预览争用 `.astro/` 而出现 `EPERM rename content-assets.mjs.tmp` 错误. 不需要管理员权限, 也不需要删除预览缓存. 临时目录位于 Git 忽略的 test-results, 不会随发布上传.

修改完成并保存后，在网站目录运行：

```powershell
npm run publish:site
```

需要已安装项目依赖（首次运行 `npm ci`），Git 已按上文配置。本命令使用 Node.js 22.21+ 的环境代理支持，本机 22.23.2 已满足。按作者选择，它会发布**全部未被 Git 忽略的改动**，包含代码、配置、文档、内容与新增资源，也包含已经暂存的文件；无需事先手动 add、commit、push。`draft: true` 继续从网站页面排除，但草稿源文件会上传到公开仓库。`node_modules/`、`test-results/`、`.env` 等已忽略文件不会加入提交。

依次执行，任何一步失败立即以非零状态退出：

1. 检查当前分支、origin、Git 冲突及远端版本；远端有本地未包含的提交时停止，不自动合并或覆盖。
2. `npm run clean:punctuation:check` → `npm run format:check` → `npm run check` → `npm test`. 标点检查失败时先运行 `npm run clean:punctuation`, 审阅变化后重新发布.
3. 按发布配置正式构建至 `test-results/publish-site-build/`，校验内链与资源；关闭样例和本地草稿预览。
4. 确认检查期间源文件没有改变，暂存全部改动并提交为 `site: publish updates`，再 push。
5. 每 30 秒查询当前提交对应的 `pages.yml` push 工作流，最多等待 20 分钟；部署成功才显示“Pages 部署成功”。

只验证本地流程、不提交、不联网上传：

```powershell
npm run publish:site -- --check-only
```

日志会显示 `停止于【具体步骤】`。格式检查失败可先运行 `npm run format`，审阅格式变化后再发布；内容、类型、测试或构建错误按上方原始报错修复。检查失败不提交；暂存或提交阶段出错可能留下暂存内容。push 失败保留本地提交，修复网络或认证后重新运行同一命令，不会为未变化的文件重复创建提交。

Pages 失败会给出对应工作流日志链接，并尽量显示失败作业和步骤。修正源文件后重新运行即可；若只是 GitHub 临时部署故障，先在 Actions 重跑失败作业，再运行命令查看最新结果。脚本不自动重跑失败部署，也不会因等待超时取消云端任务。push 之后云端失败不能撤回已上传的源文件，原站点是否更新以 Actions 实际结果为准。

状态查询使用 [GitHub 官方公开工作流 API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)，无需额外安装 GitHub CLI 或配置令牌。API 网络失败、限流或查询超时同样停止，输出的 Actions 链接可用来查看实际状态。若 Node 网络也需要代理，可在当前 PowerShell 设置 `$env:HTTPS_PROXY = 'http://127.0.0.1:7897'` 后运行；Git 自己的仓库代理设置仍独立生效。

不要同时运行 `publish:watch`、`publish:notes` 和 `publish:site`；它们共用发布锁。Ctrl+C 停止本地进程，已 push 的 Actions 仍会继续。异常退出遗留锁时，确认没有发布进程，再删除 `.git/mustard-publish.lock`。

## 日常写作与上传

建站前且日期不详的旧笔记使用 `templates/note-before-site.md`: 填写 `dateStatus: 'before-site'`, 不填写 publishedAt. 页面显示"建站前". 若知道真实日期则正常填写 publishedAt, 即使早于建站也有效; 不使用 `too old` 或虚构日期占位. 文章、玩具和项目共用此规则.

### 已迁入的计算机网络笔记

2026-10-14 已将外部 Notes 中的前三章同步到本地网站，保持 `draft: true`，未提交或上传。第一章沿用原有元数据、`network-01` 地址及日期；第二、三章使用 `network-02`、`network-03`，日期暂填迁入日期，公开时应改成实际发布日期。正文去掉重复一级标题，图片和 HTTP/TCP 字段图沿用原内容与逻辑路径。

| 网站文件                                       | 用途                                         |
| ---------------------------------------------- | -------------------------------------------- |
| `content/writing/计算机网络/第1章_网络概述.md` | 网络概述，地址 `/writing/network-01/`        |
| `content/writing/计算机网络/第2章_应用层.md`   | 应用层，地址 `/writing/network-02/`          |
| `content/writing/计算机网络/第3章_运输层.md`   | 运输层，地址 `/writing/network-03/`          |
| `public/media/network-01/`                     | 第一章的 2 张 PNG 和 2 张 SVG                |
| `public/media/network-notes/`                  | 字段图共享 CSS 与 JavaScript，仅相关文章引用 |

本地阅读只需 `npm run dev:local`，从文章库进入计算机网络合集。外部 Notes 中的说明、模板和预览工具无需复制进文章库；图片和交互资源合计约 250 KB，没有引入新的框架或依赖。迁移前网站的第一章副本保留在 Git 忽略的 `test-results/migration-backup-2026-10-14/`，外部源文件未修改。

后续若继续在外部 Notes 写作：复制对应章的正文到网站同名文章，保留网站文首字段，去掉外部笔记的一级标题；新增资源复制到 `public/media/`，正文继续用 `/media/...`。若直接在网站副本编辑，则不需要重复迁移。两边不会自动同步，复制前应确认哪份是最新内容。

在外部编辑器与笔记目录完成写作，再复制到：

```text
content/writing/我的笔记.md       Markdown 正文与元数据
public/media/我的笔记-slug/      图片、脚本、样式等资源
```

文件名可以中文；页面 URL 由文首的 `slug` 决定。可参考 `templates/note.md`。必须提供 `title`、`slug`、`description`、`publishedAt`、`draft`；日期使用实际发布日期，准备公开时设置 `draft: false`。专题是可选项，详见内容指南。

开始写作前，在网站目录运行一次：

```powershell
npm run publish:watch
```

保持该进程运行即可自动检测。程序启动时也会处理已存在的内容改动；每 2 秒检测一次，文件稳定 10 秒后执行生产检查和构建。内链与资源检查通过后，仅提交 `content/`、`public/` 的改动并 push；云端随后构建发布。复制文章后要把资源一起复制，否则检查会报缺文件；补齐后会重试。

这是本地程序，电脑关机、休眠或停止进程时不会上传；再次启动会处理剩余变化。Ctrl+C 停止。暂未安装开机自启或系统后台任务。

需要手动运行一次时：

```powershell
npm run publish:notes
```

自动发布要求：网站代码与配置已提交，没有已有暂存改动，当前位于 `main`，`origin` 与 `publish.config.json` 一致，本地和远端起点一致。发现代码改动或分支分歧时停止提交，交由作者正常 Git 操作处理，不自动覆盖远端或解决冲突。

检查失败不提交；push 失败保留本地提交并重试，不重复制造提交。程序每分钟重试一次，文件再次改变则重新等待稳定。日志中的“已上传”表示 Git push 成功，最终上线状态以 GitHub Actions 为准。若进程异常退出留下锁，确认没有发布进程运行后删除 `.git/mustard-publish.lock`，再重启。

## Markdown 中的 HTML 与交互

支持原生 HTML（例如 `details`、`button`、`input`）与浏览器 JavaScript。HTML 内容先解析为节点，再统一补齐资源与链接的部署前缀，覆盖 `href`、`src`、`poster`。独立脚本与样式放在 `public/media/<slug>/`，在正文中引用：

```html
<div id="my-demo">
  <button type="button">点击</button>
  <output aria-live="polite">0</output>
</div>

<script src="/media/my-note/demo.js" defer></script>
```

脚本可以操作当前文章中的 DOM；为交互区域设置独立 id，CSS 用该区域选择器限定范围。CSS 中的 `url()`、JavaScript 中的字符串路径不会被 Markdown 插件改写：外部 CSS 的图片用相对 CSS 文件的地址，脚本加载资源可用 `new URL('./data.json', import.meta.url)` 并把脚本设为 `type="module"`。

不要把 HTML 放进代码围栏，除非希望它只作为代码展示。HTML 块内部混合 Markdown 的解析规则与普通段落不同，需在网站中预览。本站支持可信作者自写的脚本，不过滤脚本；不要直接发布来源不明的可执行 HTML。

普通 `.md` 不编译 React/Vue/Astro 组件，也不提供服务端、数据库或私密 API 密钥存放位置。折叠说明、计算器、滑块、可视化演示等纯浏览器交互可以保持免费静态托管。

## 验证范围

本地构建覆盖正式、样例和 `/Blog/` 子路径；样例文章包含折叠 HTML 与计数按钮，正式构建不含这些演示资源。发布工具通过临时本地 Git 仓库和 bare remote 验证提交、代码隔离、文件修改期间取消、push 失败重试。最新 `npm run check`、`npm run format:check` 与 18 项测试通过。实际仓库创建、Git 鉴权、首次 push 和 [首次 Actions 部署](https://github.com/Mustard-wsy/Mustard-wsy.github.io/actions/runs/38229055198) 已成功。计算机网络前三章已手动提交上线，文章与配套资源通过公网 HTTP 检查；尚未用作者真实笔记完成一次持续监测自动上传。Pages 若在 `updating_pages` 超时，先查看日志；本次仅重试失败的部署作业即成功，不需要重新复制或修改笔记。

## 合集与项目的上传

在 `content/writing/` 中按所需层级创建文件夹，再复制 Markdown；每个目录可放 `_collection.json` 配置 title、description、logo、order，参考 `templates/collection.json`。Logo 资源放入 `public/media/`。无需修改代码或文章元数据中的合集字段；根目录文章直接显示在文章库。空目录与仅草稿目录不会公开，合集规则见[内容指南](04-content-guide.md)。

项目 Markdown 放入 `content/projects/`，模板为 `templates/project.md`，封面与脚本仍放入 public。玩具保持 `content/toys/`。两者使用相同字段但有各自的列表和详情地址。上述新目录与配置都已处于现有监测范围内。
