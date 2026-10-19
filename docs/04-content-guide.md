# 内容模型与写作模板

状态：核心字段与校验已实现；具体能力见首轮实施记录。更新日期：2026-10-12。

## 1. 内容与界面分离

站点可读文本统一使用英文半角标点. 一键清洗使用 `npm run clean:punctuation`, 只检查使用 `npm run clean:punctuation:check`. 默认扫描 `content/`, `fixtures/`, `templates/` 的 Markdown 和元数据 JSON, 以及 `public/media/` 与样例目录的 SVG 文本. 转换正文、标题、摘要、标签、图片替代文字及 HTML 可读属性, 不改文件名、slug、资源地址、引用标识、代码和数学公式. 交互脚本和 Astro 界面文案需在编辑时使用半角标点, 不进行源码全局替换.

脚本先解析全部候选文件再写入, 修改前自动备份到 Git 忽略的 `test-results/punctuation-backups/<时间>/`, 重复执行不会反复改动同一文本. 常见逗号、句号、顿号、分号、冒号、问叹号、括号、引号、省略号和破折号转成 ASCII 对应字符, 新转换的句读在必要处补空格. Markdown 方括号会转义以免形成新链接, YAML/HTML 引号会按各自语法编码. 不修改 Course 源目录, 不执行 Git 或发布.

推荐逻辑目录如下；框架选型后可以调整路径，但字段语义和新增内容流程应保持稳定，并同步更新本文档。

```text
content/
  writing/       # 文章 Markdown，文件夹决定合集层级
  topics/        # 专题元数据
  toys/          # 玩具 Markdown
  projects/      # 项目 Markdown，与玩具使用相同字段
  pages/         # 关于等固定内容
public/
  media/         # 按内容 slug 分组的图片与视频
```

站名、简介、站点 URL、部署 base path、外部链接、当前关注集中配置。内容中不散落域名或部署前缀。

第一版优先普通 Markdown，不让写一篇普通笔记依赖组件导入或 JSX。

## 2. 通用字段

| 字段          | 必填     | 约定                                                             |
| ------------- | -------- | ---------------------------------------------------------------- |
| `title`       | 是       | 展示标题                                                         |
| `slug`        | 是       | 稳定的小写英文、数字与连字符；同类型内唯一                       |
| `description` | 是       | 简短摘要，建议 40–120 个汉字，不作为硬性字数门槛                 |
| `publishedAt` | 条件必填 | 已知日期使用 `YYYY-MM-DD`, 以作者 Asia/Shanghai 日历日期为准     |
| `dateStatus`  | 条件必填 | 无确定日期的建站前内容填写 `before-site`, 不同时填写 publishedAt |
| `updatedAt`   | 否       | 实质内容更新日期，不早于发布日期                                 |
| `draft`       | 是       | `true` 不进入正式构建；`dev:local` 可预览；新建模板默认 `true`   |
| `tags`        | 否       | 字符串列表；少量、稳定、避免同义重复                             |

日期在 YAML 中使用引号，避免不同解析器自动转换类型。第一版不提供定时发布；`draft: false` 的内容会在部署时公开，未来日期应触发校验错误，而不是默默等待发布。

### 建站前内容与不确定日期

日期与日期说明分开存储. 已知真实日期时即使早于建站也照常填写 `publishedAt: '2020-01-01'`; 不知道具体年月日、只确定属于建站前时, 删除 publishedAt 并填写:

```yaml
dateStatus: 'before-site'
```

