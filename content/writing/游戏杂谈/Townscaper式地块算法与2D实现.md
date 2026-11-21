---
title: '这到底是四边形网格还是非四边形网格?'
slug: 'townscaper-dual-grid-2d'
description: '点一下岛上的顶点, 看海岸怎样穿过相邻地块. 再把网格倒回三角形阶段, 找出最后一个三角形是在哪一步消失的.'
dateStatus: 'before-site'
draft: false
tags: ['游戏开发', '程序化生成', '对偶网格']
---

玩 Bad North 的时候, 我注意到它的地块与 Townscaper 很像: 看起来是四边形, 却没有 Minecraft 那种整齐的方格感. 地面既保留了手绘素材的细节, 又显得自然. 这样的地块是怎么拼出来的?

<link rel="stylesheet" href="/media/townscaper-dual-grid-2d/demo.css">

这张二维小岛也有那种乍看数不清边的地块. 先点一下岸边几条线交会的地方, 留意红框圈住了几块地.

<section class="tg-demo" id="tg-terrain" aria-label="可编辑岛屿实验">
  <p class="tg-title">点一下,让海岸改变</p>
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

你只点了一下, 周围几块地的海岸却一起变了. 再点同一个位置, 它们又一起变回来. 岛上记着哪里是陆地, 哪里是水, 记号就放在这些交点上. 两块地共用一个角, 当然也就读到了同一个记号. 红框圈出的正是用到这个角的地块.

## 把一块海岸放大

只看下面这一格. 让左上角和右上角亮起来, 再把右上角的陆地换到右下角. 两次都是两个角有陆地, 画出来的岸线一样吗?

<section class="tg-demo" id="tg-mask" aria-label="四角拼接实验">
  <p class="tg-title">四个角怎样决定一块地形</p>
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

第一种摆法里, 整条上边都是陆地. 第二种摆法里, 四条边各有一头是水, 岸线得穿过每一条边. 可如果把第一种摆法整体转个直角, 同一张岸边素材转一转就能接着用. 四个角各有水陆两种选择, 一共有16种摆法. 扣掉全是水的那一种, 按旋转归在一起, 只需五类素材: 一个陆角, 两个相邻陆角, 两个对角陆角, 三个陆角, 以及整块陆地.

拼图时最容易露馅的是接缝. 假如一条边左端是陆地, 右端是水, 我们约好让海岸从这条边的中点穿过. 隔壁那块地看到的是同一对端点, 也会把岸线画到同一个中点. 这样一来, 素材里的草坡怎么弯都还有余地, 到边缘时却不会和邻居错开.

## 最后一个三角形去哪了?

四角拼接解释了海岸怎样连起来. 可回头看看岛上那些东倒西歪的格子, 它们哪里像刚才的方框? 把下面的生成阶段切回"三角形", 保持同一个种子, 盯住地图中央的一小片地.

<section class="tg-demo" id="tg-geometry" aria-label="网格生成分步实验">
  <p class="tg-title">亲手走一遍网格生成</p>
  <p class="tg-help">按顺序切换阶段.固定种子便于比较同一张网格; 调节合并概率会重建网格并重置前面编辑的岛屿.松弛只改变位置,保留海陆状态.</p>
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

切到"随机合并", 一些原本夹在两个三角形之间的边消失了. 两个三角形配成一块四边形, 没配上的仍是三角形. 如果在这里停住, 说它是四边形网格确实不对.

接下来这一步才关键. 找一块没配上的三角形, 想象在三条边上各点一个中点, 再把中心连到这三个中点. 沿着其中一小块走一圈: 原来的角, 边中点, 中心, 另一条边的中点. 正好四个角. 切到"全四边形细分"就能看到, 原来的三角形分出了三块四边形, 原来的四边形同样分出了四块. 哪怕把合并概率调到零, 这一步也不会留下三角形.

最后切到"松弛", 把滑块从零慢慢往右拖. 边界固定着, 内部的点朝邻居的平均位置挪动. 注意看一条歪边: 两头的位置变了, 接的还是那两个点. 所以答案是: **最后确实是四边形网格. 四边形只需有四条边, 并不需要四个直角, 也不用排成横平竖直的行列.**

再回到[岛上](#tg-terrain), 挑一块最不像方格的地, 沿轮廓数一圈. 点一下它的角, 刚才在方框里看到的那套水陆规则, 在这块歪地上照样管用.

<figure>
  <img src="/media/townscaper-dual-grid-2d/townscaper-building.gif" alt="Townscaper 中的建筑围合出绿色庭院,展示局部组合如何形成完整的城镇景观." width="512" height="512">
  <figcaption>Townscaper 的建筑与庭院.动图来自 Oskar Stålberg 的 <a href="https://imgur.com/gallery/instant-town-building-i364LBr">Instant town building!</a>.</figcaption>
</figure>

这张小岛只用几何轮廓演示二维海岸. 我最初是从[这个视频](https://www.bilibili.com/video/BV1y7rfBgEpM/)注意到这个做法的. 想看 Oskar Stålberg 自己画的草图, 可以看他的[原帖](https://x.com/OskSta/status/1448248658865049605). 本页的[网格生成源码](/media/townscaper-dual-grid-2d/grid.js)也在这里.

<script type="module" src="/media/townscaper-dual-grid-2d/demo.js"></script>
