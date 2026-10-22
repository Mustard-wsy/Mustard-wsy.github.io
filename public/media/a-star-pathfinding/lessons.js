import { createSearch } from './search.js';

const point = (id, width) => [id % width, Math.floor(id / width)];
const routeCost = (route, map) =>
  route.slice(1).reduce((cost, id, i) => {
    const [x, y] = point(id, map.width),
      [px, py] = point(route[i], map.width);
    return (
      cost + (map.costs?.get(id) ?? (x !== px && y !== py ? Math.SQRT2 : 1))
    );
  }, 0);
const number = (value) => Number(value.toFixed(2)).toString();
const view = (map, options = {}) => ({ map, ...options });
const frame = (caption, views) => ({ caption, views });
const simpleMap = (width, height, start, goal, walls = []) => ({
  width,
  height,
  start,
  goal,
  walls: new Set(walls),
});

export const lessonInfo = {
  bfs: { title: '从起点向外找', controls: [] },
  mud: { title: '少走两步, 却多花了代价', controls: [] },
  corner: {
    title: '这一步斜线能不能走?',
    controls: [
      {
        key: 'walls',
        label: '侧面障碍',
        options: [
          ['both', '两侧都挡住'],
          ['one', '只挡一侧'],
          ['none', '两侧都为空'],
        ],
      },
      {
        key: 'rule',
        label: '斜走规则',
        options: [
          ['target', '只检查落点'],
          ['one', '至少一侧为空'],
          ['clear', '两侧必须为空'],
        ],
      },
    ],
  },
  symmetry: { title: '交换步子的顺序', controls: [] },
  natural: { title: '空地上, 哪条分支可以省掉?', controls: [] },
  forced: {
    title: '放上障碍后, 重新比较两条路线',
    controls: [
      {
        key: 'obstacle',
        label: '替代路线',
        options: [
          ['wall', '放上障碍'],
          ['empty', '移走障碍'],
        ],
      },
    ],
  },
  projection: { title: '沿斜线扫描, 在哪里转向?', controls: [] },
};

