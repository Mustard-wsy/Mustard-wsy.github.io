// Standalone teaching implementation. No DOM or external dependencies.
// Screen coordinates: +x right, +y down; face rings have positive signed area.
export function randomFromSeed(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
export const mean = (points) =>
  points.reduce(
    (s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length],
    [0, 0],
  );

export function edgesOf(faces) {
  const edges = new Map();
  faces.forEach((face, faceId) => {
    face.forEach((a, i) => {
      const b = face[(i + 1) % face.length];
      const key = edgeKey(a, b);
      if (!edges.has(key)) edges.set(key, { a, b, faces: [] });
      edges.get(key).faces.push(faceId);
    });
  });
  return edges;
}

export function makeTriangles(radius = 4) {
  const vertices = [],
    faces = [],
    ids = new Map();
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius)
        continue;
      ids.set(`${q},${r}`, vertices.length);
      vertices.push([q + r / 2, (r * Math.sqrt(3)) / 2]);
    }
  }
  for (let r = -radius; r < radius; r++) {
    for (let q = -radius; q < radius; q++) {
      const a = ids.get(`${q},${r}`),
        b = ids.get(`${q + 1},${r}`);
      const c = ids.get(`${q},${r + 1}`),
        d = ids.get(`${q + 1},${r + 1}`);
      for (const face of [
        [a, b, c],
        [b, d, c],
      ]) {
        if (face.every((id) => id !== undefined)) faces.push(face);
      }
    }
  }
  return { vertices, faces };
}

export function mergeTriangles(mesh, probability = 0.65, seed = 42) {
  const random = randomFromSeed(seed);
  const candidates = [...edgesOf(mesh.faces).values()].filter(
    (e) => e.faces.length === 2,
  );
  // Shuffle first: a row-by-row scan would favor one lattice direction.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const used = new Set(),
    faces = [];
  for (const edge of candidates) {
    const [a, b] = edge.faces;
    if (used.has(a) || used.has(b) || random() >= probability) continue;
    const ring = [...new Set([...mesh.faces[a], ...mesh.faces[b]])];
    const center = mean(ring.map((id) => mesh.vertices[id]));
    ring.sort(
      (i, j) =>
        Math.atan2(
          mesh.vertices[i][1] - center[1],
          mesh.vertices[i][0] - center[0],
        ) -
        Math.atan2(
          mesh.vertices[j][1] - center[1],
          mesh.vertices[j][0] - center[0],
        ),
    );
    faces.push(ring);
    used.add(a);
    used.add(b);
  }
  mesh.faces.forEach((face, id) => {
    if (!used.has(id)) faces.push([...face]);
  });
  return { vertices: mesh.vertices.map((p) => [...p]), faces };
}

export function subdivide(mesh) {
  const vertices = mesh.vertices.map((p) => [...p]),
    faces = [],
    midpoints = new Map();
  function midpoint(a, b) {
    const key = edgeKey(a, b);
    if (!midpoints.has(key)) {
      midpoints.set(key, vertices.length);
      vertices.push(mean([vertices[a], vertices[b]]));
    }
    return midpoints.get(key);
  }
  for (const face of mesh.faces) {
    const center = vertices.length;
    vertices.push(mean(face.map((id) => vertices[id])));
    for (let i = 0; i < face.length; i++) {
      const current = face[i],
        next = face[(i + 1) % face.length];
      const previous = face[(i + face.length - 1) % face.length];
      faces.push([
        current,
        midpoint(current, next),
        center,
        midpoint(previous, current),
      ]);
    }
  }
  return { vertices, faces };
}

export function adjacencyOf(mesh) {
  const neighbors = mesh.vertices.map(() => new Set());
  const incident = mesh.vertices.map(() => []),
    boundary = new Set();
  mesh.faces.forEach((face, id) => face.forEach((v) => incident[v].push(id)));
  for (const { a, b, faces } of edgesOf(mesh.faces).values()) {
    neighbors[a].add(b);
    neighbors[b].add(a);
    if (faces.length === 1) {
      boundary.add(a);
      boundary.add(b);
    }
  }
  return { neighbors, incident, boundary };
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
}

export function isConvexMesh(mesh) {
  return mesh.faces.every((face) =>
    face.every(
      (id, i) =>
        cross(
          mesh.vertices[id],
          mesh.vertices[face[(i + 1) % face.length]],
          mesh.vertices[face[(i + 2) % face.length]],
        ) > 1e-9,
    ),
  );
}

