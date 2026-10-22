// Teaching geometry uses Cartesian coordinates: x right, y up.
export const EPS = 1e-9;
export const orient = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const equal = (a, b) => distance(a, b) < EPS;
export const pathLength = (path) =>
  path.slice(1).reduce((total, p, i) => total + distance(path[i], p), 0);
export const center = (face, vertices) =>
  face.reduce(
    (p, id) => [
      p[0] + vertices[id][0] / face.length,
      p[1] + vertices[id][1] / face.length,
    ],
    [0, 0],
  );
const edgeKey = (a, b) => [Math.min(a, b), Math.max(a, b)].join(':');

export function circumcircle(a, b, c) {
  const denominator = 2 * orient(a, b, c);
  if (Math.abs(denominator) < EPS) return null;
  const square = (p) => p[0] * p[0] + p[1] * p[1];
  const x =
    (square(a) * (b[1] - c[1]) +
      square(b) * (c[1] - a[1]) +
      square(c) * (a[1] - b[1])) /
    denominator;
  const y =
    (square(a) * (c[0] - b[0]) +
      square(b) * (a[0] - c[0]) +
      square(c) * (b[0] - a[0])) /
    denominator;
  return { center: [x, y], radius: distance([x, y], a) };
}

// This is a known valid decomposition of one rectangular room with one hole,
// not a general CDT generator. The article distinguishes it from general baking.
export function makeRoom(radius = 0.5) {
  const r = radius;
  const vertices = [
    [r, r],
    [12 - r, r],
    [12 - r, 8 - r],
    [r, 8 - r],
    [4.8 - r, 2.5 - r],
    [7.2 + r, 2.5 - r],
    [7.2 + r, 5.5 + r],
    [4.8 - r, 5.5 + r],
  ];
  const faces = [
    [0, 1, 4],
    [1, 5, 4],
    [1, 2, 5],
    [2, 6, 5],
    [2, 3, 6],
    [3, 7, 6],
    [3, 0, 7],
    [0, 4, 7],
  ];
  const constrained = new Set(
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
    ].map((edge) => edgeKey(...edge)),
  );
  return { vertices, faces, constrained, radius: r };
}

export function edgeIndex(mesh) {
  const edges = new Map();
  mesh.faces.forEach((face, faceId) =>
    face.forEach((a, i) => {
      const b = face[(i + 1) % face.length],
        key = edgeKey(a, b);
      if (!edges.has(key))
        edges.set(key, {
          vertices: [a, b],
          faces: [],
          constrained: mesh.constrained.has(key),
        });
      edges.get(key).faces.push(faceId);
    }),
  );
  return edges;
}

export function locate(mesh, point) {
  return mesh.faces.findIndex((face) =>
    face.every(
      (id, i) =>
        orient(
          mesh.vertices[id],
          mesh.vertices[face[(i + 1) % face.length]],
          point,
        ) >= -EPS,
    ),
  );
}

export function searchCorridor(mesh, start, goal) {
  const from = locate(mesh, start),
    to = locate(mesh, goal);
  const centers = mesh.faces.map((face) => center(face, mesh.vertices));
  if (from < 0 || to < 0) return { corridor: [], frames: [], centers };
  const neighbors = mesh.faces.map(() => []);
  for (const edge of edgeIndex(mesh).values()) {
    if (edge.faces.length !== 2 || edge.constrained) continue;
    const [a, b] = edge.faces;
    neighbors[a].push(b);
    neighbors[b].push(a);
  }
  const g = new Map([[from, 0]]),
    parent = new Map(),
    open = new Set([from]),
    closed = new Set();
  const h = (id) => distance(centers[id], centers[to]);
  const frames = [
    {
      open: [from],
      closed: [],
      current: null,
      corridor: [],
      caption: `S 位于 T${from}, G 位于 T${to}. 将 T${from} 加入候选.`,
    },
  ];
  let corridor = [];
  while (open.size) {
    const current = [...open].sort(
      (a, b) => g.get(a) + h(a) - g.get(b) - h(b) || a - b,
    )[0];
    open.delete(current);
    closed.add(current);
    if (current === to) {
      for (let id = to; id !== undefined; id = parent.get(id))
        corridor.push(id);
      corridor.reverse();
      frames.push({
        open: [...open],
        closed: [...closed],
        current,
        corridor: [...corridor],
        caption: `目标多边形被取出. 通道为 ${corridor.map((id) => `T${id}`).join(' → ')}.`,
      });
      break;
    }
    for (const next of neighbors[current]) {
      if (closed.has(next)) continue;
      const cost = g.get(current) + distance(centers[current], centers[next]);
      if (cost >= (g.get(next) ?? Infinity)) continue;
      g.set(next, cost);
      parent.set(next, current);
      open.add(next);
    }
    frames.push({
      open: [...open],
      closed: [...closed],
      current,
      corridor: [],
      caption: `展开 T${current}, 仅通过可通行的共享边添加邻居. 黄色为候选, 蓝色为已展开.`,
    });
  }
  return { corridor, frames, centers };
}

