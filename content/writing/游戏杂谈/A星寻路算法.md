---
title: '角色为什么会在墙角转弯: 从逐格搜索到 JPS 的网格寻路'
slug: 'pathfinding-01'
description: '从角色绕墙时会关注的路口和墙角出发, 依次理解 BFS, Dijkstra, 贪心搜索, A*, JPS, 双向搜索与 IDA*, 讨论它们解决的问题, 保留最短路的条件和实际使用时的取舍.'
dateStatus: 'before-site'
draft: false
tags: ['游戏开发', '网格寻路', 'A*', 'JPS']
---

玩即时战略或者模拟经营游戏的时候, 点一下地面, 角色就会自己绕开建筑. 如果我们自己来找这条路, 大概不会逐块检查沿途的地砖, 而是先看建筑从哪边能绕过去, 哪个墙角需要转弯, 再把这些位置连起来.

这个思路很适合拿来想寻路算法. 空地上有很多走法, 但有必要把它们都考虑一遍吗? 墙角又为什么比旁边那块地砖更值得注意? 如果能把这些判断说清楚, 程序就有机会省掉很多重复搜索.

学过搜索算法后, 我仍想弄清楚它们在游戏里各自解决什么问题. 这篇从 BFS 开始, 一步步走到 A* 和 JPS, 再看双向搜索, Weighted A* 与 IDA* 分别怎样减少搜索范围, 放宽路径要求或节省内存.

