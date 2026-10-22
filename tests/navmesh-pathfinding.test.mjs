import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRoom,
  orient,
  circumcircle,
  distance,
  edgeIndex,
  locate,
  searchCorridor,
  corridorPortals,
  stringPull,
  pathLength,
} from '../public/media/navmesh-pathfinding/geometry.js';

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function inside(mesh, corridor, p) {
  return corridor.some((id) => {
    const triangle = mesh.faces[id].map((index) => mesh.vertices[index]);
    return triangle.every(
      (a, i) => cross(sub(triangle[(i + 1) % 3], a), sub(p, a)) >= -1e-8,
    );
  });
}

// Partition a segment at every triangle-edge crossing, then check each open
// interval. This oracle uses visibility, not funnel support-point updates.
function visible(mesh, corridor, a, b) {
  const d = sub(b, a),
    length2 = d[0] ** 2 + d[1] ** 2;
  if (length2 < 1e-12) return inside(mesh, corridor, a);
  const times = [0, 1];
  for (const face of corridor.map((id) => mesh.faces[id]))
    for (let i = 0; i < 3; i++) {
      const u = mesh.vertices[face[i]],
        v = mesh.vertices[face[(i + 1) % 3]],
        e = sub(v, u),
        ua = sub(u, a),
        denominator = cross(d, e);
      if (Math.abs(denominator) > 1e-10) {
        const t = cross(ua, e) / denominator,
          s = cross(ua, d) / denominator;
        if (t > 0 && t < 1 && s >= -1e-8 && s <= 1 + 1e-8) times.push(t);
      } else if (Math.abs(cross(ua, d)) < 1e-8) {
        for (const p of [u, v]) {
          const ap = sub(p, a),
            t = (ap[0] * d[0] + ap[1] * d[1]) / length2;
          if (t > 0 && t < 1) times.push(t);
        }
      }
    }
  times.sort((x, y) => x - y);
  return times.slice(1).every((t, i) => {
    const middle = (t + times[i]) / 2;
    return inside(mesh, corridor, [a[0] + d[0] * middle, a[1] + d[1] * middle]);
  });
}

function visibilityCost(mesh, corridor, start, goal) {
  const vertices = [
    start,
    goal,
    ...[...new Set(corridor.flatMap((id) => mesh.faces[id]))].map(
      (id) => mesh.vertices[id],
    ),
  ];
  const costs = vertices.map(() => Infinity),
    used = new Set();
  costs[0] = 0;
  while (used.size < vertices.length) {
    const current = costs
      .map((cost, id) => ({ cost, id }))
      .filter((row) => !used.has(row.id))
      .sort((a, b) => a.cost - b.cost)[0];
    if (!current || !Number.isFinite(current.cost)) return Infinity;
    if (current.id === 1) return current.cost;
    used.add(current.id);
    vertices.forEach((p, id) => {
      if (!used.has(id) && visible(mesh, corridor, vertices[current.id], p))
        costs[id] = Math.min(
          costs[id],
          current.cost + distance(vertices[current.id], p),
        );
    });
  }
  return Infinity;
}

test('fixed room triangulations cover the free domain and preserve all boundary constraints', () => {
  for (const radius of [0, 0.25, 0.5, 0.9]) {
    const mesh = makeRoom(radius);
    const area = mesh.faces.reduce((sum, face) => {
      const triangle = face.map((id) => mesh.vertices[id]),
        twice = orient(...triangle);
      assert.ok(twice > 0);
      return sum + twice / 2;
    }, 0);
    const expected =
      (12 - 2 * radius) * (8 - 2 * radius) -
      (2.4 + 2 * radius) * (3 + 2 * radius);
    assert.ok(Math.abs(area - expected) < 1e-8);
    for (const edge of edgeIndex(mesh).values())
      assert.equal(edge.faces.length, edge.constrained ? 1 : 2);
    assert.equal(locate(mesh, [6, 4]), -1);
  }
});

test('the illustrated diagonal flip restores the empty-circle condition', () => {
  const [a, b, c, d] = [
    [2, 2],
    [8, 2],
    [7, 6],
    [3, 4.5],
  ];
  const before = circumcircle(a, b, c);
  assert.ok(distance(before.center, d) < before.radius);
  for (const [triangle, opposite] of [
    [[a, b, d], c],
    [[b, c, d], a],
  ]) {
    const circle = circumcircle(...triangle);
    assert.ok(distance(circle.center, opposite) > circle.radius);
  }
  assert.equal(circumcircle([0, 0], [1, 0], [2, 0]), null);
});

test('the room query yields shared-edge portals and the two expected lower obstacle corners', () => {
  const mesh = makeRoom(),
    start = [1.5, 3.5],
    goal = [10.5, 3.5];
  const { corridor, centers } = searchCorridor(mesh, start, goal);
  assert.deepEqual(corridor, [6, 7, 0, 1, 2]);
  const portals = corridorPortals(mesh, corridor, start, goal);
  const result = stringPull(portals);
  assert.deepEqual(result.path, [start, [4.3, 2], [7.7, 2], goal]);
  assert.ok(result.frames.some((frame) => frame.caption.includes('拐点')));
  assert.ok(
    pathLength(result.path) <
      pathLength([start, ...corridor.map((id) => centers[id]), goal]),
  );
  for (let i = 1; i < portals.length - 1; i++) {
    assert.ok(
      orient(centers[corridor[i - 1]], centers[corridor[i]], portals[i].left) >
        orient(
          centers[corridor[i - 1]],
          centers[corridor[i]],
          portals[i].right,
        ),
    );
  }
});

test('funnel paths stay inside each chosen corridor and match an independent visibility graph', () => {
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (const radius of [0, 0.25, 0.5, 0.9])
    for (let sample = 0; sample < 30; sample++) {
      const mesh = makeRoom(radius),
        a = [1.3, 1.2 + random() * 5.6],
        b = [10.7, 1.2 + random() * 5.6];
      const { corridor } = searchCorridor(mesh, a, b);
      for (const [start, goal, route] of [
        [a, b, corridor],
        [b, a, [...corridor].reverse()],
      ]) {
        const result = stringPull(corridorPortals(mesh, route, start, goal));
        result.path
          .slice(1)
          .forEach((p, i) =>
            assert.ok(visible(mesh, route, result.path[i], p)),
          );
        assert.ok(
          Math.abs(
            pathLength(result.path) - visibilityCost(mesh, route, start, goal),
          ) < 1e-7,
        );
      }
    }
});

test('same-face, repeated portal endpoints, straight corridors and invalid point locations are handled', () => {
  const a = [0, 0],
    b = [3, 0];
  const result = stringPull([
    { left: a, right: a },
    { left: [1, 1], right: [1, -1] },
    { left: [1, 1], right: [1, -1] },
    { left: [2, 1], right: [2, -1] },
    { left: b, right: b },
  ]);
  assert.deepEqual(result.path, [a, b]);
  assert.deepEqual(
    stringPull([
      { left: a, right: a },
      { left: a, right: a },
    ]).path,
    [a],
  );
  const mesh = makeRoom(),
    start = [1, 3],
    goal = [1, 4],
    route = searchCorridor(mesh, start, goal).corridor;
  assert.deepEqual(stringPull(corridorPortals(mesh, route, start, goal)).path, [
    start,
    goal,
  ]);
  assert.deepEqual(searchCorridor(mesh, [-1, 0], goal).corridor, []);
});
