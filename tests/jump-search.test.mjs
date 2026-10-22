import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createJumpSearch,
  makeJumpMap,
} from '../public/media/a-star-pathfinding/jump.js';

function finish(state) {
  let count = 0;
  while (!state.done && count++ <= state.map.width * state.map.height)
    state.step();
  assert.ok(state.done);
  return state;
}

// Independent Dijkstra oracle: generate edges by pairwise coordinate difference.
function optimalCost(map) {
  const costs = Array(map.width * map.height).fill(Infinity);
  const used = new Set();
  costs[map.start] = 0;
  while (used.size < costs.length) {
    let current = -1;
    for (let id = 0; id < costs.length; id++) {
      if (!used.has(id) && (current < 0 || costs[id] < costs[current]))
        current = id;
    }
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === map.goal) return costs[current];
    used.add(current);
    for (let id = 0; id < costs.length; id++) {
      if (used.has(id) || map.walls.has(id)) continue;
      const dx = Math.abs((id % map.width) - (current % map.width));
      const dy = Math.abs(
        Math.floor(id / map.width) - Math.floor(current / map.width),
      );
      if (Math.max(dx, dy) !== 1) continue;
      costs[id] = Math.min(
        costs[id],
        costs[current] + (dx && dy ? Math.SQRT2 : 1),
      );
    }
  }
  return Infinity;
}

function assertSolution(state, expected) {
  assert.equal(state.found, Number.isFinite(expected));
  if (!state.found) {
    assert.deepEqual(state.path, []);
    return;
  }
  assert.ok(Math.abs(state.g.get(state.map.goal) - expected) < 1e-8);
  assert.equal(state.path[0], state.map.start);
  assert.equal(state.path.at(-1), state.map.goal);
  let cost = 0;
  for (let i = 0; i < state.path.length; i++) {
    const id = state.path[i];
    assert.ok(!state.map.walls.has(id));
    if (!i) continue;
    const previous = state.path[i - 1];
    const dx = Math.abs((id % state.map.width) - (previous % state.map.width));
    const dy = Math.abs(
      Math.floor(id / state.map.width) - Math.floor(previous / state.map.width),
    );
    assert.equal(Math.max(dx, dy), 1);
    cost += dx && dy ? Math.SQRT2 : 1;
  }
  assert.ok(Math.abs(cost - expected) < 1e-8);
}

test('empty-map jump stops at the projected goal row and preserves segment costs', () => {
  const state = createJumpSearch(makeJumpMap());
  state.step();
  assert.ok(state.open.has(10)); // (3,1), found through a horizontal goal scan.
  assert.ok(state.scanned.has(22)); // (1,3), scanned but not queued.
  assert.ok(!state.g.has(22));
  finish(state);
  assert.deepEqual(state.macroPath, [28, 10, 13]);
  assertSolution(state, 3 * Math.SQRT2 + 3);
  assert.ok(state.scans > state.closed.size);
});

test('an obstacle breaks the alternative route and creates a forced-neighbor stop', () => {
  const map = { width: 3, height: 3, start: 3, goal: 2, walls: new Set([1]) };
  const state = createJumpSearch(map);
  state.step();
  assert.ok(
    state.trace.some(
      (line) => line.includes('(1,1)') && line.includes('强制邻居'),
    ),
  );
  assertSolution(finish(state), 1 + Math.SQRT2);
});

test('JPS and A* match Dijkstra for all 3x3 wall patterns and all open endpoint pairs', () => {
  for (let mask = 0; mask < 512; mask++) {
    const walls = new Set();
    for (let id = 0; id < 9; id++) if (mask & (1 << id)) walls.add(id);
    for (let start = 0; start < 9; start++) {
      if (walls.has(start)) continue;
      for (let goal = 0; goal < 9; goal++) {
        if (walls.has(goal)) continue;
        const map = { width: 3, height: 3, start, goal, walls };
        const expected = optimalCost(map);
        for (const mode of ['jps', 'astar'])
          assertSolution(finish(createJumpSearch(map, mode)), expected);
      }
    }
  }
});

test('larger deterministic maps retain optimal costs and complete legal reconstructed routes', () => {
  let seed = 51;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let sample = 0; sample < 300; sample++) {
    const width = 4 + (sample % 5),
      height = 4 + (sample % 4);
    const size = width * height;
    const start = Math.floor(random() * size),
      goal = Math.floor(random() * size);
    const walls = new Set();
    for (let id = 0; id < size; id++)
      if (id !== start && id !== goal && random() < 0.3) walls.add(id);
    const map = { width, height, start, goal, walls };
    const expected = optimalCost(map);
    for (const mode of ['jps', 'astar'])
      assertSolution(finish(createJumpSearch(map, mode)), expected);
  }
  for (const scene of ['empty', 'wall', 'blocked']) {
    const map = makeJumpMap(scene);
    assertSolution(finish(createJumpSearch(map)), optimalCost(map));
  }
});
