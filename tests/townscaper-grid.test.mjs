import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTriangles,
  mergeTriangles,
  subdivide,
  relax,
  edgesOf,
  adjacencyOf,
  isConvexMesh,
  maskOf,
  classify,
  rotateMask,
  bilinear,
  tilePolygons,
} from '../public/media/townscaper-dual-grid-2d/grid.js';

function area(mesh) {
  return mesh.faces.reduce(
    (sum, face) =>
      sum +
      face.reduce((s, id, i) => {
        const a = mesh.vertices[id],
          b = mesh.vertices[face[(i + 1) % face.length]];
        return s + (a[0] * b[1] - a[1] * b[0]) / 2;
      }, 0),
    0,
  );
}
function assertDisk(mesh) {
  const edges = [...edgesOf(mesh.faces).values()];
  assert.ok(edges.every((e) => e.faces.length === 1 || e.faces.length === 2));
  assert.equal(mesh.vertices.length - edges.length + mesh.faces.length, 1);
  const { neighbors } = adjacencyOf(mesh),
    visited = new Set([0]),
    queue = [0];
  for (let i = 0; i < queue.length; i++)
    for (const next of neighbors[queue[i]]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  assert.equal(visited.size, mesh.vertices.length);
  assert.ok(isConvexMesh(mesh));
}

test('tutorial lattice, merge and subdivision preserve a connected disk and its area', () => {
  const triangles = makeTriangles(4);
  assert.equal(triangles.vertices.length, 61);
  assert.equal(triangles.faces.length, 96);
  for (const probability of [0, 0.65, 1])
    for (const seed of [1, 42, 999999]) {
      const mixed = mergeTriangles(triangles, probability, seed),
        quads = subdivide(mixed);
      assertDisk(mixed);
      assertDisk(quads);
      const mergedCount = mixed.faces.filter((f) => f.length === 4).length;
      const remaining = mixed.faces.filter((f) => f.length === 3).length;
      assert.equal(2 * mergedCount + remaining, triangles.faces.length);
      assert.equal(quads.faces.length, 4 * mergedCount + 3 * remaining);
      assert.ok(quads.faces.every((f) => f.length === 4));
      assert.ok(Math.abs(area(quads) - area(triangles)) < 1e-9);
      assert.deepEqual(mixed, mergeTriangles(triangles, probability, seed));
    }
  assert.notDeepEqual(
    mergeTriangles(triangles, 0.65, 1).faces,
    mergeTriangles(triangles, 0.65, 42).faces,
  );
});

test('relaxation keeps boundary IDs, winding and area while moving interior vertices', () => {
  for (const seed of [1, 42, 789]) {
    const input = subdivide(mergeTriangles(makeTriangles(4), 0.65, seed));
    const original = structuredClone(input),
      output = relax(input, 30, 0.35);
    assert.deepEqual(input, original);
    assert.deepEqual(output.faces, input.faces);
    const { boundary } = adjacencyOf(input);
    for (const id of boundary)
      assert.deepEqual(output.vertices[id], input.vertices[id]);
    assert.ok(
      output.vertices.some(
        (p, i) =>
          !boundary.has(i) &&
          Math.hypot(p[0] - input.vertices[i][0], p[1] - input.vertices[i][1]) >
            0.01,
      ),
    );
    assert.ok(Math.abs(area(input) - area(output)) < 1e-9);
    assertDisk(output);
  }
});

test('all 16 masks use consistent ring bits, rotations, corner occupancy and shared edge midpoints', () => {
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const counts = new Map();
  for (let mask = 0; mask < 16; mask++) {
    const type = classify(mask);
    counts.set(type.mask, (counts.get(type.mask) || 0) + 1);
    let rotated = type.mask;
    for (let i = 0; i < type.turns; i++) rotated = rotateMask(rotated);
    assert.equal(rotated, mask);
    assert.equal(
      maskOf(
        [0, 1, 2, 3],
        corners.map((_, i) => (mask >> i) & 1),
      ),
      mask,
    );
    const polygons = tilePolygons(mask);
    corners.forEach((corner, i) => {
      const includesCorner = polygons.some((polygon) =>
        polygon.some(
          (p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 1e-10,
        ),
      );
      assert.equal(includesCorner, !!((mask >> i) & 1));
      const next = (i + 1) % 4;
      if (((mask >> i) & 1) !== ((mask >> next) & 1)) {
        const midpoint = corner.map((v, axis) => (v + corners[next][axis]) / 2);
        assert.ok(
          polygons.some((polygon) =>
            polygon.some(
              (p) => Math.hypot(p[0] - midpoint[0], p[1] - midpoint[1]) < 1e-10,
            ),
          ),
        );
      }
    });
  }
  assert.deepEqual(
    [...counts.entries()].sort((a, b) => a[0] - b[0]),
    [
      [0, 1],
      [1, 4],
      [3, 4],
      [5, 2],
      [7, 4],
      [15, 1],
    ],
  );
});

test('bilinear mapping matches all corners and a reversed shared edge', () => {
  const left = [
    [0, 0],
    [2, 0],
    [2.5, 2],
    [-1, 3],
  ];
  const right = [
    [2, 0],
    [5, -1],
    [4, 3],
    [2.5, 2],
  ];
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].forEach(([u, v], i) => assert.deepEqual(bilinear(left, u, v), left[i]));
  for (const t of [0, 0.25, 0.5, 0.75, 1])
    assert.deepEqual(bilinear(left, 1, t), bilinear(right, 0, t));
});
