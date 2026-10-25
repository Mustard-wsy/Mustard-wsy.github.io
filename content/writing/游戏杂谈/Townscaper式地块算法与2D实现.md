---
title: '做出会生长的岛屿: 从四角拼接到 Townscaper 式不规则网格'
slug: 'townscaper-dual-grid-2d'
description: '从有限素材怎样拼出连续海岸出发,逐步实现四角状态, 旋转查表, 三角形合并, 全四边形细分与网格松弛,并通过交互演示做出可以点击编辑的二维岛屿.'
dateStatus: 'before-site'
draft: false
tags: ['游戏开发', '程序化生成', '对偶网格']
---

玩 Bad North 的时候, 我注意到它的地块与 Townscaper 很像: 看起来是四边形, 却没有 Minecraft 那种整齐的方格感. 地面既保留了手绘素材的细节, 又显得自然. 这样的地块是怎么拼出来的?

如果让算法直接生成所有细节, 很难控制画面风格. 换个做法, 可以先画少量素材, 再让程序把它们拼起来. Oskar Stålberg 展示过的地块方案, 就让这件事变得很有意思.

下面做一个小型二维版本. 先在规则方格上拼出海岸, 再改变网格的形状, 最后让玩家点击地面就能添加或移除陆地. 代码会用到四角状态, 三角形合并和网格松弛; 文末附有完整 JavaScript 实现, 可以独立使用.

