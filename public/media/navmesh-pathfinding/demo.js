import { info, makeFrames, renderFrame } from './lessons.js';

for (const root of document.querySelectorAll('[data-navmesh-lesson]')) {
  const kind = root.dataset.navmeshLesson,
    definition = info[kind];
  if (!definition) continue;
  const controls = root.querySelector('[data-controls]'),
    board = root.querySelector('[data-board]'),
    status = root.querySelector('[data-status]');
  let frames,
    index = 0;
  const choices = {},
    count = document.createElement('span');
  const previous = button('上一步', () => {
      index--;
      render();
    }),
    next = button('下一步', () => {
      index++;
      render();
    }),
    reset = button('重来', () => {
      index = 0;
      render();
    });
  for (const choice of definition.choices) {
    const label = document.createElement('label'),
      select = document.createElement('select');
    label.append(choice.label, ' ');
    select.setAttribute('aria-label', `${definition.title}: ${choice.label}`);
    for (const [value, text] of choice.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    choices[choice.key] = select.value;
    select.addEventListener('change', () => {
      choices[choice.key] = select.value;
      rebuild();
    });
    label.append(select);
    controls.append(label);
  }
  controls.append(previous, next, reset, count);
  controls.hidden = false;
  rebuild();
  function button(text, action) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = text;
    node.addEventListener('click', action);
    return node;
  }
  function rebuild() {
    frames = makeFrames(kind, choices);
    index = 0;
    render();
  }
  function render() {
    index = Math.max(0, Math.min(index, frames.length - 1));
    board.innerHTML = renderFrame(frames[index]);
    status.textContent = frames[index].caption;
    count.textContent = `${index + 1} / ${frames.length}`;
    previous.disabled = index === 0;
    next.disabled = index === frames.length - 1;
  }
}
