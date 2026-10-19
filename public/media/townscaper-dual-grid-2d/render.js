import { maskOf, bilinear, tilePolygons } from './grid.js';

const ns = 'http://www.w3.org/2000/svg';
const pointsString = (points) =>
  points.map((p) => p.map((n) => n.toFixed(3)).join(',')).join(' ');
function landPath(quad, mask) {
  return tilePolygons(mask)
    .map(
      (points) =>
        `M${pointsString(points.map(([u, v]) => bilinear(quad, u, v)))}Z`,
    )
    .join('');
}
function landMarkup(quad, mask) {
  return `<path d="${landPath(quad, mask)}" fill="#a1bd91"/>`;
}
export function tileSvg(mask) {
  return `<svg xmlns="${ns}" viewBox="-0.1 -0.1 1.2 1.2" aria-hidden="true"><path d="M0 0H1V1H0Z" fill="#dfe8f4"/>${landMarkup(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    mask,
  )}<path d="M0 0H1V1H0Z" fill="none" stroke="#35445e" stroke-width=".012"/></svg>`;
}
export function meshSvg(
  mesh,
  {
    terrain = false,
    states = [],
    grid = true,
    points = false,
    selected = -1,
    incident = [],
  } = {},
) {
  const size = 460,
    scale = 49;
  const project = ([x, y]) => [230 + x * scale, 230 + y * scale];
  const polygons = mesh.faces
    .map((face) => {
      const quad = face.map((v) => project(mesh.vertices[v]));
      const fill = terrain ? 'none' : face.length === 3 ? '#f1d3a6' : '#aabed5';
      return `<polygon points="${pointsString(quad)}" fill="${fill}"/>`;
    })
    .join('');
  // Paint all land in one SVG path to avoid antialiasing seams between faces.
  const land = terrain
    ? `<path d="${mesh.faces
        .map((face) =>
          landPath(
            face.map((v) => project(mesh.vertices[v])),
            maskOf(face, states),
          ),
        )
        .join('')}" fill="#a1bd91"/>`
    : '';
  const outlines = mesh.faces
    .map((face, id) => {
      const affected = terrain && (incident[selected] || []).includes(id);
      if (!grid && !affected) return '';
      return `<polygon points="${pointsString(face.map((v) => project(mesh.vertices[v])))}" fill="none" stroke="${affected ? '#ae494f' : '#536681'}" stroke-width="${affected ? 2.5 : 0.8}"/>`;
    })
    .join('');
  const dots = points
    ? mesh.vertices
        .map((p, id) => {
          const [x, y] = project(p);
          return `<circle cx="${x}" cy="${y}" r="${id === selected ? 5.5 : 2.8}" fill="${terrain && states[id] ? '#496c3e' : '#f9fbff'}" stroke="${id === selected ? '#ae494f' : '#35445e'}" stroke-width="${id === selected ? 2 : 1}"/>`;
        })
        .join('')
    : '';
  // Transparent hit areas allow direct editing near each vertex.
  const hits = terrain
    ? mesh.vertices
        .map((p, id) => {
          const [x, y] = project(p);
          return `<circle data-vertex="${id}" cx="${x}" cy="${y}" r="9" fill="transparent"/>`;
        })
        .join('')
    : '';
  return `<svg xmlns="${ns}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${terrain ? '可编辑海陆网格, 绿色为陆地, 蓝色为水. 点击顶点附近可翻转海陆状态.' : '网格生成当前阶段, 橙色为三角形, 蓝灰色为四边形.'}">${polygons}${land}${outlines}${dots}${hits}</svg>`;
}