可以先玩一下[可编辑岛屿](#tg-terrain), 再回来看看它怎样生成. 只想了解思路的话, 顺着图和交互往下看就好; 公式与代码留给想自己实现的时候.

<figure>
  <img src="/media/townscaper-dual-grid-2d/townscaper-building.gif" alt="Townscaper 中的建筑围合出绿色庭院,展示局部组合如何形成完整的城镇景观." width="512" height="512">
  <figcaption>Townscaper 的建筑与庭院.动图来自 Oskar Stålberg 的 <a href="https://imgur.com/gallery/instant-town-building-i364LBr">Instant town building!</a>.</figcaption>
</figure>

<link rel="stylesheet" href="/media/townscaper-dual-grid-2d/demo.css">

## 1. 先解决拼接,再改变网格

> 这里讲的是Dual Tile 如果你很熟悉,完全可以跳过!

先想一张普通方格地图.最直观的办法是每格保存"陆地或水",再根据周围邻居选择图片.如果检查八个二值邻居,输入就有 $2^8=256$ 种.即使合并对称情况,美术和逻辑仍然需要共同照顾许多边界.最终我们要准备**47**种Tile. 更何况这是只有两种Texture的情况.

还有一个更具体的问题: 一张图片画在格子内部,凹角和凸角却往往发生在几个格子的交界处.我们希望把需要一起画的转角放进同一个素材单元.

因此,先改变数据与显示的对应关系:

**把海陆状态放在网格顶点上,让每个面读取自己的四个角.**

```text
p0 ───────── p1       顶点存状态：0 是水,1 是陆地
│            │       面读取四角：决定本面显示的形状
│  显示单元  │
│            │
p3 ───────── p2
```

四个相邻的状态点围出一个显示单元. 这让显示单元与原来的状态网格错开半格, 也就是这里用到的对偶网格思路. 实现时, 每个顶点保存海陆状态, 每个面记住自己的四个顶点即可, 不必真的再画一套网格.

这一步减少了每个显示单元需要检查的输入: 四个角,每角两种状态,一共 $2^4=16$ 种.代价是地图的表达方式变了: 现在操作的是共享状态点,陆地边界由周围几个面共同表现.可能没那么直观,不过节省的美术素材准备工作让我完全无法拒绝.

## 2. 16 种状态,只准备五类非空素材

### 统一位序,才能正确旋转

我们始终沿面的环序存放顶点: 左上 `p0`, 右上 `p1`, 右下 `p2`, 左下 `p3`.位权依次为 1, 2, 4, 8.

```js
function maskOf(face, states) {
  return face.reduce(
    (mask, vertexId, i) => mask | ((states[vertexId] ? 1 : 0) << i),
    0,
  );
}
```

例如 `p0` 和 `p1` 是陆地,得到 `1 + 2 = 3`,写成二进制是 `0011`.**二进制字符串从高位到低位读作 `p3 p2 p1 p0`**,不要把字符串的左右位置当成空间上的左右.

<section class="tg-demo" id="tg-mask" aria-label="四角拼接实验">
  <p class="tg-title">实验一 · 四个角怎样决定一块地形</p>
  <p class="tg-help">点击四角的 0 / 1,或选择下方的任意组合.绿色是陆地.这里我们用简单的几何轮廓来演示拼接规则.</p>
  <div class="tg-mask-editor">
    <div data-mask-visual><img src="/media/townscaper-dual-grid-2d/mask.svg" alt="单角素材示意: 只有左上角为陆地,海岸连接上边与左边的中点." width="240" height="240"></div>
    <button class="tg-corner" type="button" data-corner="0" data-enhanced hidden aria-label="切换左上角 p0" aria-pressed="true">1</button>
    <button class="tg-corner" type="button" data-corner="1" data-enhanced hidden aria-label="切换右上角 p1" aria-pressed="false">0</button>
    <button class="tg-corner" type="button" data-corner="2" data-enhanced hidden aria-label="切换右下角 p2" aria-pressed="false">0</button>
    <button class="tg-corner" type="button" data-corner="3" data-enhanced hidden aria-label="切换左下角 p3" aria-pressed="false">0</button>
  </div>
  <div class="tg-gallery" data-gallery data-enhanced hidden></div>
  <p class="tg-status"><output aria-live="polite">单角状态: 掩码 0001.启用 JavaScript 后可切换全部 16 种组合.</output></p>
</section>

### 旋转后,它们只有六类

把同一种形状旋转后复用,可以得到下面的分类.全水不绘制,因此实际只需准备五类非空素材.

| 类别     | 基础掩码 | 陆地角       | 旋转后的不同状态数 |
| -------- | -------- | ------------ | ------------------ |
| 全水     | `0000`   | 无           | 1                  |
| 单角     | `0001`   | `p0`         | 4                  |
| 相邻双角 | `0011`   | `p0、p1`     | 4                  |
| 对角     | `0101`   | `p0、p2`     | 2                  |
| 缺一角   | `0111`   | `p0、p1、p2` | 4                  |
| 全陆     | `1111`   | 全部         | 1                  |

合计 $1+4+4+2+4+1=16$.这个分类只使用旋转,不要求镜像.

在屏幕坐标中,顺时针旋转一次使 `p0 → p1 → p2 → p3 → p0`,对应四位循环左移:

```js
function rotateMask(mask) {
  return ((mask << 1) & 15) | (mask >> 3);
}

const bases = [0, 1, 3, 5, 7, 15];
const lookup = new Map();
for (const base of bases) {
  let mask = base;
  for (let turns = 0; turns < 4; turns++) {
    if (!lookup.has(mask)) lookup.set(mask, { base, turns });
    mask = rotateMask(mask);
  }
}
```

渲染时,读取四角掩码,查出基础素材和旋转次数即可.旋转素材的局部坐标可以使用 `(u,v) → (1-v,u)`; 旋转纹理时,则应按相同的对应关系安排目标顶点与 UV.

### 拼接顺畅靠的是边缘约定

最后我们约定好每条边的含义:

- 两端都是水: 整条边为水.
- 两端都是陆地: 整条边为陆地.
- 两端状态不同: 海岸在边的中点穿过.

## 3. 为什么从三角形出发做四边形?

方格上的拼接已经能工作了. 接下来想把整齐的横竖线打散, 让地块看起来不那么像棋盘.

只把方格顶点随机挪一挪, 虽然格子歪了, 内部每个点通常还是连接四条边, 原来的行列结构仍很明显. 我们想连相邻关系一起改变, 但最后每个面仍要有四个角, 才能继续使用刚才的素材.

三角形适合拿来做中间步骤: 它容易铺满平面, 两个相邻三角形又能合成四边形. 随机合并后会剩下一些落单的三角形, 暂时保留它们就好, 后面的统一细分会把所有面都变成四边形.

先准备一套所有阶段共用的数据:

```js
const mesh = {
  vertices: [
    [x0, y0],
    [x1, y1] /* ... */,
  ],
  faces: [
    [0, 1, 2],
    [1, 3, 2] /* ... */,
  ],
};
```

顶点在数组中的索引就是它的 ID. 面只保存这些 ID, 并按绕面一圈的顺序排列. 两个面共用一个点时, 要引用同一个 ID; 后面移动坐标, 它们才会一起变化.

本文使用屏幕坐标, x 向右, y 向下, 所有面的顶点保持同一种绕向.

### 用轴向坐标生成三角点阵

取整数坐标 `(q,r)`,映射到平面:

$$
x=s(q+r/2), \qquad y=s\frac{\sqrt{3}}{2}r
$$

其中 $s$ 是初始点距.`q` 方向水平,`r` 方向倾斜 60°,得到等距三角点阵.

取满足以下条件的点,可以裁出半径为 $R$ 的六边形区域:

$$
\max(|q|,|r|,|q+r|)\le R.
$$

这里的六边形是生成区域的外形.每个小面仍然是三角形.

为每个 `(q,r)` 分配 ID,存入坐标到 ID 的映射.随后枚举下面两个三角形; 只有三个点都存在时才加入:

```text
a = (q, r)          b = (q+1, r)
c = (q, r+1)        d = (q+1, r+1)

加入 [a,b,c] 与 [b,d,c]
```

这一步不需要通用三角剖分库,因为点阵的连接方式已经确定.

## 4. 随机合并,打破重复的连接关系

为了找到相邻三角形,先建立无向边索引.边的两个端点排序后作为键,确保 `a-b` 与 `b-a` 被识别为同一条边.

```js
const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

// 遍历每个面的每条边,记录这条边被哪些面使用.
// edgeMap.get(edgeKey(a,b)) → { a, b, faces: [faceId, ...] }
```

边只属于一个面时,它是边界; 属于两个面时,是可考虑合并的内部边.三角形配对的流程是:

1. 收集所有内部边,使用带种子的随机数将候选顺序打乱.
2. 查看边两侧的三角形; 任何一侧已经使用,就跳过.
3. 按合并概率决定是否接受; 接受后把两侧标记为已使用.
4. 移除公共边,保留四条外边,按环序记录新的四边形.
5. 把所有未使用的三角形也保留下来.

在等边三角点阵中,相邻两面合并为凸菱形,因此可以把四个不重复顶点绕中心按角度排序.若以后改为任意三角网格,就应沿外边追踪边界,并检查结果是否为凸四边形.

打乱候选顺序可以减轻按行遍历带来的方向偏好.合并概率控制一次候选尝试是否被接受,并不等于最终被合并的三角形比例.

<section class="tg-demo" id="tg-geometry" aria-label="网格生成分步实验">
  <p class="tg-title">实验二 · 亲手走一遍网格生成</p>
  <p class="tg-help">按顺序切换阶段.固定种子便于比较同一张网格; 调节合并概率会重建网格并重置下面的岛屿.松弛只改变位置,保留海陆状态.</p>
  <div class="tg-controls" data-enhanced hidden>
    <label>生成阶段 <select data-stage aria-label="生成阶段"><option value="0">1 · 点阵</option><option value="1">2 · 三角形</option><option value="2">3 · 随机合并</option><option value="3">4 · 全四边形细分</option><option value="4" selected>5 · 松弛</option></select></label>
    <label>种子 <input type="number" data-seed value="42" min="1" max="999999" step="1" aria-label="随机种子"></label>
    <button type="button" data-generate>按种子重新生成</button>
    <label>合并概率 <input type="range" data-merge value="65" min="0" max="100" step="5" aria-label="合并概率"><span data-merge-value>65%</span></label>
    <label>松弛 <input type="range" data-relax value="20" min="0" max="30" step="1" aria-label="松弛迭代次数"><span data-relax-value>20 次</span></label>
  </div>
  <div class="tg-visual" data-visual><img src="/media/townscaper-dual-grid-2d/grid.svg" alt="三角点阵经随机合并, 细分和松弛后形成的不规则四边形网格." width="460" height="460" loading="lazy"></div>
  <div class="tg-legend"><span class="tg-triangle">三角形</span><span class="tg-quad">四边形</span></div>
  <p class="tg-status"><output aria-live="polite">启用 JavaScript 后可逐步查看点阵, 三角形, 合并, 细分和松弛.</output></p>
</section>

## 5. 一个统一细分规则,消除所有三角形

随机合并不必做到"一个三角形都不剩".对每个面执行同一条规则就够了:**每条边取中点,面内部取中心,每个原顶点对应一个新四边形.**

设一个面按环序有顶点 $v_0,\ldots,v_{n-1}$,定义:

$$
c=\frac1n\sum_i v_i,\qquad m_i=\frac{v_i+v_{i+1}}2.
$$

下标循环取值.以原顶点 $v_i$ 为起点,生成:

$$
[v_i,\ m_i,\ c,\ m_{i-1}].
$$

因此三角形产生 3 个四边形,四边形产生 4 个四边形.两个阶段用的是同一套代码:

```js
for (const face of mesh.faces) {
  const centerId = addVertex(mean(face.map((id) => vertices[id])));
  for (let i = 0; i < face.length; i++) {
    const a = face[i];
    const b = face[(i + 1) % face.length];
    const previous = face[(i + face.length - 1) % face.length];
    newFaces.push([a, midpointId(a, b), centerId, midpointId(previous, a)]);
  }
}
```

这里 `addVertex` 把坐标追加到顶点数组并返回 ID;`mean` 是坐标平均.`midpointId(a,b)` 则要用无向边键缓存结果: 第一次遇到边时新增中点,以后直接返回同一个 ID.

**只保证中点坐标一样还不够,它的 ID 也必须共享.** 否则两块地形看起来相连,编辑和松弛时却会把它们当成两个独立点,最终拉出裂缝.

细分会改变顶点数量,所以海陆状态应在最终拓扑建立后再初始化.

## 6. 松弛: 让形状舒展,但不再改连接

细分后的四边形已经能用,形状却可能显得生硬.现在保持所有面的顶点 ID 不变,只调整坐标.

为每个顶点收集沿边相连的邻居,求平均位置,再向平均位置移动一小步:

$$
\bar p_i=\frac1{|N(i)|}\sum_{j\in N(i)}p_j,
\qquad p_i'=(1-\alpha)p_i+\alpha\bar p_i.
$$

可以从 $\alpha=0.35$, 20 次迭代开始观察.它们是演示参数,需要结合目标形状调整.

实现时遵守三个约定:

1. **每轮同步更新.** 所有新位置只读取上一轮的数据,计算完再统一替换,避免结果依赖遍历顺序.
2. **固定外边界.** 用边索引找出只属于一个面的边,锁定其端点,减轻整体收缩.
3. **检查几何有效性.** 一轮移动后,检查每个四边形四个连续转角的叉积是否保持同号且远离零.如果变凹或退化,就缩小本轮步长重试; 仍不成立则保留上一轮位置.

这一步只让顶点向邻居的平均位置靠近, 没有直接要求每个角都接近直角, 或每个面的面积相同. 因此迭代更多次未必更好. 在演示里比较 0 次和 20 次, 可以直接看见它改变了哪些形状.

至此,生成流程已经闭合:

```text
三角点阵 → 随机配对合并 → 每个面统一细分 → 固定边界松弛
                                     ↓
                        不规则,但每个面都有四个角
```

## 7. 素材怎样贴到扭曲的四边形上?

我们刻意保留"四个角",就是为了继续使用第一部分的素材.

素材先在单位正方形中制作,局部坐标 $(u,v)$ 都在 0 到 1 之间.设目标四边形的环序顶点为 $q_0,q_1,q_2,q_3$,对应单位方形的左上, 右上, 右下, 左下,则双线性映射为:

$$
P(u,v)=(1-u)(1-v)q_0+u(1-v)q_1+uvq_2+(1-u)vq_3.
$$

```js
function bilinear(quad, u, v) {
  const weights = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
  return [0, 1].map((axis) =>
    quad.reduce((sum, p, i) => sum + weights[i] * p[axis], 0),
  );
}
```

演示中的海岸曲线先在单位方形里取样,再将这些点逐一映射到四边形上.共享边上,公式会退化成两个端点之间的线性插值,所以沿边同一比例的位置能够对齐.

如果使用游戏引擎中的纹理,有两种实现层次:

- **最小原型:** 四顶点, 两三角形,设置四角 UV.搭建简单,但三角形内部是分片线性插值,某些纹理会在对角线附近出现变形差异.
- **更细致的变形:** 将单位素材细分成小网格,对每个素材顶点使用上式,再渲染小三角形; 或在着色器中实现所需映射.前者是对双线性变形的离散近似,细分越密越接近.

面歪了以后, 很难再凭外观说哪个角是 "左上". 这里的 p0 只是约定的第一个顶点. 只要读状态, 旋转素材和映射坐标时沿用同一套顺序, 就不会贴反, 也不用每次重新判断全局方向.

## 8. 最后接入玩家操作,岛屿就能生长

给最终网格的每个顶点分配一个状态,先全部设为水:

```js
const states = Array(mesh.vertices.length).fill(0);
const incidentFaces = mesh.vertices.map(() => []);
mesh.faces.forEach((face, faceId) => {
  face.forEach((vertexId) => incidentFaces[vertexId].push(faceId));
});
```

玩家点击时,将屏幕坐标转换到地图的局部坐标,找到一定拾取距离内最近的顶点,翻转它,再更新所有关联面:

```js
states[vertexId] ^= 1;
for (const faceId of incidentFaces[vertexId]) {
  const mask = maskOf(mesh.faces[faceId], states);
  const { base, turns } = lookup.get(mask);
  // 用 base 选择素材,按 turns 旋转,映射到该面的四个顶点.
  redrawFace(faceId, base, turns);
}
```

在普通方格内部,一个顶点通常关联四个面; 在不规则网格上不一定如此,所以应查询关联表.这样修改的仍是一个状态,却能让周围地形同时响应.

<section class="tg-demo" id="tg-terrain" aria-label="可编辑岛屿实验">
  <p class="tg-title">实验三 · 点一下,让海岸改变</p>
  <p class="tg-help">直接点击顶点附近翻转海陆,红框会标出与这个顶点关联的地块.</p>
  <div class="tg-controls" data-enhanced hidden>
    <button type="button" data-action="clear">全部设为水</button>
    <button type="button" data-action="island">恢复示例岛屿</button>
    <label><input type="checkbox" data-wire checked>显示网格</label>
    <label><input type="checkbox" data-points checked>显示顶点</label>
  </div>
  <div class="tg-visual" data-visual><img src="/media/townscaper-dual-grid-2d/island.svg" alt="不规则四边形上的示例岛屿,海陆由共享顶点状态决定,绿色海岸连续穿过相邻地块." width="460" height="460" loading="lazy"></div>
  <div class="tg-legend"><span class="tg-land">陆地</span><span>水域</span></div>
  <p class="tg-status"><output aria-live="polite">海陆共用同一张四边形网格.启用 JavaScript 后可以编辑.</output></p>
</section>

示例岛屿没有使用复杂的自动生成器: 将顶点到中心的距离与一个随角度变化的半径比较,范围内设为陆地.它只负责给演示一个初始形状.

在游戏里,可以把这层换成玩家操作, 噪声阈值, 手工地图,或带约束的生成结果.**生成网格, 决定状态, 渲染素材是三个独立步骤.** WFC 等方法可以参与决定内容,但不是生成这张网格的必要条件.

演示为了便于阅读代码,每次编辑会重画小型 SVG; 上面的游戏接入代码则示意如何按关联面局部更新.两者使用相同的状态规则.

## 9. 把完整实现接入自己的项目

完整算法文件可以直接查看或保存:[grid.js](/media/townscaper-dual-grid-2d/grid.js).它不访问 DOM,也不依赖当前页面; 浏览器可以作为 ES module 导入,Node.js 可放在 `type: module` 项目中使用,或保存为 `.mjs` 后导入.~~不过更建议的办法是直接发给你的AI,让它接入你的项目~~

```js
import {
  makeTriangles,
  mergeTriangles,
  subdivide,
  relax,
  adjacencyOf,
  maskOf,
  classify,
  bilinear,
} from './grid.js';

const triangles = makeTriangles(4); // 单位点距,六边形半径 4
const mixed = mergeTriangles(triangles, 0.65, 42); // 概率、随机种子
const quads = subdivide(mixed);
const mesh = relax(quads, 20, 0.35);
const states = Array(mesh.vertices.length).fill(0);
const { incident } = adjacencyOf(mesh);

// 示例：将一个顶点改为陆地,列出需要更新的面和素材.
states[0] = 1;
for (const faceId of incident[0]) {
  const face = mesh.faces[faceId];
  const tile = classify(maskOf(face, states));
  const corners = face.map((id) => mesh.vertices[id]);
  console.log(faceId, tile.name, tile.turns, corners);
  // corners 交给引擎构建网格；bilinear 用于映射素材内部顶点.
}
```

这里 `classify` 与前文的查表具有相同作用,返回基础掩码, 类别名和旋转次数.生成器采用固定种子的伪随机数,并打乱合并候选顺序; 相同参数和同一版本代码会生成相同网格.`vertices` 的坐标乘以世界单位尺寸,即可控制地块大小.

移植到 Godot, Unity 或自己的渲染器时,保留 `vertices / faces / states / incident` 四组数据即可: 网格阶段生成几何,渲染阶段建立多边形或三角网格,输入阶段更新状态.素材可以替换成自己的贴图或局部模型,不需要跟着更换拓扑算法.

### 接入时检查这些可观察的结果

| 阶段     | 应该成立的条件                        | 常见原因                       |
| -------- | ------------------------------------- | ------------------------------ |
| 三角点阵 | 内部边属于两个面,边界边属于一个面     | 重复生成或漏掉三角形           |
| 随机合并 | 每个原三角形只使用一次                | 缺少已使用标记                 |
| 统一细分 | 所有面有四角,共享中点使用同一 ID      | 每个面各建了一份边中点         |
| 松弛     | 顶点 ID 与面连接不变,面保持凸且不退化 | 原地更新或步长过大             |
| 拼接     | 16 种状态都有定义,公共边轮廓一致      | 位序, 旋转或素材边缘约定不一致 |
| 编辑     | 只改一个状态,关联面一起更新           | 状态误存到面上或关联索引不完整 |

若要加入碰撞和寻路,尽量让它们与渲染使用同一套地形轮廓或连通规则,特别是对角状态.若要保存地图,保存生成参数, 算法版本和玩家修改后的状态; 只保存种子无法恢复玩家的编辑.

### 怎样进一步减少重复感?

例如 "只有一个角是陆地" 这类素材, 可以画成几张不同的草地: 一张带石头, 一张带草丛. 细节可以变, 海岸穿过边的位置仍要相同, 才能与邻块接上. 再用 "地图种子 + 稳定面 ID" 固定每块选哪张图, 重画时草丛就不会突然变成石头.

如果以后要放跨越几个面的建筑, 还得检查它占了哪些面, 朝哪个方向, 是否与其他内容冲突. 无限地图则还要处理区块接缝, 让两侧共享的点和生成规则一致. 这些可以继续扩展, 当前的小地图已经能完成四角拼接与点击编辑.

## 延伸阅读

我们实现的是一张有限的二维地图,采用邻居平均松弛与几何示意素材.若想继续了解原作者的设计过程,可以阅读 [Oskar Stålberg 的"Instant town building!"](https://imgur.com/gallery/instant-town-building-i364LBr),其中介绍了三角形合并, 统一细分和松弛的基本流程.

最初的灵感来自 B 站视频["程序化生成的两难困境与 Oskar Stålberg 的天才解法"](https://www.bilibili.com/video/BV1y7rfBgEpM/),本人也曾发帖讲解过[X的帖子](https://x.com/OskSta/status/1448248658865049605),他还手绘了讲解的草图.

<script type="module" src="/media/townscaper-dual-grid-2d/demo.js"></script>
