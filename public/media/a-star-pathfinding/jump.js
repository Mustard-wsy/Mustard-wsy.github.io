// Eight-neighbor, uniform-cost grid with target-only diagonal legality.
// The article explicitly permits corner cutting. These pruning rules depend on it.
const directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

export function makeJumpMap(scene = 'empty') {
  return {
    width: 7,
    height: 5,
    start: 28,
    goal: 13,
    walls: new Set(
      scene === 'blocked'
        ? [3, 10, 17, 24, 31]
        : scene === 'wall'
          ? [10, 17, 24]
          : [],
    ),
  };
}

export function createJumpSearch(map, mode = 'jps') {
  const xy = (id) => [id % map.width, Math.floor(id / map.width)];
  const idOf = (x, y) => y * map.width + x;
  const walk = (x, y) =>
    x >= 0 &&
    x < map.width &&
    y >= 0 &&
    y < map.height &&
    !map.walls.has(idOf(x, y));
  const distance = (a, b) => {
    const [ax, ay] = xy(a),
      [bx, by] = xy(b);
    const dx = Math.abs(ax - bx),
      dy = Math.abs(ay - by);
    return Math.min(dx, dy) * Math.SQRT2 + Math.abs(dx - dy);
  };
  const h = (id) => distance(id, map.goal);
  const coord = (id) => `(${xy(id).join(',')})`;
  const g = new Map([[map.start, 0]]),
    parent = new Map();
  const open = new Map([[map.start, 0]]),
    closed = new Set();
  const scanned = new Set();
  let order = 1;
  const state = {
    map,
    mode,
    g,
    parent,
    open,
    closed,
    scanned,
    h,
    scans: 0,
    current: null,
    done: false,
    found: false,
    path: [],
    macroPath: [],
    trace: [],
    candidates: () =>
      [...open.keys()].sort(
        (a, b) =>
          g.get(a) + h(a) - g.get(b) - h(b) ||
          h(a) - h(b) ||
          open.get(a) - open.get(b),
      ),
    step() {
      if (state.done) return state;
      state.trace = [];
      const current = state.candidates()[0];
      if (current === undefined) {
        state.done = true;
        return state;
      }
      open.delete(current);
      closed.add(current);
      state.current = current;
      if (current === map.goal) {
        state.done = state.found = true;
        for (let id = current; id !== undefined; id = parent.get(id))
          state.macroPath.push(id);
        state.macroPath.reverse();
        state.path.push(map.start);
        for (let i = 1; i < state.macroPath.length; i++) {
          const [sx, sy] = xy(state.macroPath[i - 1]);
          const [ex, ey] = xy(state.macroPath[i]);
          const dx = Math.sign(ex - sx),
            dy = Math.sign(ey - sy);
          for (
            let k = 1;
            k <= Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
            k++
          )
            state.path.push(idOf(sx + k * dx, sy + k * dy));
        }
        return state;
      }
      const [x, y] = xy(current);
      const allowed = mode === 'jps' ? prunedDirections(current) : directions;
      for (const [dx, dy] of allowed) {
        const nx = x + dx,
          ny = y + dy;
        if (!walk(nx, ny)) continue;
        const hit =
          mode === 'jps' ? jump(nx, ny, dx, dy) : { id: idOf(nx, ny) };
        if (!hit) continue;
        if (mode === 'jps')
          state.trace.push(
            `从 ${coord(current)} 沿 (${dx},${dy}) 扫描, 在 ${coord(hit.id)} 停下: ${hit.reason}.`,
          );
        const next = hit.id;
        if (closed.has(next)) continue;
        const cost = g.get(current) + distance(current, next);
        if (cost >= (g.get(next) ?? Infinity) - 1e-9) continue;
        g.set(next, cost);
        parent.set(next, current);
        if (!open.has(next)) open.set(next, order++);
      }
      if (open.size === 0) state.done = true;
      return state;
    },
  };

  function forced(x, y, dx, dy) {
    if (dx && dy)
      return (
        (!walk(x - dx, y) && walk(x - dx, y + dy)) ||
        (!walk(x, y - dy) && walk(x + dx, y - dy))
      );
    if (dx)
      return (
        (!walk(x, y - 1) && walk(x + dx, y - 1)) ||
        (!walk(x, y + 1) && walk(x + dx, y + 1))
      );
    return (
      (!walk(x - 1, y) && walk(x - 1, y + dy)) ||
      (!walk(x + 1, y) && walk(x + 1, y + dy))
    );
  }

  function jump(x, y, dx, dy) {
    while (walk(x, y)) {
      const id = idOf(x, y);
      state.scans++;
      scanned.add(id);
      if (id === map.goal) return { id, reason: '到达终点' };
      if (forced(x, y, dx, dy)) return { id, reason: '出现强制邻居' };
      if (dx && dy) {
        const horizontal = jump(x + dx, y, dx, 0);
        if (horizontal)
          return { id, reason: `水平分量找到跳点 ${coord(horizontal.id)}` };
        const vertical = jump(x, y + dy, 0, dy);
        if (vertical)
          return { id, reason: `竖直分量找到跳点 ${coord(vertical.id)}` };
      }
      x += dx;
      y += dy;
    }
    return null;
  }

  function prunedDirections(current) {
    const previous = parent.get(current);
    if (previous === undefined) return directions;
    const [x, y] = xy(current),
      [px, py] = xy(previous);
    const dx = Math.sign(x - px),
      dy = Math.sign(y - py);
    const result = [];
    if (dx && dy) {
      result.push([dx, dy], [dx, 0], [0, dy]);
      if (!walk(x - dx, y)) result.push([-dx, dy]);
      if (!walk(x, y - dy)) result.push([dx, -dy]);
    } else if (dx) {
      result.push([dx, 0]);
      if (!walk(x, y - 1)) result.push([dx, -1]);
      if (!walk(x, y + 1)) result.push([dx, 1]);
    } else {
      result.push([0, dy]);
      if (!walk(x - 1, y)) result.push([-1, dy]);
      if (!walk(x + 1, y)) result.push([1, dy]);
    }
    return result;
  }

  if (!walk(...xy(map.start)) || !walk(...xy(map.goal))) {
    state.done = true;
    open.clear();
  }
  return state;
}
