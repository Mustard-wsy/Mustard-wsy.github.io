import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSearch,
  makeMap,
} from '../public/media/a-star-pathfinding/search.js';

function finish(state) {
  let steps = 0;
  while (!state.done && steps++ < 100) state.step();
  assert.ok(state.done);
  return state;
}

test('tutorial decisions and six-step route match the written walkthrough', () => {
  const state = createSearch(makeMap());
  const expected = [5, 6, 11, 1, 2, 3, 4, 9];
  for (const id of expected) {
    state.step();
    assert.equal(state.current, id);
  }
  assert.equal(state.found, true);
  assert.equal(state.g.get(9), 6);
  assert.deepEqual(state.path, [5, 6, 1, 2, 3, 4, 9]);
});

test('A* and Dijkstra agree with an independent BFS across every wall pattern', () => {
  // Exhaust all wall subsets in a smaller map, checking both distance and legal edges.
  for (let mask = 0; mask < 128; mask++) {
    const walls = new Set();
    for (let i = 0; i < 7; i++) if (mask & (1 << i)) walls.add(i + 1);
    const map = { width: 3, height: 3, start: 0, goal: 8, walls };
    const distances = new Map([[0, 0]]);
    const queue = [0];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      for (let next = 0; next < 9; next++) {
        const adjacent =
          Math.abs((id % 3) - (next % 3)) +
            Math.abs(Math.floor(id / 3) - Math.floor(next / 3)) ===
          1;
        if (!adjacent || walls.has(next) || distances.has(next)) continue;
        distances.set(next, distances.get(id) + 1);
        queue.push(next);
      }
    }
    for (const mode of ['astar', 'dijkstra']) {
      const state = finish(createSearch(map, mode));
      assert.equal(state.found, distances.has(8));
      if (!state.found) {
        assert.deepEqual(state.path, []);
        continue;
      }
      assert.equal(state.path.length - 1, distances.get(8));
      state.path.forEach((id, index) => {
        assert.ok(!walls.has(id));
        if (index) {
          const previous = state.path[index - 1];
          assert.equal(
            Math.abs((id % 3) - (previous % 3)) +
              Math.abs(Math.floor(id / 3) - Math.floor(previous / 3)),
            1,
          );
        }
      });
    }
  }
});

test('all modes terminate for blocked exits and start equal to goal', () => {
  for (const mode of ['astar', 'dijkstra', 'greedy']) {
    const blocked = finish(createSearch(makeMap(true), mode));
    assert.equal(blocked.found, false);
    assert.equal(blocked.open.size, 0);
    const same = finish(
      createSearch(
        { width: 1, height: 1, start: 0, goal: 0, walls: new Set() },
        mode,
      ),
    );
    assert.deepEqual(same.path, [0]);
    assert.equal(same.g.get(0), 0);
  }
});
