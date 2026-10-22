import { lessonInfo, makeLesson, renderLessonView } from './lessons.js';

for (const root of document.querySelectorAll('[data-path-lesson]')) {
  const kind = root.dataset.pathLesson,
    info = lessonInfo[kind];
  if (!info) continue;
  const board = root.querySelector('[data-lesson-board]');
  const controls = root.querySelector('[data-lesson-controls]');
  const status = root.querySelector('[data-lesson-status]');
  const choices = {};
  let frames,
    position = 0;
  const counter = document.createElement('span');
  counter.className = 'as-step-count';
  const previous = button('上一步', () => {
    position--;
    render();
  });
  const next = button('下一步', () => {
    position++;
    render();
  });
  const reset = button('重来', () => {
    position = 0;
    render();
  });

  for (const control of info.controls) {
    const label = document.createElement('label');
    label.append(control.label, ' ');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `${info.title}: ${control.label}`);
    for (const [value, text] of control.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    choices[control.key] = select.value;
    select.addEventListener('change', () => {
      choices[control.key] = select.value;
      rebuild();
    });
    label.append(select);
    controls.append(label);
  }
  controls.append(previous, next, reset, counter);
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
    frames = makeLesson(kind, choices);
    position = 0;
    render();
  }
  function render() {
    position = Math.max(0, Math.min(position, frames.length - 1));
    const current = frames[position];
    board.className = `as-story-board${current.views.length > 1 ? ' as-story-pair' : ''}`;
    board.innerHTML = current.views
      .map(
        (model) =>
          `<div class="as-story-view">${renderLessonView(model)}</div>`,
      )
      .join('');
    status.textContent = current.caption;
    counter.textContent = `${position + 1} / ${frames.length}`;
    previous.disabled = position === 0;
    next.disabled = position === frames.length - 1;
  }
}
