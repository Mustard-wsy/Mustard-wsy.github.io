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

当前没有真实文章、玩具与专题，首次部署会展示首页入口和内容页空状态。RSS 与站点图尚未补齐。

## 日常写作与上传

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

本地构建覆盖正式、样例和 `/Blog/` 子路径；样例文章包含折叠 HTML 与计数按钮，正式构建不含这些演示资源。发布工具通过临时本地 Git 仓库和 bare remote 验证提交、代码隔离、文件修改期间取消、push 失败重试。`npm run check`、`npm run format:check` 与 13 项测试通过。实际仓库创建、Git 鉴权、首次 push 和 [首次 Actions 部署](https://github.com/Mustard-wsy/Mustard-wsy.github.io/actions/runs/38229055198) 已成功。浏览器验证正式首页、样例 HTML 折叠说明及计数按钮；四个主要公网页面返回 HTTP 200。尚未用作者真实笔记完成一次自动上传；当前没有真实笔记。

## 合集与项目的上传

在 `content/writing/` 中按所需层级创建文件夹，再复制 Markdown；每个目录可放 `_collection.json` 配置 title、description、logo、order，参考 `templates/collection.json`。Logo 资源放入 `public/media/`。无需修改代码或文章元数据中的合集字段；根目录文章直接显示在文章库。空目录与仅草稿目录不会公开，合集规则见[内容指南](04-content-guide.md)。

项目 Markdown 放入 `content/projects/`，模板为 `templates/project.md`，封面与脚本仍放入 public。玩具保持 `content/toys/`。两者使用相同字段但有各自的列表和详情地址。上述新目录与配置都已处于现有监测范围内。