export function relax(mesh, iterations = 20, alpha = 0.35) {
  let vertices = mesh.vertices.map((p) => [...p]);
  const { neighbors, boundary } = adjacencyOf(mesh);
  for (let step = 0; step < iterations; step++) {
    const targets = vertices.map((p, id) =>
      boundary.has(id) || !neighbors[id].size
        ? p
        : mean([...neighbors[id]].map((j) => vertices[j])),
    );
    // Backtrack the whole synchronous step if any face loses convexity.
    let amount = Math.max(0, Math.min(1, alpha));
    for (let retry = 0; retry < 12; retry++) {
      const next = vertices.map((p, id) =>
        p.map((v, axis) => v + amount * (targets[id][axis] - v)),
      );
      if (isConvexMesh({ vertices: next, faces: mesh.faces })) {
        vertices = next;
        break;
      }
      amount *= 0.5;
    }
  }
  return { vertices, faces: mesh.faces.map((f) => [...f]) };
}

// Bits follow the face ring: p0=(0,0), p1=(1,0), p2=(1,1), p3=(0,1).
export function maskOf(face, states) {
  return face.reduce((mask, id, i) => mask | ((states[id] ? 1 : 0) << i), 0);
}

export function rotateMask(mask) {
  return ((mask << 1) & 15) | (mask >> 3);
}

export const tileTypes = [
  { mask: 0, name: '全水' },
  { mask: 1, name: '单角' },
  { mask: 3, name: '相邻双角' },
  { mask: 5, name: '对角' },
  { mask: 7, name: '缺一角' },
  { mask: 15, name: '全陆' },
];

export function classify(mask) {
  for (const type of tileTypes) {
    let rotated = type.mask;
    for (let turns = 0; turns < 4; turns++) {
      if (rotated === mask) return { ...type, turns };
      rotated = rotateMask(rotated);
    }
  }
  throw new RangeError('mask must be an integer from 0 to 15');
}

export function bilinear(quad, u, v) {
  const weights = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
  return [0, 1].map((axis) =>
    quad.reduce((sum, p, i) => sum + weights[i] * p[axis], 0),
  );
}

// Curved teaching tiles in unit-square coordinates. Replace with authored art in a game.
const corner = [
  ['M', 0, 0],
  ['L', 0.5, 0],
  ['Q', 0.5, 0.5, 0, 0.5],
];
const canonicalPaths = {
  0: [],
  1: [corner],
  3: [
    [
      ['M', 0, 0],
      ['L', 1, 0],
      ['L', 1, 0.5],
      ['L', 0, 0.5],
    ],
  ],
  5: [
    corner,
    [
      ['M', 1, 1],
      ['L', 0.5, 1],
      ['Q', 0.5, 0.5, 1, 0.5],
    ],
  ],
  7: [
    [
      ['M', 0, 0],
      ['L', 1, 0],
      ['L', 1, 1],
      ['L', 0.5, 1],
      ['Q', 0.5, 0.5, 0, 0.5],
    ],
  ],
  15: [
    [
      ['M', 0, 0],
      ['L', 1, 0],
      ['L', 1, 1],
      ['L', 0, 1],
    ],
  ],
};

export function tilePolygons(mask, samples = 10) {
  const type = classify(mask);
  return canonicalPaths[type.mask].map((commands) => {
    const points = [];
    let previous;
    for (const [op, x, y, endX, endY] of commands) {
      if (op === 'Q') {
        const [sx, sy] = previous;
        for (let i = 1; i <= samples; i++) {
          const t = i / samples,
            a = 1 - t;
          points.push([
            a * a * sx + 2 * a * t * x + t * t * endX,
            a * a * sy + 2 * a * t * y + t * t * endY,
          ]);
        }
        previous = [endX, endY];
      } else {
        points.push([x, y]);
        previous = [x, y];
      }
    }
    return points.map((point) => {
      let [u, v] = point;
      for (let i = 0; i < type.turns; i++) [u, v] = [1 - v, u];
      return [u, v];
    });
  });
}

export function islandStates(mesh) {
  return mesh.vertices.map(([x, y]) => {
    const angle = Math.atan2(y, x);
    const radius =
      2.35 + 0.28 * Math.sin(3 * angle) + 0.18 * Math.cos(5 * angle);
    return Math.hypot(x, y) < radius ? 1 : 0;
  });
}