两者须且只能填写一个. 不使用 `too old`, `unknown`, `0000-00-00` 或虚构日期占位. 该值是本站的枚举状态, 不是标准日期格式. 列表和详情显示"建站前", 使用普通文本标签, 不输出无效 datetime. 普通日期继续用 `<time datetime="YYYY-MM-DD">`. 依据: [HTML time 日期语义](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/time) 与 [Schema.org datePublished 的 Date/DateTime 类型](https://schema.org/datePublished).

排序时所有日期明确的文章仍按日期倒序, "建站前且日期不详"单独放在这些文章之后, 同组按 slug 稳定排序; 这是本站的展示约定, 不声称它们一定早于每篇已知日期的旧文章. 玩具和项目仍优先按 featuredOrder 排序. updatedAt 继续填写真实更新日期. 可以复制 `templates/note-before-site.md`, 默认保持草稿.

草稿与预览样本必须从生产页面、索引、RSS 和站点图中同时排除。若使用公开仓库，草稿源文件仍可被看到；敏感内容不要提交到仓库。

## 3. 文章字段与模板

附加字段：`topic` 为可选专题 slug；存在 `topic` 时必须提供正整数 `topicOrder`，在同专题内唯一。无专题时不填写 `topicOrder`。

以下均为未发布示例，不代表作者已经完成对应内容：

```yaml
---
title: 'TCP 为什么需要三次握手？'
slug: 'tcp-handshake'
description: '从双方需要确认的信息出发，梳理连接建立的过程。'
publishedAt: '2026-10-09'
draft: true
tags: ['计算机网络', 'TCP']
topic: 'computer-networks'
topicOrder: 1
---
```

课程笔记可参考以下结构，按实际需要删减：

```markdown
## 我想弄清楚的问题

## 我的理解

## 一个例子或实验

## 我原来误解的地方

## 仍未解决的问题

## 参考资料
```

算法笔记可参考：题目原链接 → 初始思路 → 关键转折 → 实现 → 复杂度与边界 → 复习时的新理解。描述问题时以自己的概括为主，无需复制完整题面。

## 4. 专题字段与模板

专题元数据仅需 `title`、`slug`、`description` 和可选的正整数 `order`。`order` 决定专题入口顺序，缺省排在已指定顺序后，再按 slug 排序。

当前实现将专题保存为 `content/topics/<slug>.json`。下面使用 YAML 展示字段语义，落盘时请使用等价 JSON，参考 `fixtures/topics/`。

```yaml
title: '计算机网络'
slug: 'computer-networks'
description: '记录课程中的概念、实验与逐渐形成的理解。'
order: 1
```

专题本身不维护第二份文章列表，通过文章的 `topic` 和 `topicOrder` 生成。没有公开文章的专题不生成生产专题页，也不进入索引或站点图。

## 5. 玩具与项目字段及模板

除通用字段外：

| 字段            | 必填 | 约定                                                         |
| --------------- | ---- | ------------------------------------------------------------ |
| `status`        | 否   | `in-progress` / `completed` / `paused`；缺省不显示           |
| `featuredOrder` | 否   | 正整数，唯一；决定各自目录中的优先排序，不在首页展示具体玩具 |
| `cover`         | 否   | 预览图片对象，包含 `src` 和 `alt`                            |
| `video`         | 否   | 本地视频对象，包含 `src`、可选 `poster` 和文字 `description` |
| `links`         | 否   | 可包含 `source`、`demo`、`download` 的 HTTPS URL             |

无封面时省略媒体区域，显示紧凑的名称、说明和标签卡片。媒体路径使用站点逻辑路径，例如 `/media/<slug>/cover.webp`，由统一 URL 工具处理 base path，不能直接假定部署在域名根目录。

```yaml
---
title: '水果忍者'
slug: 'terminal-fruit-ninja'
description: '一个用字符表现三维效果的 Linux TUI 小游戏。'
publishedAt: '2026-10-09'
draft: true
tags: ['Linux', 'TUI', '小游戏']
featuredOrder: 1
---
```

示例故意省略未核实的状态、素材和外部链接。实际发布日期应在发布时填写。

正文建议从“它是什么”和“为什么做”开始；需要时再添加如何运行、效果、实现思路和局限。两句话的玩具介绍也是有效内容。

## 6. 媒体约定

- 每项内容使用独立媒体目录，文件名描述用途，避免 `image1-final-final.png`。
- 图片保留必要细节并压缩，声明尺寸以减少布局跳动；正文下方媒体延迟加载。
- 终端截图使用能看清字符的分辨率，不把长篇代码做成图片。
- 优先短视频而非大体积 GIF，视频提供文字说明；出现对白时提供字幕或转录。
- 上传前检查聊天记录、路径、用户名、令牌等信息，使用模拟内容或脱敏素材。
- 大型程序与安装包通过明确的下载链接提供，不打包进博客静态资源。

## 7. 发布流程

1. 复制对应模板，保持 `draft: true`。
2. 填写真实标题、摘要、日期与稳定 slug，按需添加素材和链接。
3. 本地预览；检查窄屏、代码、公式、图片与外链。
4. 确认内容适合公开，将 `draft` 改为 `false`。
5. 通过内容校验与构建，再提交发布。

作者当前采用“在外部笔记目录打磨，再复制到网站”的流程。首次完成 GitHub 配置后，可运行 `npm run publish:watch` 监测 `content/` 与 `public/`；复制完成并稳定 10 秒后自动检查、提交上传。文首字段仍必须填写，参考 `templates/note.md`。详细步骤与 HTML 交互写法见[托管与日常发布](08-publishing.md)。上传目录及其 Git 历史公开，草稿继续留在外部目录。

删除或修改字段时同步更新内容校验与模板。文章纠错和重要补充更新 `updatedAt`；仅修标点或样式时不必改变它。

## 8. 设计预览素材

`DEMO_MODE=true` 使用 `fixtures/public/` 作为资源根目录，正式模式使用 `public/`。三张 SVG 为原创示意而非项目实际截图，卡片显式标注“示意图”。请将真实媒体放入 `public/media/`，在正式 Markdown 中填写 `cover`。无封面仍可发布，无需改组件。

## 9. 文件夹合集

每一个 `content/writing/` 下的文件夹都是合集，嵌套目录生成对应下级索引。无需在文章中手填合集字段，不维护第二份文章清单。根目录 Markdown 显示在文章库；文章在整个 writing 集合中的 slug 仍需唯一。

```text
content/writing/
  一篇独立文章.md
  计算机网络/
    _collection.json
    协议概述.md
    连接建立/
      _collection.json
      三次握手.md
```

每个目录的 `_collection.json` 可选（包括 writing 根目录），参考 `templates/collection.json`：

```json
{
  "title": "计算机网络",
  "description": "协议、连接与网络实验。",
  "logo": "/media/collections/network.svg",
  "order": 1
}
```

所有字段均可省略，空对象有效。title 缺省使用文件夹名，description 缺省使用共享说明，logo 缺省使用文件夹图标。Logo 放在 `public/media/`，路径遵循本站媒体约定；缺文件或字段格式不正确会阻止构建。order 为正整数，可重复，同顺序按路径排序。配置名必须准确，不支持未知字段。

只有公开文章及其祖先目录进入合集索引，空目录、仅草稿目录隐藏。合集路径随目录移动变化；文章详情由 slug 决定，目录移动不改变文章链接。旧 topic/topicOrder 保持可选，表达跨目录的阅读顺序，与文件夹合集互不替代。新增合集与配置同样由发布监测程序自动检测。

项目放入 `content/projects/`，参考 `templates/project.md`；字段和校验与玩具一致，featuredOrder 分别在项目目录、玩具架内唯一。同 slug 可在 projects 和 toys 各用一次，分别生成不同地址。示例合集和项目只在 fixtures 中展示。

## 10. 草稿的本地预览

`npm run dev:local` 读取真实 content 与 public，并在开发服务器中显示草稿及其合集，保持文首 `draft: true` 即可。普通 dev 和正式 build 仍过滤草稿。预览时不用把文件放进 fixtures，也不用临时设为非草稿。此命令不调用发布程序；上传草稿源文件与公开展示草稿是两件事，仅本地查看时不要执行发布命令或 Git push。逐步说明见[托管与日常发布](08-publishing.md#先在本地查看不上传)。

## 11. 代码块自动换行

代码块默认保持原始行布局，过长时在块内横向滚动。换行只由作者在 Markdown 中配置，页面不显示相关按钮、工具栏或状态文字。

需要某一块自动换行时，在起始围栏的语言名后加独立的 `wrap` 标记，例如：

````markdown
```c wrap
int main(void) { return 0; }
```
````

省略 `wrap` 则不自动换行。换行由静态属性和 CSS 完成，无需客户端脚本，不修改源码文本、缩进或高亮；复制时不会插入显示产生的软换行。水果忍者文章仅附录的完整 C 源码使用 `c wrap`，其余示例保持默认。
