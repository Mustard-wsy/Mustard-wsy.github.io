import { createSearch, makeMap } from './search.js';

const root = document.querySelector('#astar-lab');
if (root) {
  const mode = root.querySelector('[data-mode]');
  const block = root.querySelector('[data-block]');
  const board = root.querySelector('[data-board]');
  const status = root.querySelector('[data-status]');
  const detail = root.querySelector('[data-detail]');
  const frontier = root.querySelector('[data-frontier]');
  let state;
  let selected = 5;
  const coord = (id) => `(${id % 5},${Math.floor(id / 5)})`;
  const cells = [];
  const grid = document.createElement('div');
  grid.className = 'as-grid';
  for (let id = 0; id < 25; id++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      selected = id;
      render();
    });
    cells.push(button);
    grid.append(button);
  }
  board.replaceChildren(grid);

  function render() {
    const { map } = state;
    for (let id = 0; id < 25; id++) {
      const wall = map.walls.has(id);
      const visited = state.closed.has(id);
      const pending = state.open.has(id);
      const path = state.path.includes(id);
      const current = state.current === id;
      const kind = wall
        ? 'wall'
        : path
          ? 'path'
          : current
            ? 'current'
            : visited
              ? 'closed'
              : pending
                ? 'open'
                : 'empty';
      const symbol =
        id === map.start
          ? 'S'
          : id === map.goal
            ? 'G'
            : wall
              ? '#'
              : path
                ? '*'
                : current
                  ? '@'
                  : visited
                    ? 'x'
                    : pending
                      ? '?'
                      : '.';
      const name = wall
        ? '墙'
        : path
          ? '路径'
          : current
            ? '当前'
            : visited
              ? '已展开'
              : pending
                ? '候选'
                : '未到达';
      const score = state.g.has(id) ? state.score(id) : null;
      const label = `${coord(id)} ${id === map.start ? '起点, ' : id === map.goal ? '终点, ' : ''}${name}${score === null ? '' : `, 排序分数 ${score}`}`;
      cells[id].className = `as-cell as-${kind}`;
      cells[id].setAttribute('aria-label', label);
      cells[id].setAttribute('aria-pressed', String(selected === id));
      cells[id].textContent = '';
      const mark = document.createElement('span');
      mark.textContent = symbol;
      const value = document.createElement('small');
      value.textContent = score === null ? ' ' : String(score);
      cells[id].append(mark, value);
    }
    status.textContent = state.found
      ? `终点已取出. 路径代价 ${state.g.get(map.goal)}, 共 ${state.path.length - 1} 步. 取出节点 ${state.closed.size} 个(含终点).`
      : state.done
        ? `候选列表已空, 无路可走. 已展开 ${state.closed.size} 个节点.`
        : state.current === null
          ? '起点已加入候选. 按下一步, 取出并检查当前分数最小的节点.'
          : `本轮取出 ${coord(state.current)}, 排序分数 ${state.score(state.current)}. 已展开 ${state.closed.size} 个节点, 等待检查 ${state.open.size} 个.`;
    const known = state.g.has(selected);
    const from = state.parent.get(selected);
    detail.textContent = map.walls.has(selected)
      ? `${coord(selected)} 是墙, 不参与搜索.`
      : `${coord(selected)}: g = ${known ? state.g.get(selected) : '尚未知'}, h = ${state.h(selected)}, f = ${known ? state.g.get(selected) + state.h(selected) : '尚未知'}. 来路: ${from !== undefined ? coord(from) : selected === map.start ? '起点' : '尚无'}.`;
    const candidates = state.candidates();
    frontier.textContent = `候选顺序: ${candidates.length ? candidates.map((id) => `${coord(id)}[${state.score(id)}]`).join(' → ') : '空'}.`;
    root.querySelector('[data-step]').disabled = state.done;
    root.querySelector('[data-finish]').disabled = state.done;
  }

  function reset() {
    state = createSearch(makeMap(block.checked), mode.value);
    render();
  }
  mode.addEventListener('change', reset);
  block.addEventListener('change', reset);
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
