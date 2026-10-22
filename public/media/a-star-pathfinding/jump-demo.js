import { createJumpSearch, makeJumpMap } from './jump.js';

const root = document.querySelector('#jps-lab');
if (root) {
  const mode = root.querySelector('[data-mode]');
  const scene = root.querySelector('[data-scene]');
  const board = root.querySelector('[data-board]');
  const status = root.querySelector('[data-status]');
  const detail = root.querySelector('[data-detail]');
  const frontier = root.querySelector('[data-frontier]');
  const trace = root.querySelector('[data-trace]');
  const format = (value) => Number(value.toFixed(2)).toString();
  const coord = (id) => `(${id % 7},${Math.floor(id / 7)})`;
  let state,
    selected = 28;
  const cells = [];
  const grid = document.createElement('div');
  grid.className = 'as-grid as-jump-grid';
  for (let id = 0; id < 35; id++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.addEventListener('click', () => {
      selected = id;
      render();
    });
    cells.push(cell);
    grid.append(cell);
  }
  board.replaceChildren(grid);

  function render() {
    for (let id = 0; id < 35; id++) {
      const wall = state.map.walls.has(id),
        path = state.path.includes(id);
      const macro = state.mode === 'jps' && state.macroPath.includes(id);
      const current = state.current === id,
        closed = state.closed.has(id);
      const open = state.open.has(id),
        scanned = state.scanned.has(id);
      const kind = wall
        ? 'wall'
        : path
          ? 'path'
          : current
            ? 'current'
            : closed
              ? 'closed'
              : open
                ? 'open'
                : scanned
                  ? 'scanned'
                  : 'empty';
      const name = wall
        ? '墙'
        : path
          ? macro
            ? '路径跳点'
            : '路径'
          : current
            ? '当前'
            : closed
              ? '已取出'
              : open
                ? '候选'
                : scanned
                  ? '仅扫描'
                  : '未到达';
      const symbol =
        id === state.map.start
          ? 'S'
          : id === state.map.goal
            ? 'G'
            : wall
              ? '#'
              : path
                ? macro
                  ? 'J'
                  : '*'
                : current
                  ? '@'
                  : closed
                    ? 'x'
                    : open
                      ? '?'
                      : scanned
                        ? ':'
                        : '.';
      cells[id].className = `as-cell as-${kind}`;
      cells[id].setAttribute('aria-label', `${coord(id)} ${name}`);
      cells[id].setAttribute('aria-pressed', String(selected === id));
      const mark = document.createElement('span');
      mark.textContent = symbol;
      const value = document.createElement('small');
      value.textContent = state.g.has(id)
        ? format(state.g.get(id) + state.h(id))
        : ' ';
      cells[id].replaceChildren(mark, value);
    }
    const scans =
      state.mode === 'jps'
        ? ` 扫描 ${state.scans} 格次(可通行格, 含重复).`
        : '';
    status.textContent =
      (state.found
        ? `已找到路径, 代价 ${format(state.g.get(state.map.goal))}, ${state.path.length - 1} 步. 共取出 ${state.closed.size} 个节点(含终点).`
        : state.done
          ? `候选耗尽, 无路可走. 已取出 ${state.closed.size} 个节点.`
          : state.current === null
            ? '起点已加入候选. 下一步取出并展开一个候选, JPS 会在这一轮内完成方向扫描.'
            : `本轮取出 ${coord(state.current)}. 累计取出 ${state.closed.size} 个节点, 候选 ${state.open.size} 个.`) +
      scans;
    const known = state.g.has(selected),
      from = state.parent.get(selected);
    detail.textContent = state.map.walls.has(selected)
      ? `${coord(selected)} 是墙.`
      : `${coord(selected)}: g = ${known ? format(state.g.get(selected)) : '尚无候选记录'}, h = ${format(state.h(selected))}. 父节点: ${from === undefined ? (selected === state.map.start ? '起点' : '尚无') : coord(from)}.${!known && state.scanned.has(selected) ? ' 该格被扫描过, 但没有加入候选.' : ''}`;
    frontier.textContent = `候选: ${
      state
        .candidates()
        .map((id) => `${coord(id)}[${format(state.g.get(id) + state.h(id))}]`)
        .join(' → ') || '空'
    }.`;
    const lines = state.trace.length
      ? state.trace
      : [
          state.mode === 'jps'
            ? '本轮没有新返回的跳点.'
            : 'A* 将相邻的合法格作为后继.',
        ];
    trace.replaceChildren(
      ...lines.map((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      }),
    );
    root.querySelector('[data-step]').disabled = state.done;
    root.querySelector('[data-finish]').disabled = state.done;
  }
  function reset() {
    state = createJumpSearch(makeJumpMap(scene.value), mode.value);
    render();
  }
  mode.addEventListener('change', reset);
  scene.addEventListener('change', reset);
  root.querySelector('[data-reset]').addEventListener('click', reset);
  root.querySelector('[data-step]').addEventListener('click', () => {
    state.step();
    render();
  });
  root.querySelector('[data-finish]').addEventListener('click', () => {
    while (!state.done) state.step();
    render();
  });
  reset();
  root.querySelector('[data-controls]').hidden = false;
}