可以配合 [PathFinding.js 可视化](https://qiao.github.io/PathFinding.js/visual/)画图观察, 后面也会对照它的实现. 本文只讨论单个角色在网格上找路线; 多边形导航网格和一群角色的移动, 留给后续文章.

<link rel="stylesheet" href="/media/a-star-pathfinding/demo.css">

## 1. 从BFS开始

先把游戏画面简化成下面这张地图:

<section class="as-lab as-story" id="lesson-bfs" data-path-lesson="bfs" aria-label="从起点向外找">
  <p class="as-title">从起点向外找</p>
  <p>逐次取出队列中的位置, 看候选怎样绕过竖墙. 每一步显示当前格与到达步数.</p>
  <div class="as-story-board" data-lesson-board><img src="/media/a-star-pathfinding/lesson-bfs.svg" alt="五乘四地图, 起点左上, 终点右上, 中间三格竖墙. 最短路从下方绕行, 共十步." loading="lazy" width="332" height="312"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">五乘四地图, 起点左上, 终点右上, 中间三格竖墙. 最短路从下方绕行, 共十步.</output></p>
</section>

S 是起点, G 是终点, 深色方格是障碍. 先规定只能向上, 下, 左, 右移动, 每走一格花 1. 地图外不能走.

每个能站立的格子是一个位置, 两个相邻可通行格之间有一步移动. 我们把前者叫做节点, 后者之间的连接叫边. 搜索要解决的就是: 从 S 出发, 能否沿这些连接到达 G?

最直接的办法是先检查走一步能到的地方, 再检查走两步能到的地方, 依此向外扩散. 第一次到达 G 的那一层, 就给出了最少步数. 这就是**广度优先搜索, BFS**.

程序需要留一份待检查的列表. 新发现的位置放到末尾, 每次从最前面取一个, 因此先发现的一层总会先处理完. 这种先进先出的列表就是队列. 一个格子第一次被发现时, 记下是从哪个格子过来的, 并避免重复加入.

找到 G 后沿这些记录反向追到 S, 再倒序, 就得到整条路径. 这份记录通常叫父节点或 came from. 后面的算法也会用到它.

## 2. 不同格子代价不同: Dijkstra

BFS 已经能解决不少方格游戏里的寻路. 但它的最短路保证有一个条件: **每一步代价相同**,如果我们设计更加复杂的路况,比如有平坦的路和崎岖的路,那么走起来的代价就是不一样的.我们把地图换成两排地面:

<section class="as-lab as-story" id="lesson-mud" data-path-lesson="mud" aria-label="少走两步, 却多花了代价">
  <p class="as-title">少走两步, 却多花了代价</p>
  <p>两条路线同步前进一步, 分别累计步数和花费. 先到终点的路线会停下来.</p>
  <div class="as-story-board as-story-pair" data-lesson-board><img src="/media/a-star-pathfinding/lesson-mud-1.svg" alt="直接穿过沼泽. 3 步 / 代价 11." loading="lazy" width="276" height="200"><img src="/media/a-star-pathfinding/lesson-mud-2.svg" alt="从下方绕行. 5 步 / 代价 5." loading="lazy" width="276" height="200"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">两排四格地图. 直行穿过两格沼泽, 三步代价十一; 从下方绕行, 五步代价五.</output></p>
</section>

进入普通地面或 G 花 1, 进入棕色沼泽格花 5, 起点不计.

直接向右走, 一共 3 步, 代价却是 5 + 5 + 1 = 11. 从下方绕行要走 5 步, 总代价只有 5. 如果我们关心的是时间或者体力, 下方才是更好的路线.

这时候问题就转变为了带权的搜索问题,我们对BFS稍加修改: **每次优先检查从起点到这里累计代价最小的位置.** 这个累计值记作 g, 此时我们就得到了 Dijkstra 算法.

BFS中原本使用的普通队列不再合适, 因为晚发现的位置也可能更便宜. 现在需要按 g 取出最小值的优先队列. 与此同时, 一个位置第一次被发现时也不能定案: 如果后来找到更便宜的来路, 就更新它的 g 和父节点.

例如 B 原先要花 7 才能到, 后来发现先到 A 花 4, 从 A 到 B 再花 1. B 的记录就应该改成 5, 来路改为 A. 这个比较与更新过程叫**松弛**.

在非负代价下, Dijkstra 取出当前代价最小的位置时, 到它的最优代价已经确定. 因此, 应在终点从优先队列中被有效取出时结束, 而不是第一次把终点放进队列就结束. 例如 S 直达 G 花 10, 经 A 中转只花 2, 太早结束就会错过中转路线.

如果所有边都花 1, 按 g 从小到大处理, Dijkstra算法就退化成了BFS.

## 3. 不要南辕北辙: Greedy BFS

聪明的你可能注意到,BFS 和 Dijkstra 都没有使用终点的方向. 在空地上, 即使 G 在右边, 它们仍然会检查左边许多位置.

人找路通常会优先考虑靠近目的地的方向. 我们也可以为每个位置估计一份剩余代价, 记作 h. 四方向移动, 每步花 1 时, 暂时忽略障碍, 从当前位置到 G 至少还要走:

$$
h=|x-x_G|+|y-y_G|
$$

这个横向差与纵向差之和叫**曼哈顿距离**. 例如横着差 3 格, 竖着差 2 格, 无障碍时要走 5 步. 有墙只会增加这份路程.

如果每次只挑 h 最小的位置检查, 就是**贪心最佳优先搜索, Greedy Best-First Search**. 它很容易沿目标方向推进, 但不会认真比较为了走到这里已经绕了多远.

想象一面朝着 S 开口的 U 形墙, G 在 U 的背面. 靠近 G 的方向可能恰好把搜索引进 U 的内部, 而真正的出口需要先远离 G. 贪心仍可以保留其他候选并继续搜索, 所以不一定卡死, 但第一条找到的路没有最短保证.

这也解释了为什么"朝目标走"和"找到最短路"不是一回事. h 是方向提示, 不能代替沿途已经发生的花费.

## 4. 把已经花掉的和预计还要花的合起来: A*

Dijkstra 按已经花掉的 g 排序, 贪心搜索按预计剩余的 h 排序. 我们把两者相加:

$$
f(n)=g(n)+h(n)
$$

**A\* 优先展开 f 最小的位置.** 展开指取出一个候选, 检查从它继续走能到哪里. 等待展开的候选叫 Open Set, 已展开的位置通常记在 Closed Set.

这里 g 是目前找到的来路的真实花费, h 是对剩余最小花费的估计. 因而 f 在比较的是经过这个位置的整条路线, 而不是单独比较下一步.

看一个四方向的小例子. 起点 `(0,1)`, 终点 `(4,1)`, 中间 `(2,1)` 是墙. 从起点展开后:

| 候选           | g   | h   | f   |
| -------------- | --- | --- | --- |
| 向右到 `(1,1)` | 1   | 3   | 4   |
| 向上到 `(0,0)` | 1   | 5   | 6   |
| 向下到 `(0,2)` | 1   | 5   | 6   |

右边先被检查. 但继续向右遇到墙, 新路线必须绕行, f 可能上升. 上下两侧的候选还保留在队列里, 一旦它们的分数更小, 就轮到它们. 搜索没有押注某一条路, 而是在持续比较尚未排除的可能性.

A* 沿用 Dijkstra 的松弛与父节点记录, 主要变化是队列的排序值. h 全取 0 时, 它就退回 Dijkstra. 这些算法的联系也可以对照 [Red Blob Games 的 A* 推导](https://www.redblobgames.com/pathfinding/a-star/introduction.html#the-a-star-algorithm).

> ### 为什么这个估计不会把最短路排除掉?
>
> 要求 h 不高估真正剩余的最小代价, 且终点 h = 0. 这叫**可采纳性**. 忽略墙计算出的曼哈顿距离符合这个要求.
>
> 假设一条花费 10 的终点路线正在候选队列里, 实际还存在一条花费 6 的路. 只要较好的来路一直得到正确更新, 那条最优路上就会留有一个待处理的前沿节点, 它的 g + h 不会超过 6. 算法会先处理它, 不会抢先取出花费 10 的终点作为答案.
>
> 实际实现还要处理已经展开的节点. 如果展开后就永久关闭, 通常要求 h 满足更强的**一致性**:
>
> $$
> h(n)\le c(n,m)+h(m)
> $$
>
> c 是从 n 到相邻位置 m 的一步代价. 对四方向单位代价地图, 曼哈顿距离每走一步只会相差 1, 满足这个条件. 对可采纳但不一致的 h, 发现已展开位置有更小的 g 时, 则需要允许重新打开它并传播改进. [Berkeley CS188 搜索讲义](https://inst.eecs.berkeley.edu/~cs188/fa22/assets/notes/cs188-fa22-note02.pdf)给出了这两个条件的正式讨论.

### 在同一张地图上比较

<section class="as-lab" id="astar-lab" aria-label="基础网格寻路实验">
  <p class="as-title">实验一: 下一处位置按什么顺序检查?</p>
  <p>先在绕墙地图上比较 BFS, Dijkstra, 贪心和 A*. 再切到沼泽地图: 直接走是 4 步, 代价 16; 绕行是 6 步, 代价 6. 观察 BFS 的最少步数与 Dijkstra 的最小代价怎样分开.</p>
  <div class="as-controls" data-controls hidden>
    <label>搜索方式 <select data-mode aria-label="基础搜索方式"><option value="bfs">BFS: 按层</option><option value="dijkstra">Dijkstra: g</option><option value="greedy">贪心: h</option><option value="astar" selected>A*: g + h</option></select></label>
    <label>地图 <select data-scene aria-label="基础实验地图"><option value="wall">绕墙</option><option value="mud">沼泽</option><option value="blocked">无路可走</option></select></label>
    <button type="button" data-step>下一步</button>
    <button type="button" data-finish>运行到结束</button>
    <button type="button" data-reset>重新开始</button>
  </div>
  <div data-board><img src="/media/a-star-pathfinding/map.svg" alt="五乘五绕墙地图, 起点 (0,1), 终点 (4,1), 中央竖墙挡住直路, 从上边绕行需要六步." width="500" height="500"></div>
  <p class="as-legend">S 起点 / G 终点 / # 墙 / ? 候选 / x 已展开 / @ 当前 / * 路径. 点击格子查看记录. BFS 的排序分数是层数, 其余分别使用 g, h, g + h.</p>
  <p class="as-status"><output data-status aria-live="polite">静态图显示一条六步绕行路线. 启用 JavaScript 可切换地图和单步搜索.</output></p>
  <p class="as-detail" data-detail>本实验只允许四方向移动, 普通格进入代价 1, 沼泽进入代价 5.</p>
  <div class="as-frontier" data-frontier></div>
</section>

<script type="module" src="/media/a-star-pathfinding/demo.js"></script>

## 5. 可以斜向移动的世界

不少游戏允许八方向移动. 一般把横竖一步记为 1, 斜向一步记为 √2, 对应格子中心之间的几何长度. 这时 BFS 的每步等价条件已经不成立, 即使所有地形都一样, 也不能再用它保证最小总代价.

h 也要调整. 横竖各差 1 格时, 曼哈顿距离是 2, 但斜走只需 √2, 原来的 h 已经高估了. 允许斜向移动实际上是改变了距离的定义,我们不再使用曼哈顿距离.设横向差为 a, 纵向差为 b, 先斜走消掉相同的部分, 再直走剩余部分:

$$
h=\sqrt{2}\min(a,b)+|a-b|
$$

这叫 **Octile Distance**, 八方向网格中很常用. 如果斜走与横竖都花 1, 则应使用 $\max(a,b)$, 也就是 Chebyshev 距离. Euclidean 是直线距离, 在通常的 1 / √2 移动规则下也不高估, 但一般没有 Octile 贴近网格上的真实代价.

斜走还涉及碰撞规则:

<section class="as-lab as-story" id="lesson-corner" data-path-lesson="corner" aria-label="这一步斜线能不能走?">
  <p class="as-title">这一步斜线能不能走?</p>
  <p>切换侧面障碍和斜走规则, 再逐步检查落点与侧面. 观察同一张图为什么会有不同结果.</p>
  <div class="as-story-board" data-lesson-board><img src="/media/a-star-pathfinding/lesson-corner.svg" alt="二乘二网格, S与G对角相邻, 另外两格为墙. 仅检查落点的规则允许斜走, 另外两种规则阻止该步." loading="lazy" width="164" height="200"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">二乘二网格, S与G对角相邻, 另外两格为墙. 仅检查落点的规则允许斜走, 另外两种规则阻止该步.</output></p>
</section>

S 能不能一步斜到 G? 有的网格只要求落点不是障碍, 有的允许贴单侧墙角却不允许穿过两障碍之间的缝, 还有的要求两个侧面格都为空. 它们对应不同的连接关系,我们也要分别处理.

接下来的 JPS 图例与实验固定采用八方向, 横竖 1, 斜向 √2, **只要求落点可通行, 允许切角**. 这是为把剪枝规则说清楚而固定的一种网格模型. 如果游戏禁止切角, 就要采用与之匹配的 JPS 规则, 不能只改移动检查, 却保留另一版本的强制邻居判断.

## 6. 我们真的需要在空地上这么谨慎吗? JPS 跳点搜索

A* 会优先检查更有希望接近目标的格子, 但仍然逐格生成候选. 在一段笔直的通道里, 中间许多格子没有新的岔路. 能否一路扫过去, 只把需要作选择的位置留给 A*?

但程序不能仅凭"这里是空地"就一路跳过去. 空地上也可以转弯, 万一跳过的某个转弯位置恰好在最短路上呢? 要省掉这里的分支, 就需要先说明: **即使不在这里转弯, 也有另一条不更贵的走法到达同一位置.**

于是, 我们先比较走法能否相互替代, 再决定哪些位置可以跳过. 这就是 **Jump Point Search, JPS, 跳点搜索**的思路. 它仍用 A* 的 g + h 选择候选, 只是生成后继时多做两件事: 删去可以替代的分支, 沿保留方向扫描到需要展开的位置.

### 6.1 为什么可以只留一种?

怎样判断一条走法可以替代另一条? 先在没有障碍的均匀网格里, 取相同的起点和终点, 只改变步子的顺序. 例如从 `(0,0)` 到 `(3,1)`, 我们都需要两个向右的直步和一个右下的斜步. 可以先直走再斜走, 也可以先斜走再直走:

<section class="as-lab as-story" id="lesson-symmetry" data-path-lesson="symmetry" aria-label="交换步子的顺序">
  <p class="as-title">交换步子的顺序</p>
  <p>同步推进两条路线. 对照每一步的位置和代价, 观察两条走法怎样在终点汇合.</p>
  <div class="as-story-board as-story-pair" data-lesson-board><img src="/media/a-star-pathfinding/lesson-symmetry-1.svg" alt="先向右, 再斜走. 3 步 / 代价 3.41." loading="lazy" width="276" height="200"><img src="/media/a-star-pathfinding/lesson-symmetry-2.svg" alt="先斜走, 再向右. 3 步 / 代价 3.41." loading="lazy" width="276" height="200"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">从零零到三一的两条路线, 分别先直后斜和先斜后直, 都花二加根号二.</output></p>
</section>

两条路线都花 2 + √2. 如果后面还要从 `(3,1)` 继续走, 无论通过哪条路线到这里, 后续的选择都相同. 因此, 为了找到一条最短路, 没必要把这些只交换了步子顺序的路线都保留下来. 这类相同端点, 相同代价的走法, 就是这里要消除的路径对称性.

这和"一个格子见过就不再加入"还不一样. 两条路线在汇合前经过的格子不同, 普通去重不能提前认出它们等价. JPS 要做的是在分支产生时, 就用这种替代关系省掉其中一些走法.

### 6.2 把整条路线的比较, 缩到当前格的邻居

刚才证明了有些路线可以互换. 但搜索时还不知道整条路线, 不能等它们都走完才比较. 我们需要把判断缩到当前格附近: **从来向的前一格 p 出发, 到邻居 n, 是否存在一条不经过当前格 x, 且不更贵的替代路线?**

先看从左向右来到 x 的情况. p 是来向上紧挨着 x 的前一格, n 在 x 的右上方, 周围没有障碍:

<section class="as-lab as-story" id="lesson-natural" data-path-lesson="natural" aria-label="空地上, 哪条分支可以省掉?">
  <p class="as-title">空地上, 哪条分支可以省掉?</p>
  <p>先走两步比较两条路线, 最后一步显示在 x 处可以剪去的分支和保留的自然方向.</p>
  <div class="as-story-board as-story-pair" data-lesson-board><img src="/media/a-star-pathfinding/lesson-natural-1.svg" alt="经过当前格 x. 代价 2.41." loading="lazy" width="220" height="256"><img src="/media/a-star-pathfinding/lesson-natural-2.svg" alt="先斜走的替代路线. 代价 2.41." loading="lazy" width="220" height="256"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">从p到n可以经过x, 也可以先右上再向右, 两者代价相同. 在x处可剪去右上分支, 保留向右.</output></p>
</section>

经过 x 的走法是 p → x ↗ n; 不经过 x, 则可以从 p 先右上, 再向右到 n. 两者都花 1 + √2. 按照优先保留先斜后直的约定, 搜索来到 x 时, 就不必再从这里生成通向 n 的右上分支.

这里剪掉的是**这次从 p 来到 x 后的一个后继方向**. n 这个格子仍然可以走, 也没有从地图上删除. 到 n 的等价路线由另一种移动顺序保留.

对其他邻居也作同样比较, 从左向右来到 x 时, 空地上只需要保留继续向右. 沿右下方向来到 x 时, 则保留右, 下, 右下三个方向. 这些在没有障碍时留下的邻居, 叫**自然邻居**.

现在每到一个格子, 都能根据来向和周围障碍判断该保留哪些方向. 起点没有来向, 因此第一步仍要考虑所有合法方向.

### 6.3 不能缩减的情况

现在回到同一张局部图, 只在 x 的上方放一块障碍. 刚才保留的"先右上, 再向右"会怎样?

<section class="as-lab as-story" id="lesson-forced" data-path-lesson="forced" aria-label="放上障碍后, 重新比较两条路线">
  <p class="as-title">放上障碍后, 重新比较两条路线</p>
  <p>逐步比较经过 x 与不经过 x 的走法. 也可以移走障碍, 看强制邻居怎样变回可剪分支.</p>
  <div class="as-story-board as-story-pair" data-lesson-board><img src="/media/a-star-pathfinding/lesson-forced-1.svg" alt="经过当前格 x. 代价 2.41." loading="lazy" width="220" height="256"><img src="/media/a-star-pathfinding/lesson-forced-2.svg" alt="先斜走的替代路线. 替代路线被阻止." loading="lazy" width="220" height="256"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">x上方的障碍挡住先斜后直的替代走法, 经过x到n的路线仍合法, x必须保留通向n的分支.</output></p>
</section>

从 p 先右上, 第一步就会落在障碍里. 但 p → x ↗ n 仍然合法, 因为本例约定允许切角. **障碍破坏了原来的替代关系, 所以 x 到 n 的分支不能再按空地规则剪掉.**

这时 n 就叫作 x 在这个来向下的**强制邻居**. "强制"指这个邻居必须保留在后继方向里, 不表示最终路线一定要经过它. 放上和移走障碍, 对比的始终是同一个 JPS 剪枝判断.

这也解释了开头为什么会关注墙角: 墙角附近可能出现原本可替代, 现在却不能省略的新分支. 我们不必先把整张地图的墙角都标出来, 而是在扫描时检查局部替代关系是否被障碍打破. 对称性与邻居剪枝的图示也可以对照 [JPS 作者的说明](https://harablog.wordpress.com/2011/09/07/jump-point-search/).

在这个向右的例子里, x 上方被挡住, 而右上方 n 可以走, 就需要保留右上方向. 下方是镜像情况; 其他来向也有对应规则.

### 6.4 剪掉分支后如何"跳跃"?

假如从左向右扫描, 一连几格都只有继续向右这一个自然方向, 也没有强制邻居, 就可以连续应用刚才的剪枝规则. 不必每前进一格都把它加入候选, 取出, 再生成下一个格子.

但如果扫描到 x 时出现了强制邻居 n, 这里就多了一个不能省略的分支. 此时停止扫描, 把 x 交回 A* 的候选队列, 等它被展开时继续处理保留方向. **这里的 n 是强制邻居, x 才是这次扫描返回的跳点.** 两个名称描述的不是同一件事.

如果先扫描到终点, 就返回终点; 如果先撞墙或越界, 这个方向就扫描失败, 不生成后继. 墙前最后一个可走格也不因此自动成为跳点, 还要看它是否满足返回条件.

所以 JPS 并没有省掉所有逐格检查. 它仍沿途查看障碍, 省掉的是把每个中间格加入候选队列, 再取出展开的操作.

### 6.5 斜向扫描时检查分量, 避免漏掉转弯

只看强制邻居仍然不够. 假如终点不在正在扫描的斜线上, 扫描可能一路越界, 尽管在中途转成横向或竖向就能到达终点.

例如空地上 S 在 `(0,4)`, G 在 `(6,1)`. 从 S 向右上走, 到 `(3,1)` 时已经与 G 同行. 这里没有墙, 也没有强制邻居, 但如果略过这个转向机会, 就会漏掉这条走法:

<section class="as-lab as-story" id="lesson-projection" data-path-lesson="projection" aria-label="沿斜线扫描, 在哪里转向?">
  <p class="as-title">沿斜线扫描, 在哪里转向?</p>
  <p>每按一次前进一步, 跟踪右上斜线及水平, 竖直分量的检查. 紫色虚线是当前分量扫描, 红框是正在检查的格子.</p>
  <div class="as-story-board" data-lesson-board><img src="/media/a-star-pathfinding/lesson-projection.svg" alt="从零四沿右上方向扫描, 在三一的水平分量找到六一的终点, 因而保留三一作为跳点." loading="lazy" width="444" height="368"></div>
  <div class="as-controls" data-lesson-controls hidden></div>
  <p class="as-story-status"><output data-lesson-status aria-live="polite">从零四沿右上方向扫描, 在三一的水平分量找到六一的终点, 因而保留三一作为跳点.</output></p>
</section>

因此, 沿斜向扫描时, 每到一个位置都先沿对应的水平和竖直方向作分量扫描. 从 J = `(3,1)` 向右的扫描能找到 G, 就说明斜线应该在 J 停下来, 留下从斜线接入这条水平分支的机会.

这次斜向扫描返回的是 J, 而不是直接把远处的 G 当成斜向后继. 后面展开 J 时, 再沿向右的方向找到 G. 不仅终点, 分量扫描若找到由强制邻居产生的跳点, 也需要保留这种衔接.

所以跳点不等于墙角. 它可以是终点, 出现强制邻居的位置, 也可以是这种分量扫描找到后续跳点的斜线衔接位置. 它们都是**同一个 JPS 的停止扫描条件**.

### 6.6 把剪枝与扫描接回 A*

把这两步接回 A*: 取出 f 最小的候选, 根据来向保留自然邻居和强制邻居方向, 再沿这些方向扫描. 扫到的跳点, 代替紧邻格子成为新的候选.

一次扫描按以下顺序处理:

1. 下一步撞墙或越界: 扫描失败, 不生成后继.
2. 到达终点: 返回终点.
3. 当前位置有强制邻居: 返回当前位置.
4. 正在斜向扫描, 且水平或竖直分量能找到跳点: 返回当前斜线位置.
5. 都不满足: 继续沿原方向扫描.

自然邻居和强制邻居回答"哪些方向不能剪", 跳点条件回答"沿这些方向扫到哪里停". 找到的跳点仍要参与 A* 的 g + h 比较, 并不是发现一个就立刻让角色走过去.

上面的例子可以只把 S → J → G 放在回溯链上. 费用仍按真实路程累计: S 到 J 是 3√2, J 到 G 是 3, 合计约 7.24, 不能把两次跳跃算成代价 2. 最后再把直线或斜线段补成连续的格子, 交给角色移动.

这里保留了一种能代表最优走法的移动顺序, 并在障碍打破替代关系时恢复必要的分支. [JPS 原论文](https://users.cecs.anu.edu.au/~dharabor/data/papers/harabor-grastien-aaai11.pdf)给出了这套规则保留最优路径的证明.

### 6.7 用完整搜索验证刚才的推导

<section class="as-lab" id="jps-lab" aria-label="A 星与 JPS 对照实验">
  <p class="as-title">实验二: 空地上哪些格子需要进入候选?</p>
  <p>先在空地上运行 JPS, 找到 (3,1) 这个衔接点. 再运行 A*, 比较进入候选和被取出的节点. 换成绕墙地图, 观察障碍怎样产生新的跳点. 两者使用相同的八方向移动和切角规则.</p>
  <div class="as-controls" data-controls hidden>
    <label>搜索方式 <select data-mode aria-label="跳点实验搜索方式"><option value="astar">A*</option><option value="jps" selected>JPS</option></select></label>
    <label>地图 <select data-scene aria-label="跳点实验地图"><option value="empty">空地</option><option value="wall">绕墙</option><option value="blocked">无路可走</option></select></label>
    <button type="button" data-step>下一步</button>
    <button type="button" data-finish>运行到结束</button>
    <button type="button" data-reset>重新开始</button>
  </div>
  <div data-board><img src="/media/a-star-pathfinding/jump-map.svg" alt="七乘五空地, S 在 (0,4), G 在 (6,1). 路线先斜向右上到 (3,1), 再向右到终点, 代价为 3√2 + 3." width="700" height="500"></div>
  <p class="as-legend">S 起点 / G 终点 / ? 候选 / x 已取出 / : 只被扫描 / * 路径. J 标记最终回溯得到的中间跳点. 点击格子查看记录, 窄屏可在网格内横向滚动.</p>
  <p class="as-status"><output data-status aria-live="polite">静态图展示 S → (3,1) → G. 启用 JavaScript 可比较 A* 与 JPS.</output></p>
  <p class="as-detail" data-detail>八方向, 横竖代价 1, 斜向代价 √2, 斜走只要求落点可通行.</p>
  <div class="as-frontier" data-frontier></div>
  <div class="as-trace" data-trace></div>
</section>

<script type="module" src="/media/a-star-pathfinding/jump-demo.js"></script>

局部图解分别展示了剪枝, 障碍与分量扫描, 这个完整实验则把它们放进同一次 A* 搜索里. 对照两者时, 要分清被扫描的格子, 与真正加入候选并被展开的跳点.

扫描并不是免费操作. 斜向扫描还会触发分量扫描, 同一区域也可能被重复检查. [后续 JPS 研究](https://arxiv.org/abs/2306.15928)讨论了这部分开销. 展开节点更少, 并不自动等于在所有地图上都更快.

### 6.8 只有四方向移动时呢?

如果游戏只允许横竖移动, 就要使用四方向跳点搜索, 即 Orthogonal Jump Point Search. 它仍然消除空地上的重复走法, 但没有斜线后, 保留转弯机会的规则也要重新设计.

例如空地中 S 与 G 不在同一行或列, 如果只是从八方向版本中删掉斜线, 剩余直线扫描可能全都越界而找不到 G. 四方向版本必须使用自己的扫描与剪枝规则. [PathFinding.js项目中的四方向实现](https://github.com/qiao/PathFinding.js/blob/master/src/finders/JPFNeverMoveDiagonally.js)在竖向扫描时还会检查水平分支. 这与八方向版本沿斜线检查分量的结构有关, 但不能当成同一套方向表.

本文这套 JPS 规则要求同类移动的代价一致: 所有直步都花 1, 所有斜步都花 √2. 如果有沼泽等额外地形代价, 交换步子顺序后可能踩到不同地形, 原来等价的走法就不等价了. 这时可以使用支持相应代价的 A*, 或研究带权网格的 JPS 变体. 本文先不继续展开这些变体.

## 7. 换一个方向减少搜索: 双向搜索

JPS 保持了 A* 的候选排序, 通过剪枝与扫描减少逐格展开. 接下来换一个思路: 不沿用 JPS 的跳点规则, 而是改变搜索从哪里出发. 如果 G 的位置已经确定, 也可以从 G 反向开始搜索, 让两边的前沿逐渐接近, 也就是**双向搜索**.

对于四方向单位代价地图, 双向 BFS 的做法很直接: 两边各维护队列和父节点, 每次完整扩展一层, 可以选择当前前沿较小的一边. 当一层中新发现的位置与另一边已经到达的区域连接, 就能拼出路径; 完整处理这一层并比较连接候选, 得到本轮最短的接法.

它在很多情况下能缩小两边各自覆盖的范围, 但收益依赖地图形状. 一条窄走廊里, 总共要检查的格子可能仍差不多. 对二维空地也不能直接套用搜索树上指数级的加速想象.

有代价之后, "两边第一次碰到"就不再自动代表最优. 双向 Dijkstra 会保留目前找到的最佳完整路径代价 μ, 继续搜索, 直到两边待处理的最小 g 之和不小于 μ, 才能排除更好的接法. 反向搜索还必须沿原图的反向边使用原代价, 有单行路时尤其需要区分.

双向 A* 进一步涉及两边启发式与停止条件的配合. 不能把两个普通 A* 各跑一份, 第一次相遇就直接宣称最短. PathFinding.js 的 [README](https://github.com/qiao/PathFinding.js#basic-usage)也没有把 BiAStarFinder 标为保证最短的实现. 因而网站上的 Bi-directional 适合观察搜索形状, 算法的最优性仍要按具体实现判断.

## 8. 路不必绝对最短时: Weighted A*

游戏里有时更关心及时给角色一个可用目标, 而不是每次都计算出最优路线. 一种调整方式是加大终点方向的影响:

$$
f=g+w h,\qquad w>1
$$

这叫 **Weighted A\***. w = 1 时是普通 A*, w 越大, 搜索通常越偏向目标方向, 可能减少展开, 也可能走出更长的路线. PathFinding.js 中 A* 的 Weight 选项就对应这种调整. 贪心搜索则直接按 h 排序, 完全不把 g 放进优先级.

它是路径质量与搜索开销之间的一种取舍, 不是对所有地图都更快的开关. 调大权重后, 不应继续承诺普通 A* 的最优性. 一些 Weighted A* 版本可以证明路径质量界, 但那还取决于启发式, 重开节点与停止条件, 不能仅凭一个权重数值就推断具体库的保证.

如果要求每帧只花固定时间, 还需要在实现上分批展开, 到预算后暂停并留到下一帧. 权重本身不提供帧时间上限.

## 9. 候选节点太多, 内存不够怎么办? IDA*

A* 会保留很多候选和位置记录. 如果瓶颈是内存, 可以换一个思路: 不保存完整候选前沿, 改用深度优先的方式试一条路线, 但给 g + h 设置上限.

初始上限取 h(S). 沿一条分支向前试, 某个位置的 f 超过上限就回退, 换另一条分支. 如果这一轮没有找到 G, 把上限提高到**本轮所有被截断分支中最小的超限 f**, 再从 S 搜索一轮. 这就是 **IDA\***, 迭代加深 A*.

例如初始上限是 8, 被截断分支的 f 分别是 10, 12, 14, 下一轮就用 10, 而不是随意加 1. 在可采纳启发式与正常终止条件下, 逐轮提高上限可以保留最优解.

这种方法主要保留当前递归路径, 核心搜索栈的内存随路径深度增长, 代价是很多位置会在多轮中被重复搜索. 网格里还有大量环路和汇合路线, 实现应避免当前路径上的循环; 如果额外保存全局去重表, 内存也会随之增加.

IDA* 有实际用途, 但在普通游戏网格里, 不应该因为名字像 A* 的升级版就默认选它. 只有内存限制比重复搜索的时间代价更紧时, 才值得重点考虑. 可视化网站里可以打开 Visualize recursion, 观察同一区域如何被多次试探. 设置了 Seconds limit 后, 中止表示预算用尽, 不能据此证明地图没有路. [该项目的 IDA* 实现](https://github.com/qiao/PathFinding.js/blob/master/src/finders/IDAStarFinder.js)也明确区分了这些执行条件, 尽管返回的空路径本身没有区分失败原因.

## 10. 把这些选择放回游戏里

这些方法改动的地方不同. BFS, Dijkstra 和 A* 主要决定先检查谁; JPS 进一步省掉可替代的分支; 双向搜索从两端推进; Weighted A* 允许路线更长, 以争取减少搜索; IDA* 少存候选, 代价是重复搜索. 选择时应先找出自己的瓶颈, 不必把它们当成逐级升级的版本.

| 当前问题                           | 可以先考虑             | 要保留的条件或代价                   |
| ---------------------------------- | ---------------------- | ------------------------------------ |
| 四方向, 每步一样贵, 地图不大       | BFS                    | 最少步数就是最小代价                 |
| 地形有不同代价, 没有合适的目标估计 | Dijkstra               | 非负边代价, 可能扩散较广             |
| 有明确终点, 地形代价可以不同       | A*                     | h 与移动规则匹配, 正确更新来路       |
| 均匀代价网格, 有较多可利用的空地   | JPS                    | 剪枝规则必须匹配方向与切角约定       |
| 只允许横竖的均匀网格               | 四方向 JPS 变体        | 不能只删掉八方向版本的斜向移动       |
| 起终点明确, 希望从两端缩小范围     | 双向 BFS / Dijkstra 等 | 正确的反向边与停止条件               |
| 可以接受较长路线, 希望偏向目标搜索 | Weighted A* / 贪心     | 不再默认保证最短, 仍需测实际开销     |
| 内存比重复计算更紧张               | IDA*                   | 可能大量重复搜索, 处理环路与预算中止 |

实际接入时, 还有几件事独立于上述选择:

- 角色有宽度, 网格上的通路要与碰撞一致. 可以先按角色尺寸扩张障碍, 再做寻路.
- 起点和终点要有效. 两者重合时, 路径代价为 0. 搜索前沿耗尽才表示当前地图下无路, 超时或预算中止是另一种结果.
- 地图改变后要检查旧路径是否仍然可走, 必要时重新规划. 单次 A* 或 JPS 不会自动处理角色之间的避让.
- 把连续直线上的格子压缩成端点, 不会改变路线; 若用视线检测把拐弯直接拉直, 则是在做路径平滑, 要重新检查碰撞. JPS 的扫描不等于任意方向的视线直连.

### 配合可视化复习

打开 [PathFinding.js](https://qiao.github.io/PathFinding.js/visual/), 可以按同一条推导顺序做几组实验:

1. 关闭斜向移动, 用同一张带墙地图比较 BFS 和 Dijkstra. 均匀代价下路径长度应一致, 展开顺序可能不同. 网站主要提供障碍编辑, 地形代价差异用本文的沼泽实验看.
2. 画一堵需要绕行的 U 形墙, 比较 Best-First-Search 与 A*, 观察靠近终点的方向为什么未必是好路. A* 先保持 Weight 为 1.
3. 在大块空地上比较 A* 和 JPS, 八方向使用 Octile, 同时核对切角规则. 打开 Visualize recursion, 把扫描与候选展开分开看.
4. 只走横竖时换 Orthogonal Jump Point Search, 比较空地中的衔接位置. 不把它与八方向 JPS 的路线代价混为一谈.
5. 打开 Bi-directional 观察两边前沿, 再增加 A* 权重或运行 IDA*, 分别观察搜索偏向和重复搜索. 比较结果时记录选项, 路径代价与中止原因, 不把动画播放时长当成算法耗时.

### 写在最后

写这篇时, 我才把不少算法想得更清楚, 其中一些以前也没有真正用过. ~~毕竟做 Demo 时, 性能还没那么紧张~~. 游戏引擎通常已经提供了寻路工具, 理解这些算法, 更多是为了知道该怎样设置它们, 出问题时又该检查哪里.

实际做游戏时, 我也更想先检查地图怎样表示: 格子划得是否合适, 角色宽度有没有算进去, 通道是否与碰撞体一致. 这些地方不对, 换一种搜索算法也未必能解决.

> _饥荒_ 中 守护月台任务 很多玩家会搭建半开口的围墙,并且在开口的格子正中央放置一个障碍物.饥荒并不是只能沿着各自移动的世界,月台和外部实际上是连通的,但怪物的寻路会让它们全都堵在障碍物处而不会进入月台. 思考一下,饥荒中怪物的寻路应该是怎样实现的? 这样做有什么好处?又有什么坏处?

![饥荒守护月台时, 怪物堵在围墙开口处的障碍物旁.](/media/a-star-pathfinding/dont-starve-moon-platform.gif)

## 参考资料

- [PathFinding.js 可视化](https://qiao.github.io/PathFinding.js/visual/)与[项目源码](https://github.com/qiao/PathFinding.js). 用于核对文中的选项与具体实现行为.
- [Red Blob Games: Introduction to A*](https://www.redblobgames.com/pathfinding/a-star/introduction.html). 从基本图搜索推导到启发式搜索.
- [Berkeley CS188: Search, Note 2](https://inst.eecs.berkeley.edu/~cs188/fa22/assets/notes/cs188-fa22-note02.pdf). A* 的最优性, 可采纳性与一致性.
- [Daniel Harabor: Jump Point Search](https://harablog.wordpress.com/2011/09/07/jump-point-search/). 作者对自然邻居和强制邻居的图示解释.
- [Harabor & Grastien, 2011: Online Graph Pruning for Pathfinding on Grid Maps](https://users.cecs.anu.edu.au/~dharabor/data/papers/harabor-grastien-aaai11.pdf). JPS 的定义与最优性证明.
- [Zhao, Harabor & Stuckey, 2023: Reducing Redundant Work in Jump Point Search](https://arxiv.org/abs/2306.15928). 进一步了解跳点搜索中重复扫描的代价.

<script type="module" src="/media/a-star-pathfinding/lesson-demo.js"></script>
