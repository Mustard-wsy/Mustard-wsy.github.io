import {
  makeTriangles,
  mergeTriangles,
  subdivide,
  relax,
  classify,
  islandStates,
  adjacencyOf,
} from './grid.js';
import { tileSvg, meshSvg } from './render.js';

function initMask(root) {
  let mask = 1;
  const visual = root.querySelector('[data-mask-visual]'),
    status = root.querySelector('output');
  const gallery = root.querySelector('[data-gallery]');
  gallery.innerHTML = Array.from(
    { length: 16 },
    (_, i) =>
      `<button type="button" data-mask="${i}" aria-label="查看组合 ${i.toString(2).padStart(4, '0')}" aria-pressed="false">${tileSvg(i)}${i.toString(2).padStart(4, '0')}</button>`,
  ).join('');
  function render() {
    const type = classify(mask);
    visual.innerHTML = tileSvg(mask);
    status.textContent = `掩码 ${mask.toString(2).padStart(4, '0')}(${mask}) · ${type.name} · 基础素材顺时针旋转 ${type.turns * 90}°`;
    root.querySelectorAll('[data-corner]').forEach((button) => {
      const value = (mask >> Number(button.dataset.corner)) & 1;
      button.textContent = String(value);
      button.setAttribute('aria-pressed', String(!!value));
    });
    gallery
      .querySelectorAll('button')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(Number(button.dataset.mask) === mask),
        ),
      );
  }
  root.addEventListener('click', (event) => {
    const corner = event.target.closest('[data-corner]'),
      item = event.target.closest('[data-mask]');
    if (corner) mask ^= 1 << Number(corner.dataset.corner);
    else if (item) mask = Number(item.dataset.mask);
    else return;
    render();
  });
  root.querySelectorAll('[data-enhanced]').forEach((el) => {
    el.hidden = false;
  });
  render();
}

function initMeshes(geometry, terrain) {
  const get = (root, selector) => root.querySelector(selector);
  const stageInput = get(geometry, '[data-stage]'),
    relaxInput = get(geometry, '[data-relax]');
  const mergeInput = get(geometry, '[data-merge]'),
    seedInput = get(geometry, '[data-seed]');
  let triangles, merged, divided, finalMesh, states, incident;
  let selected = 0;
  const stageDescriptions = [
    '只布点: 三组方向等距排列, 外轮廓是六边形.',
    '连成三角形: 每个面都很规则, 方便找到可合并的邻居.',
    '随机合并: 移除配对三角形的共享边, 允许剩余三角形存在.',
    '统一细分: 三角形变 3 块, 四边形变 4 块, 所有面现在都有四条边.',
    '固定边界, 内部顶点向邻居平均位置移动; 连接关系保持不变.',
  ];
  function renderGeometry() {
    const stage = Number(stageInput.value);
    const mesh =
      stage <= 1
        ? triangles
        : stage === 2
          ? merged
          : stage === 3
            ? divided
            : finalMesh;
    const displayMesh =
      stage === 0 ? { vertices: mesh.vertices, faces: [] } : mesh;
    get(geometry, '[data-visual]').innerHTML = meshSvg(displayMesh, {
      points: stage === 0,
    });
    const tris = displayMesh.faces.filter((face) => face.length === 3).length;
    const quads = displayMesh.faces.filter((face) => face.length === 4).length;
    get(geometry, 'output').textContent =
      `${stageDescriptions[stage]} ${mesh.vertices.length} 个顶点 · ${tris} 个三角形 · ${quads} 个四边形`;
    relaxInput.disabled = stage !== 4;
    get(geometry, '[data-relax-value]').textContent = `${relaxInput.value} 次`;
    get(geometry, '[data-merge-value]').textContent = `${mergeInput.value}%`;
  }
  function renderTerrain(message = '') {
    const grid = get(terrain, '[data-wire]').checked,
      points = get(terrain, '[data-points]').checked;
    get(terrain, '[data-visual]').innerHTML = meshSvg(finalMesh, {
      terrain: true,
      states,
      grid,
      points,
      selected,
      incident,
    });
    const affected = incident[selected].length;
    get(terrain, 'output').textContent =
      `${message}顶点 #${selected}:${states[selected] ? '陆地' : '水'}; 关联 ${affected} 块地形(红框).`;
  }
  function regenerate() {
    let seed = Math.trunc(Number(seedInput.value));
    if (!Number.isFinite(seed)) seed = 42;
    seed = Math.max(1, Math.min(999999, seed));
    seedInput.value = String(seed);
    triangles = makeTriangles(4);
    merged = mergeTriangles(triangles, Number(mergeInput.value) / 100, seed);
    divided = subdivide(merged);
    finalMesh = relax(divided, Number(relaxInput.value));
    states = islandStates(finalMesh);
    incident = adjacencyOf(finalMesh).incident;
    // Select the closest vertex to the center, even after relaxation moves it.
    selected = finalMesh.vertices.reduce(
      (best, p, id, positions) =>
        Math.hypot(...p) < Math.hypot(...positions[best]) ? id : best,
      0,
    );
    renderGeometry();
    renderTerrain('已生成网格.');
  }
  stageInput.addEventListener('change', renderGeometry);
  relaxInput.addEventListener('input', () => {
    // Always recalculate from the same unsubdued mesh; do not accumulate slider history.
    finalMesh = relax(divided, Number(relaxInput.value));
    renderGeometry();
    renderTerrain('已调整形状, 保留海陆状态.');
  });
  mergeInput.addEventListener('input', regenerate);
  get(geometry, '[data-generate]').addEventListener('click', regenerate);
  terrain.addEventListener('click', (event) => {
    const vertex = event.target.closest('[data-vertex]');
    if (vertex) {
      selected = Number(vertex.dataset.vertex);
      states[selected] ^= 1;
      renderTerrain('已翻转.');
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'clear') states.fill(0);
    if (action === 'island') states = islandStates(finalMesh);
    renderTerrain(
      action === 'clear'
        ? '已设为全水.'
        : action === 'island'
          ? '已恢复示例岛屿.'
          : '已翻转.',
    );
  });
  for (const checkbox of terrain.querySelectorAll('input[type="checkbox"]'))
    checkbox.addEventListener('change', () => renderTerrain());
  regenerate();
  for (const root of [geometry, terrain])
    root.querySelectorAll('[data-enhanced]').forEach((el) => {
      el.hidden = false;
    });
}

const maskRoot = document.getElementById('tg-mask');
const geometryRoot = document.getElementById('tg-geometry');
const terrainRoot = document.getElementById('tg-terrain');
if (maskRoot) initMask(maskRoot);
if (geometryRoot && terrainRoot) initMeshes(geometryRoot, terrainRoot);
