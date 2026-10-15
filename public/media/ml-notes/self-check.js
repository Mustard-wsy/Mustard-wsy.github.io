(() => {
  const key = Symbol.for('mustard.notes.self-check');
  if (window[key]) {
    window[key]();
    return;
  }

  const init = () => {
    document.querySelectorAll('button.ml-answer').forEach((button) => {
      if (button.hasAttribute('data-ready')) return;
      const text = button.querySelector('.ml-answer-text');
      if (!text) return;
      const concealedLabel = button.getAttribute('aria-label') || '显示答案';
      let hovered = false;
      let keyboardFocus = false;
      let toggled = false;

      const render = () => {
        const visible = hovered || keyboardFocus || toggled;
        button.dataset.revealed = String(visible);
        button.setAttribute('aria-expanded', String(visible));
        text.setAttribute('aria-hidden', String(!visible));
        if (visible) button.removeAttribute('aria-label');
        else button.setAttribute('aria-label', concealedLabel);
      };

      button.dataset.ready = 'true';
      button.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'mouse') return;
        hovered = true;
        render();
      });
      button.addEventListener('pointerleave', () => {
        hovered = false;
        render();
      });
      button.addEventListener('focus', () => {
        keyboardFocus = button.matches(':focus-visible');
        render();
      });
      button.addEventListener('blur', () => {
        keyboardFocus = false;
        toggled = false;
        render();
      });
      button.addEventListener('click', (event) => {
        // Mouse hover is transient. Touch and keyboard clicks toggle instead.
        if (hovered && event.detail !== 0) return;
        toggled = !(keyboardFocus || toggled);
        keyboardFocus = false;
        render();
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        hovered = false;
        keyboardFocus = false;
        toggled = false;
        render();
      });
      render();
    });
  };

  window[key] = init;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else init();
  document.addEventListener('astro:page-load', init);
})();
