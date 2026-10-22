// Four-neighbor teaching maps. Costs are charged on entering the destination tile.
export function makeMap(scene = 'wall') {
  const blocked = scene === true || scene === 'blocked';
  return {
    width: 5,
    height: 5,
    start: 5,
    goal: 9,
    walls: new Set(
      blocked ? [2, 7, 12, 17, 22] : scene === 'mud' ? [] : [7, 12, 17],
    ),
    costs: new Map(
      scene === 'mud'
        ? [
            [6, 5],
            [7, 5],
            [8, 5],
          ]
        : [],
    ),
  };
}

export function createSearch(map, mode = 'astar') {
  const h = (id) =>
    Math.abs((id % map.width) - (map.goal % map.width)) +
    Math.abs(Math.floor(id / map.width) - Math.floor(map.goal / map.width));
  const g = new Map([[map.start, 0]]);
  const depth = new Map([[map.start, 0]]);
  const parent = new Map();
  const open = new Map([[map.start, 0]]);
  const closed = new Set();
  let order = 1;
  const state = {
    map,
    mode,
    g,
    parent,
    open,
    closed,
    current: null,
    path: [],
    done: false,
    found: false,
    h,
    score: (id) =>
      mode === 'bfs'
        ? depth.get(id)
        : mode === 'greedy'
          ? h(id)
          : g.get(id) + (mode === 'astar' ? h(id) : 0),
    candidates: () =>
      [...open.keys()].sort(
        (a, b) =>
          state.score(a) - state.score(b) ||
          (mode === 'bfs' ? 0 : h(a) - h(b)) ||
          open.get(a) - open.get(b),
      ),
    step() {
      if (state.done) return state;
      const current = state.candidates()[0];
      if (current === undefined) {
        state.done = true;
        state.current = null;
        return state;
      }
      open.delete(current);
      closed.add(current);
      state.current = current;
      if (current === map.goal) {
        state.done = state.found = true;
        for (let id = current; id !== undefined; id = parent.get(id))
          state.path.push(id);
        state.path.reverse();
        return state;
      }
      const x = current % map.width;
      const y = Math.floor(current / map.width);
      for (const [nx, ny] of [
        [x + 1, y],
        [x, y + 1],
        [x - 1, y],
        [x, y - 1],
      ]) {
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        const next = ny * map.width + nx;
        if (map.walls.has(next) || closed.has(next)) continue;
        if (mode === 'bfs' && g.has(next)) continue;
        const cost = g.get(current) + (map.costs?.get(next) ?? 1);
        if (cost >= (g.get(next) ?? Infinity)) continue;
        g.set(next, cost);
        depth.set(next, depth.get(current) + 1);
        parent.set(next, current);
        if (!open.has(next)) open.set(next, order++);
      }
      if (open.size === 0) state.done = true;
      return state;
    },
  };
  return state;
}