export function makeLesson(kind, choices = {}) {
  if (kind === 'bfs') {
    const map = simpleMap(5, 4, 0, 4, [2, 7, 12]);
    const state = createSearch(map, 'bfs');
    const snapshot = () =>
      view(map, {
        visited: [...state.closed],
        candidates: [...state.open.keys()],
        current: state.current,
        values: new Map(state.g),
        route: [...state.path],
        agent: state.found ? map.goal : null,
        heading: '四方向, 每步代价 1',
      });
    const frames = [
      frame('起点进入队列. 每次取出最早加入的位置, 再把新邻居放到末尾.', [
        snapshot(),
      ]),
    ];
    while (!state.done) {
      state.step();
      const id = state.current;
      frames.push(
        frame(
          state.found
            ? `终点被取出, 回溯得到 ${state.path.length - 1} 步的路径. 格内数字表示到这里的步数.`
            : `取出 (${point(id, map.width).join(',')}). 黄色是等待检查的位置, 蓝色是已经取出的位置. 格内数字是距离起点的步数.`,
          [snapshot()],
        ),
      );
    }
    return frames;
  }
  if (kind === 'mud' || kind === 'symmetry') {
    const map = simpleMap(4, 2, 0, kind === 'mud' ? 3 : 7);
    if (kind === 'mud')
      map.costs = new Map([
        [1, 5],
        [2, 5],
      ]);
    const routes =
      kind === 'mud'
        ? [
            [0, 1, 2, 3],
            [0, 4, 5, 6, 7, 3],
          ]
        : [
            [0, 1, 2, 7],
            [0, 5, 6, 7],
          ];
    const count = Math.max(...routes.map((route) => route.length));
    return Array.from({ length: count }, (_, step) => {
      const views = routes.map((route, index) => {
        const partial = route.slice(0, step + 1);
        return view(map, {
          heading:
            kind === 'mud'
              ? index
                ? '从下方绕行'
                : '直接穿过沼泽'
              : index
                ? '先斜走, 再向右'
                : '先向右, 再斜走',
          route: partial,
          ghost: route,
          agent: partial.at(-1),
          footer: `${partial.length - 1} 步 / 代价 ${number(routeCost(partial, map))}`,
        });
      });
      return frame(
        step === count - 1
          ? kind === 'mud'
            ? '直行 3 步花 11, 绕行 5 步只花 5. 步数最少与总代价最小在这里分开了.'
            : '两条路线都花 2 + √2, 约 3.41. 空地上可以交换直步和斜步的顺序.'
          : `第 ${step} 步. 两张图各前进一步; 先到终点的路线停在终点.`,
        views,
      );
    });
  }
  if (kind === 'corner') {
    const walls = choices.walls ?? 'both',
      rule = choices.rule ?? 'target';
    const map = simpleMap(
      2,
      2,
      0,
      3,
      walls === 'both' ? [1, 2] : walls === 'one' ? [1] : [],
    );
    const free = [1, 2].filter((id) => !map.walls.has(id));
    const allowed =
      rule === 'target' ||
      (rule === 'one' ? free.length >= 1 : free.length === 2);
    const base = { ghost: [0, 3], heading: '斜向移动, 代价 √2' };
    return [
      frame('准备从 S 斜向走到 G. 这张图只判断这一条边是否合法.', [
        view(map, { ...base, agent: 0 }),
      ]),
      frame('先检查落点 G: 它不是障碍, 通过落点检查.', [
        view(map, { ...base, agent: 0, focus: [3] }),
      ]),
      frame(
        `两个侧面格中, 有 ${free.length} 个可通行. 当前规则: ${rule === 'target' ? '侧面不影响这条边' : rule === 'one' ? '至少一侧为空' : '两侧必须为空'}.`,
        [view(map, { ...base, agent: 0, focus: [1, 2] })],
      ),
      frame(
        allowed
          ? '按当前规则, 这一步合法, 可以到达 G.'
          : '按当前规则, 这一步被阻止. 这不表示 G 是墙, 而是 S 与 G 之间没有这条边.',
        [
          view(map, {
            ...base,
            route: allowed ? [0, 3] : [],
            blocked: allowed ? null : 3,
            agent: allowed ? 3 : 0,
          }),
        ],
      ),
    ];
  }
  if (kind === 'natural' || kind === 'forced') {
    const obstacle = kind === 'forced' && choices.obstacle !== 'empty';
    const map = simpleMap(3, 3, 3, 2, obstacle ? [1] : []);
    const labels = new Map([
      [3, 'p'],
      [4, 'x'],
      [2, 'n'],
    ]);
    const direct = [3, 4, 2],
      alternative = [3, 1, 2];
    const titles = ['经过当前格 x', '先斜走的替代路线'];
    const captions = [
      '准备从 p 出发. 比较去 n 的两种走法, 判断 x 到 n 的分支是否必须保留.',
      obstacle
        ? '经过 x 的第一步合法. 替代路线的第一步落在障碍上, 无法继续.'
        : '左图先走到 x, 右图先斜走. 目前两条路线都合法.',
      obstacle
        ? '左图能从 x 斜到 n, 代价 1 + √2. 右图无法按原路线到达 n, 原本的等价关系被打破.'
        : '两条路线都到达 n, 代价同为 1 + √2. 当前局部没有障碍, 可以保留先斜后直的代表路线.',
      obstacle
        ? '在 x 保留通向 n 的分支. n 是这个来向下的强制邻居, x 因此成为跳点.'
        : '在 x 剪去通向 n 的这个分支. 仍有等价路线到 n, 从 x 继续向右的自然方向保留.',
    ];
    return captions.map((caption, step) =>
      frame(
        caption,
        [direct, alternative].map((route, index) => {
          const partial =
            index && obstacle ? [3] : route.slice(0, Math.min(step, 2) + 1);
          return view(map, {
            labels,
            heading: titles[index],
            ghost: route,
            route: partial,
            agent: partial.at(-1),
            blocked: index && obstacle && step > 0 ? 1 : null,
            pruned: !index && step === 3 && !obstacle ? [4, 2] : null,
            accent: !index && step === 3 && obstacle ? [4, 2] : [],
            arrow: !index && step === 3 ? [4, obstacle ? 2 : 5] : null,
            footer:
              index && obstacle && step > 0
                ? '替代路线被阻止'
                : `代价 ${number(routeCost(partial, map))}`,
          });
        }),
      ),
    );
  }
  if (kind === 'projection') {
    const map = simpleMap(7, 5, 28, 13);
    const frames = [],
      diagonal = [28],
      scanned = [];
    const add = (caption, options = {}) =>
      frames.push(
        frame(caption, [
          view(map, {
            heading: '只跟踪从 S 向右上的一次扫描',
            route: [...diagonal],
            scanned: [...scanned],
            agent: diagonal.at(-1),
            ...options,
          }),
        ]),
      );
    add('从 S 开始. 每走一个斜步, 都先检查水平和竖直分量是否能找到跳点.');
    for (let k = 1; k <= 3; k++) {
      const x = k,
        y = 4 - k,
        id = y * 7 + x;
      diagonal.push(id);
      add(`沿右上方向来到 (${x},${y}). 先扫描水平方向.`, { current: id });
      const horizontal = [id];
      for (let sx = x + 1; sx < 7; sx++) {
        const probe = y * 7 + sx;
        scanned.push(probe);
        horizontal.push(probe);
        add(
          probe === map.goal
            ? '水平扫描碰到终点 G. 返回的是当前斜线上的 (3,1), 用来衔接这条分支.'
            : `水平分量检查 (${sx},${y}), 尚未找到跳点.`,
          { probe: [...horizontal], current: probe },
        );
        if (probe === map.goal) {
          add(
            '保留 J = (3,1). 后续从 J 向右即可到达 G, S → J → G 的代价为 3√2 + 3.',
            {
              route: [28, 22, 16, 10, 11, 12, 13],
              labels: new Map([[10, 'J']]),
              accent: [10],
              agent: 13,
            },
          );
          return frames;
        }
      }
      add('水平方向到边界仍未找到跳点, 改查竖直分量.', { current: id });
      const vertical = [id];
      for (let sy = y - 1; sy >= 0; sy--) {
        const probe = sy * 7 + x;
        scanned.push(probe);
        vertical.push(probe);
        add(`竖直分量检查 (${x},${sy}), 尚未找到跳点.`, {
          probe: [...vertical],
          current: probe,
        });
      }
      add('两个分量都没有找到跳点, 继续下一个斜步.', { current: id });
    }
  }
  throw new Error(`Unknown pathfinding lesson: ${kind}`);
}

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );

