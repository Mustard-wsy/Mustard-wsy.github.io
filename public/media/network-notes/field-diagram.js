/* Content lives in HTML data attributes; this controller knows no protocols. */
(() => {
  const key = Symbol.for('mustard.notes.field-diagram');
  if (window[key]) {
    window[key]();
    return;
  }
  const init = () => {
    document.querySelectorAll('[data-field-diagram]').forEach((root) => {
      if (root.dataset.fieldsReady === 'true') return;
      const fields = [...root.querySelectorAll('button[data-field-name]')];
      const detail = root.querySelector('[data-field-detail]');
      if (!fields.length || !detail) return;
      const title = detail.querySelector('[data-detail-title]');
      const size = detail.querySelector('[data-detail-size]');
      const description = detail.querySelector('[data-detail-description]');
      const example = detail.querySelector('[data-detail-example]');
      if (!title || !size || !description || !example) return;
      root.dataset.fieldsReady = 'true';
      fields.forEach((field) => {
        field.disabled = false;
        field.setAttribute('aria-pressed', 'false');
        field.setAttribute('aria-controls', detail.id);
      });
      let active = null;
      const select = (field) => {
        if (active === field) return;
        active?.setAttribute('aria-pressed', 'false');
        field.setAttribute('aria-pressed', 'true');
        title.textContent = field.dataset.fieldName;
        size.textContent = field.dataset.fieldSize || '';
        description.textContent = field.dataset.fieldDescription || '';
        example.textContent = field.dataset.fieldExample || '';
        example.hidden = !field.dataset.fieldExample;
        active = field;
      };
      fields.forEach((field, index) => {
        field.addEventListener('pointerenter', (event) => {
          if (event.pointerType === 'mouse') select(field);
        });
        field.addEventListener('focus', () => select(field));
        field.addEventListener('click', () => select(field));
        field.addEventListener('keydown', (event) => {
          const directions = {
            ArrowRight: 1,
            ArrowDown: 1,
            ArrowLeft: -1,
            ArrowUp: -1,
          };
          let next;
          if (event.key in directions)
            next =
              (index + directions[event.key] + fields.length) % fields.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = fields.length - 1;
          else return;
          event.preventDefault();
          fields[next].focus();
        });
      });
      select(
        fields.find((field) => field.hasAttribute('data-default-field')) ||
          fields[0],
      );
    });
  };
  window[key] = init;
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('astro:page-load', init);
})();
