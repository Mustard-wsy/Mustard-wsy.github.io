---
title: 'TCP 为什么需要三次握手?'
slug: 'tcp-handshake'
description: '从双方需要确认的信息出发, 重新理解连接是怎样建立起来的.'
publishedAt: '2026-10-09'
draft: false
tags: ['计算机网络', '传输层']
topic: 'computer-networks'
topicOrder: 1
---

> 这是一篇用于检验阅读体验的样例, 不是作者已经完成的学习笔记. 正式构建不会包含它.

## 先把问题问清楚

背下"三次握手"并不难. 更值得想一想的是: 连接建立时, 两端分别需要知道什么? 如果只交换两次消息, 又会少掉哪一部分确认?

从这个问题出发, 可以先画出消息流向, 再给每条消息写下它所确认的信息. 协议里的字段也就不再只是需要记住的缩写.

## 把过程摊开来看

下面的表格用来展示正文中的信息整理方式. 实际笔记可以继续补充序号, 状态转换与抓包结果.

| 消息      | 方向            | 关注的信息                         |
| --------- | --------------- | ---------------------------------- |
| SYN       | 客户端 → 服务端 | 发起建立连接, 同步初始序号         |
| SYN + ACK | 服务端 → 客户端 | 确认收到请求, 并同步自己的初始序号 |
| ACK       | 客户端 → 服务端 | 确认收到服务端的初始序号           |

### 用代码辅助表达

代码块应当安静地融入文章. 长行在代码块内部滚动, 不挤压整篇文章.

```python
def describe_packet(seq: int, ack: int, flags: str) -> str:
    return f"sequence={seq}, acknowledgement={ack}, flags={flags}"

print(describe_packet(seq=100, ack=0, flags="SYN"))
```

## 给公式留一个位置

课程笔记中也会遇到数学表达. 比如, 把一个长度为 $L$ 比特的分组送入速率为 $R$ 比特每秒的链路, 其发送时延为:

$$
t_{\mathrm{transmission}} = \frac{L}{R}
$$

公式, 中文解释与单位应当放在一起阅读, 而不是以截图的形式存在.

## 留下还没想明白的部分

学习记录可以暂时保留问题, 不需要每一次都写成完整教程.

- 历史连接请求到达时, 两端各自会怎样处理?
- 丢失不同阶段的消息, 会观察到什么重传行为?
- 怎样用一次实际抓包验证自己的理解?

下一次回到这篇笔记时, 可以接着这些问题往下走.

## HTML 交互示例

以下仅用于验证 Markdown 内的原生 HTML 和脚本, 不是课程内容.

<details>
  <summary>展开说明</summary>
  <p>折叠内容不需要 JavaScript.</p>
</details>

<div id="note-counter">
  <button type="button">点击计数</button>
  <output aria-live="polite">0</output>
</div>

<script src="/media/note-counter.js" defer></script>