// Shared by the browser and generated no-script SVGs, with no DOM dependency.
export function renderLessonView(model) {
  const { map } = model;
  const cell = 56,
    left = 26,
    top = 44;
  const width = map.width * cell + left * 2,
    height = map.height * cell + top + 44;
  const center = (id) => {
    const [x, y] = point(id, map.width);
    return [left + x * cell + cell / 2, top + y * cell + cell / 2];
  };
  const lines = (route, color, dashed = false, stroke = 4) =>
    route?.length > 1
      ? `<polyline points="${route.map((id) => center(id).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round"${dashed ? ' stroke-dasharray="5 5"' : ''}/>`
      : '';
  const text = (x, y, label, size = 13, color = '#29364f') =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="${color}">${escape(label)}</text>`;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(model.heading ?? '')}"><title>${escape(model.heading ?? '')}</title><rect width="100%" height="100%" fill="#f9fbff"/><g font-family="Segoe UI,Microsoft YaHei,sans-serif">`,
    text(width / 2, 16, model.heading ?? '', 14),
  ];
  for (let x = 0; x < map.width; x++)
    parts.push(text(left + x * cell + cell / 2, top - 11, x, 11, '#5d6b82'));
  for (let y = 0; y < map.height; y++)
    parts.push(text(12, top + y * cell + cell / 2, y, 11, '#5d6b82'));
  for (let id = 0; id < map.width * map.height; id++) {
    const [cx, cy] = center(id);
    const wall = map.walls.has(id),
      terrain = map.costs?.has(id);
    const fill = wall
      ? '#35445e'
      : model.accent?.includes(id)
        ? '#f5dfae'
        : model.candidates?.includes(id)
          ? '#f5dfae'
          : model.visited?.includes(id)
            ? '#ccd8ee'
            : model.scanned?.includes(id)
              ? '#e5dfef'
              : terrain
                ? '#e5d4b5'
                : '#edf1f8';
    parts.push(
      `<rect x="${cx - 26}" y="${cy - 26}" width="52" height="52" fill="${fill}" stroke="${model.focus?.includes(id) ? '#ae494f' : '#bdc6df'}" stroke-width="${model.focus?.includes(id) ? 3 : 1}"/>`,
    );
    if (wall) parts.push(text(cx, cy, '墙', 14, '#fff'));
    if (terrain) parts.push(text(cx, cy + 17, '代价 5', 10, '#5d4c35'));
  }
  parts.push(
    lines(model.ghost, '#9ca9bf', true, 2),
    lines(model.route, '#39795c'),
    lines(model.probe, '#8865a6', true),
    lines(model.pruned, '#ae494f', true),
  );
  if (model.arrow) {
    const [a, b] = model.arrow,
      [ax, ay] = center(a),
      [bx, by] = center(b);
    const angle = Math.atan2(by - ay, bx - ax),
      endX = bx - Math.cos(angle) * 12,
      endY = by - Math.sin(angle) * 12;
    parts.push(
      lines(model.arrow, '#ae494f', false, 5),
      `<path d="M${endX - 11 * Math.cos(angle - 0.55)} ${endY - 11 * Math.sin(angle - 0.55)}L${endX} ${endY}L${endX - 11 * Math.cos(angle + 0.55)} ${endY - 11 * Math.sin(angle + 0.55)}" fill="none" stroke="#ae494f" stroke-width="4"/>`,
    );
  }
  if (model.current !== null && model.current !== undefined) {
    const [cx, cy] = center(model.current);
    parts.push(
      `<rect x="${cx - 23}" y="${cy - 23}" width="46" height="46" fill="none" stroke="#ae494f" stroke-width="3"/>`,
    );
  }
  if (model.agent !== null && model.agent !== undefined) {
    const [cx, cy] = center(model.agent);
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="11" fill="#39795c" stroke="#fff" stroke-width="2"/>`,
    );
  }
  const labels = new Map([
    [map.start, 'S'],
    [map.goal, 'G'],
    ...(model.labels ?? []),
  ]);
  for (const [id, label] of labels) {
    const [cx, cy] = center(id);
    parts.push(
      `<rect x="${cx - 10}" y="${cy - 24}" width="20" height="17" fill="#f9fbff"/>`,
      text(cx, cy - 15, label, 12),
    );
  }
  for (const [id, value] of model.values ?? []) {
    const [cx, cy] = center(id);
    parts.push(text(cx, cy + 12, value, 12));
  }
  if (model.blocked !== null && model.blocked !== undefined) {
    const [cx, cy] = center(model.blocked);
    parts.push(
      `<path d="M${cx - 13} ${cy - 13}l26 26m-26 0l26-26" stroke="#ae494f" stroke-width="5"/>`,
    );
  }
  if (model.pruned) {
    const [[ax, ay], [bx, by]] = model.pruned.map(center),
      cx = (ax + bx) / 2,
      cy = (ay + by) / 2;
    parts.push(
      `<path d="M${cx - 7} ${cy - 7}l14 14m-14 0l14-14" stroke="#ae494f" stroke-width="3"/>`,
    );
  }
  parts.push(
    text(width / 2, height - 17, model.footer ?? '', 13),
    '</g></svg>',
  );
  return parts.join('');
}