export function corridorPortals(mesh, corridor, start, goal) {
  const result = [{ left: start, right: start }];
  for (let i = 1; i < corridor.length; i++) {
    const previous = mesh.faces[corridor[i - 1]],
      next = mesh.faces[corridor[i]];
    const shared = previous.filter((id) => next.includes(id));
    if (shared.length !== 2 || mesh.constrained.has(edgeKey(...shared)))
      throw new Error('Corridor must cross one unconstrained shared edge');
    const a = mesh.vertices[shared[0]],
      b = mesh.vertices[shared[1]];
    const p = center(previous, mesh.vertices),
      q = center(next, mesh.vertices);
    result.push(
      orient(p, q, a) > orient(p, q, b)
        ? { left: a, right: b }
        : { left: b, right: a },
    );
  }
  result.push({ left: goal, right: goal });
  return result;
}

// A deliberately small restart-style funnel. Positive orient means left.
// A classic deque funnel can avoid restart rescans; no linear-time claim here.
export function stringPull(portals) {
  if (!portals.length) return { path: [], frames: [] };
  let apex = portals[0].left,
    left = apex,
    right = apex;
  let apexIndex = 0,
    leftIndex = 0,
    rightIndex = 0;
  const path = [apex],
    frames = [];
  const emit = (index, caption, checking = null) =>
    frames.push({
      index,
      apex: [...apex],
      left: [...left],
      right: [...right],
      path: path.map((p) => [...p]),
      caption,
      checking,
    });
  const append = (point) => {
    if (!equal(path.at(-1), point)) path.push(point);
  };
  emit(0, '从 S 拉出一根绳子. 尖点 A, 左边界 L, 右边界 R 暂时都在 S.');
  let iterations = 0;
  for (let i = 1; i < portals.length; i++) {
    if (++iterations > portals.length * portals.length * 4)
      throw new Error('Invalid or inconsistently oriented portal sequence');
    const newLeft = portals[i].left,
      newRight = portals[i].right;
    emit(i, `检查门 ${i} 的右端. 看新右边界是否向漏斗内部收紧.`, newRight);
    if (orient(apex, right, newRight) >= -EPS) {
      if (equal(apex, right) || orient(apex, left, newRight) < -EPS) {
        right = newRight;
        rightIndex = i;
        emit(i, `用门 ${i} 的右端更新 R. 仍存在同时穿过已处理门的直线方向.`);
      } else {
        append(left);
        emit(
          i,
          '新右边界越过左边界, 直线方向无法再兼顾前面的门. 把旧 L 确认为拐点.',
        );
        apex = left;
        apexIndex = leftIndex;
        left = apex;
        right = apex;
        leftIndex = apexIndex;
        rightIndex = apexIndex;
        emit(apexIndex, '把尖点移到刚确认的拐点, 从它之后的门重新收紧.');
        i = apexIndex;
        continue;
      }
    }
    emit(i, `检查门 ${i} 的左端. 左侧也要保持同一组门的约束.`, newLeft);
    if (orient(apex, left, newLeft) <= EPS) {
      if (equal(apex, left) || orient(apex, right, newLeft) > EPS) {
        left = newLeft;
        leftIndex = i;
        emit(i, `用门 ${i} 的左端更新 L.`, null);
      } else {
        append(right);
        emit(i, '新左边界越过右边界. 把旧 R 确认为拐点.');
        apex = right;
        apexIndex = rightIndex;
        left = apex;
        right = apex;
        leftIndex = apexIndex;
        rightIndex = apexIndex;
        emit(apexIndex, '尖点移到旧 R, 从它之后的门重新检查.');
        i = apexIndex;
        continue;
      }
    }
  }
  append(portals.at(-1).left);
  emit(
    portals.length - 1,
    `接到 G. 绳子只在必要的边界顶点转弯, 总长度 ${pathLength(path).toFixed(2)}.`,
  );
  return { path, frames };
}
