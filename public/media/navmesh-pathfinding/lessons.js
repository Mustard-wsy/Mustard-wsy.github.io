import {
  makeRoom,
  edgeIndex,
  searchCorridor,
  corridorPortals,
  stringPull,
  circumcircle,
  pathLength,
  center,
} from './geometry.js';

export const info = {
  clearance: {
    title: '角色的中心能走到哪里?',
    choices: [
      {
        key: 'radius',
        label: '角色半径',
        options: [
          ['0.5', '0.5'],
          ['0', '0 (点)'],
          ['1.3', '1.3'],
        ],
      },
    ],
  },
  delaunay: {
    title: '同一个四边形, 该保留哪条对角线?',
    choices: [
      {
        key: 'locked',
        label: '对角线 AC',
        options: [
          ['no', '自由边'],
          ['yes', '约束边'],
        ],
      },
    ],
  },
  mesh: { title: '把可行走区域变成相邻的面', choices: [] },
  corridor: {
    title: 'A* 找的是一条多边形通道',
    choices: [
      {
        key: 'goal',
        label: '目标位置',
        options: [
          ['side', '右侧'],
          ['upper', '右上'],
        ],
      },
    ],
  },
  funnel: {
    title: '依次过门, 把绳子收紧',
    choices: [
      {
        key: 'goal',
        label: '目标位置',
        options: [
          ['side', '右侧'],
          ['upper', '右上'],
        ],
      },
    ],
  },
};

export const start = [1.5, 3.5];
export const goalOf = (choices) =>
  choices.goal === 'upper' ? [10.5, 6.5] : [10.5, 3.5];
const step = (caption, options = {}) => ({ caption, ...options });

