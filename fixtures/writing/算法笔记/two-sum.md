---
title: '两数之和: 从枚举到哈希表'
slug: 'two-sum'
description: '把"寻找另一个数"换成"记住已经见过的数", 思路就转了一个弯.'
dateStatus: 'before-site'
draft: false
tags: ['Hot 100', '哈希表']
topic: 'hot-100'
topicOrder: 1
---

> 算法笔记的版式样例, 不属于正式内容.

## 初始思路

最直接的方法是枚举两个位置. 把这个思路写下来, 再问一次: 是否能复用已经见过的信息?

## 关键转折

遍历当前数时, 检查目标值与当前数的差是否已经出现. 这样就把查找转化成一次表查询.

```python
def two_sum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        if target - value in seen:
            return [seen[target - value], index]
        seen[value] = index
```

## 复习时再问自己

为什么先查找, 再把当前元素放入表? 如果遇到两个相同的数, 这个顺序有什么作用?