export function makeFrames(kind, choices = {}) {
  if (kind === 'clearance') {
    const radius = Number(choices.radius ?? 0.5),
      closed = radius >= 1.25;
    return [
      step(
        '灰色是实际障碍, 圆形表示角色碰撞范围. 先看角色本身, 再计算中心能去哪里.',
        { radius, clearance: 0 },
      ),
      step(
        '把障碍向外扩张角色半径. 图中用外扩矩形保守包住圆角偏移, 红色区域禁止角色中心进入.',
        { radius, clearance: 1 },
      ),
      step(
        '外边界同时向内退让. 可行走区域现在描述的是角色中心, 后续可以按一个点寻路.',
        { radius, clearance: 2 },
      ),
      step(
        closed
          ? '原来的上下通道宽 2.5, 现在 2r = 2.6. 扣除两侧净空后通道关闭, 左右不再连通.'
          : '中心沿绿色路线绕开扩张后的障碍. 角色身体与原始障碍保持净空.',
        {
          radius,
          clearance: 2,
          route: closed
            ? []
            : stringPull(
                corridorPortals(
                  makeRoom(radius),
                  searchCorridor(makeRoom(radius), start, [10.5, 3.5]).corridor,
                  start,
                  [10.5, 3.5],
                ),
              ).path,
          goal: [10.5, 3.5],
          blocked: closed,
        },
      ),
    ];
  }
  if (kind === 'delaunay') {
    const quad = [
        [2, 2],
        [8, 2],
        [7, 6],
        [3, 4.5],
      ],
      locked = choices.locked === 'yes';
    const circle = circumcircle(quad[0], quad[1], quad[2]);
    return [
      step('四边形可以沿 AC 或 BD 分成两个三角形. 先沿 AC 划分.', {
        quad,
        diagonal: [0, 2],
      }),
      step(
        '画出三角形 ABC 的外接圆. 第四个点 D 位于圆内, 自由边 AC 不满足局部德劳内条件.',
        { quad, diagonal: [0, 2], circle, inspect: 3 },
      ),
      step(
        locked
          ? 'AC 被指定为约束边, 必须保留. 约束条件优先, 不能为了空圆条件把墙边翻掉.'
          : 'AC 是自由边, 两个三角形组成凸四边形. 可以去掉 AC, 改接 BD.',
        {
          quad,
          diagonal: locked ? [0, 2] : [1, 3],
          circle: locked ? circle : null,
          locked,
        },
      ),
      step(
        locked
          ? '约束德劳内只对允许变化的边做合法化. 隔着约束不可见的点, 不能直接套普通的全局空圆条件.'
          : 'BD 保持原四边形覆盖不变, 并恢复这一对三角形的德劳内条件. 这个操作叫翻边.',
        { quad, diagonal: locked ? [0, 2] : [1, 3], locked },
      ),
    ];
  }
  const mesh = makeRoom(),
    goal = goalOf(choices);
  const search = searchCorridor(mesh, start, goal),
    portals = corridorPortals(mesh, search.corridor, start, goal);
  if (kind === 'mesh') {
    return [
      step('先得到外轮廓与障碍孔洞. 红色线段是必须保留的约束边.', {
        mesh,
        faceCount: 0,
        constraints: true,
      }),
      ...mesh.faces.map((_, index) =>
        step(`加入 T${index}. 面只能覆盖可行走区域, 不能跨过红色约束边.`, {
          mesh,
          faceCount: index + 1,
          constraints: true,
        }),
      ),
      step('所有面覆盖可行走区域, 障碍孔洞仍然是空的. 面的顶点按逆时针保存.', {
        mesh,
        faceCount: mesh.faces.length,
        constraints: true,
        labels: true,
      }),
      step(
        '两面共享一条可通行边才建立邻接. 虚线连接面中心, 只是把搜索图画出来.',
        {
          mesh,
          faceCount: mesh.faces.length,
          constraints: true,
          labels: true,
          dual: true,
        },
      ),
    ];
  }
  if (kind === 'corridor') {
    return [
      ...search.frames.map((frame) =>
        step(frame.caption, {
          mesh,
          goal,
          faceCount: 8,
          labels: true,
          dual: true,
          ...frame,
        }),
      ),
      step(
        '相邻面之间的共享边依次成为门. 橙色门线限定要穿过的区间, 灰色虚线是中心折线.',
        {
          mesh,
          goal,
          faceCount: 8,
          labels: true,
          corridor: search.corridor,
          portals,
          proxy: [
            start,
            ...search.corridor.map((id) => search.centers[id]),
            goal,
          ],
        },
      ),
    ];
  }
  if (kind === 'funnel') {
    const result = stringPull(portals);
    return result.frames.map((frame, index) =>
      step(frame.caption, {
        mesh,
        goal,
        faceCount: 8,
        corridor: search.corridor,
        portals,
        funnel: frame,
        route: frame.path,
        finished: index === result.frames.length - 1,
        proxy:
          index === result.frames.length - 1
            ? [start, ...search.corridor.map((id) => search.centers[id]), goal]
            : null,
        length:
          index === result.frames.length - 1 ? pathLength(result.path) : null,
      }),
    );
  }
  throw new Error(`Unknown navmesh lesson: ${kind}`);
}

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
export function renderFrame(frame) {
  const project = (p) => [36 + p[0] * 44, 376 - p[1] * 44];
  const pts = (points) => points.map((p) => project(p).join(',')).join(' ');
  const poly = (points, fill, stroke = '#35445e', width = 1) =>
    `<polygon points="${pts(points)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const line = (points, color, width = 2, dashed = false) =>
    points?.length > 1
      ? `<polyline points="${pts(points)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"${dashed ? ' stroke-dasharray="6 5"' : ''}/>`
      : '';
  const dot = (p, color, r = 4) => {
    const [x, y] = project(p);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#f9fbff" stroke-width="1.5"/>`;
  };
  const text = (p, label, color = '#29364f') => {
    const [x, y] = project(p);
    return `<text x="${x}" y="${y - 9}" fill="${color}" font-size="13" text-anchor="middle" stroke="#f9fbff" stroke-width="3" paint-order="stroke">${escape(label)}</text>`;
  };
  const rect = (a, b, fill, stroke, width = 1) =>
    poly([[a[0], a[1]], [b[0], a[1]], b, [a[0], b[1]]], fill, stroke, width);
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400" role="img" aria-label="${escape(frame.caption)}"><title>${escape(frame.caption)}</title><rect width="600" height="400" fill="#f9fbff"/><g font-family="Segoe UI,Microsoft YaHei,sans-serif">`,
  ];
  if (frame.quad) {
    const q = frame.quad;
    out.push(
      poly(q, '#e1e9f5'),
      line(
        frame.diagonal.map((id) => q[id]),
        frame.locked ? '#ae494f' : '#39795c',
        4,
      ),
    );
    if (frame.circle) {
      const [cx, cy] = project(frame.circle.center);
      out.push(
        `<circle cx="${cx}" cy="${cy}" r="${frame.circle.radius * 44}" fill="#e2828218" stroke="#ae494f" stroke-width="2" stroke-dasharray="6 4"/>`,
      );
    }
    q.forEach((p, i) =>
      out.push(
        dot(p, i === frame.inspect ? '#ae494f' : '#35445e', 5),
        text(p, 'ABCD'[i]),
      ),
    );
  } else {
    const radius = frame.radius ?? 0.5;
    out.push(rect([0, 0], [12, 8], '#edf1f8', '#35445e', 2));
    if ((frame.clearance ?? 2) >= 2)
      out.push(
        rect(
          [radius, radius],
          [12 - radius, 8 - radius],
          '#e4f0e9',
          '#39795c',
          2,
        ),
      );
    if ((frame.clearance ?? 2) >= 1)
      out.push(
        rect(
          [4.8 - radius, 2.5 - radius],
          [7.2 + radius, 5.5 + radius],
          '#f0cfd0',
          '#ae494f',
          2,
        ),
      );
    out.push(rect([4.8, 2.5], [7.2, 5.5], '#53617a', '#35445e', 2));
    if (frame.mesh) {
      const mesh = frame.mesh;
      mesh.faces.slice(0, frame.faceCount).forEach((face, id) => {
        const fill = frame.corridor?.includes(id)
          ? '#bce0ca'
          : frame.current === id
            ? '#eaa5a5'
            : frame.open?.includes(id)
              ? '#f5dfae'
              : frame.closed?.includes(id)
                ? '#ccd8ee'
                : '#f9fbff60';
        out.push(
          poly(
            face.map((i) => mesh.vertices[i]),
            fill,
            '#8f9db5',
          ),
        );
      });
      if (frame.constraints)
        for (const edge of edgeIndex(mesh).values())
          if (edge.constrained)
            out.push(
              line(
                edge.vertices.map((id) => mesh.vertices[id]),
                '#ae494f',
                3,
              ),
            );
      if (frame.dual) {
        for (const edge of edgeIndex(mesh).values())
          if (edge.faces.length === 2 && !edge.constrained)
            out.push(
              line(
                edge.faces.map((id) => center(mesh.faces[id], mesh.vertices)),
                '#8996ab',
                1.5,
                true,
              ),
            );
      }
      if (frame.labels)
        mesh.faces.forEach((face, id) =>
          out.push(text(center(face, mesh.vertices), `T${id}`)),
        );
    }
    out.push(line(frame.proxy, '#8b98b0', 2, true));
    if (frame.portals)
      frame.portals.slice(1, -1).forEach((portal, index) => {
        out.push(
          line(
            [portal.left, portal.right],
            frame.funnel?.index === index + 1 ? '#e58b32' : '#b79260',
            frame.funnel?.index === index + 1 ? 5 : 2,
          ),
        );
        const midpoint = [
          (portal.left[0] + portal.right[0]) / 2,
          (portal.left[1] + portal.right[1]) / 2,
        ];
        out.push(text(midpoint, `${index + 1}`, '#7c542a'));
      });
    if (frame.funnel && !frame.finished) {
      const { apex, left, right, checking } = frame.funnel;
      out.push(
        poly([apex, left, right], '#96aade35', 'none'),
        line([apex, left], '#3f70ae', 3),
        line([apex, right], '#b05069', 3),
      );
      if (checking) out.push(dot(checking, '#e58b32', 7));
      out.push(
        dot(apex, '#29364f', 5),
        text(apex, 'A'),
        dot(left, '#3f70ae'),
        text(left, 'L', '#3f70ae'),
        dot(right, '#b05069'),
        text(right, 'R', '#b05069'),
      );
    }
    out.push(line(frame.route, '#2b7955', 4));
    if (frame.radius !== undefined && frame.radius > 0) {
      const [x, y] = project(start);
      out.push(
        `<circle cx="${x}" cy="${y}" r="${frame.radius * 44}" fill="#39795c22" stroke="#39795c" stroke-width="2"/>`,
      );
    }
    out.push(dot(start, '#39795c', 5), text(start, 'S'));
    if (frame.goal)
      out.push(dot(frame.goal, '#ae494f', 5), text(frame.goal, 'G'));
    if (frame.blocked) out.push(text([6, 7.7], '通道关闭', '#ae494f'));
  }
  out.push('</g></svg>');
  return out.join('');
}
