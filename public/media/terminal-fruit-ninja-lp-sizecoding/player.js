const player = document.querySelector('#slicer-recording');

if (player) {
  const button = player.querySelector('[data-play]');
  const seek = player.querySelector('[data-seek]');
  const clock = player.querySelector('[data-time]');
  const status = player.querySelector('[data-status]');
  const canvas = player.querySelector('canvas');
  const poster = player.querySelector('img');
  const context = canvas.getContext('2d');
  const colors = {
    0: '#dce4ee',
    91: '#ff7878',
    92: '#83d68d',
    93: '#efd277',
    94: '#87a9ff',
    95: '#dca0ed',
    96: '#7fd7df',
    97: '#ffffff',
  };
  let recording;
  let loading;
  let playing = false;
  let time = 0;
  let started = 0;
  let request;
  let lastFrame = -1;

  const label = (value) => `${value.toFixed(1)} 秒`;

  function paint() {
    let lo = 0;
    let hi = recording.frames.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (recording.frames[mid][0] <= time) lo = mid;
      else hi = mid - 1;
    }
    if (lo !== lastFrame) {
      context.fillStyle = '#0f141c';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = '16px Consolas, "Liberation Mono", monospace';
      context.textBaseline = 'top';
      recording.frames[lo][1].forEach((line, row) => {
        let column = 0;
        for (const [color, text] of line) {
          context.fillStyle = colors[color] || colors[0];
          // Fixed cells preserve the original terminal geometry on every font.
          for (const character of text) {
            if (character !== ' ') {
              context.fillText(character, 16 + column * 10, 16 + row * 20);
            }
            column++;
          }
        }
      });
      lastFrame = lo;
    }
    seek.value = String(time);
    clock.textContent = `${label(time)} / ${label(recording.duration)}`;
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(request);
    button.textContent = '播放';
    button.setAttribute('aria-pressed', 'false');
  }

  function tick(now) {
    if (!playing) return;
    time = Math.min(recording.duration, (now - started) / 1000);
    paint();
    if (time >= recording.duration) {
      pause();
      button.textContent = '重新播放';
      return;
    }
    request = requestAnimationFrame(tick);
  }

  async function load() {
    loading ||= (async () => {
      const response = await fetch(
        new URL('./terminal-recording.json', import.meta.url),
      );
      if (!response.ok) throw new Error('无法读取录制文件');
      const data = await response.json();
      if (data.version !== 1 || !data.frames?.length || !context) {
        throw new Error('录制格式不受支持');
      }
      recording = data;
      canvas.width = data.columns * 10 + 32;
      canvas.height = data.rows * 20 + 32;
      seek.max = String(data.duration);
      seek.disabled = false;
      canvas.hidden = false;
      poster.hidden = true;
      paint();
    })();
    try {
      await loading;
    } catch (error) {
      loading = undefined;
      status.textContent = '录制暂时无法加载，可以稍后重试；静态画面仍可查看。';
      throw error;
    }
  }

  button.hidden = false;
  player.querySelector('[data-controls]').hidden = false;
  button.addEventListener('click', async () => {
    if (playing) {
      pause();
      return;
    }
    button.disabled = true;
    try {
      await load();
      if (time >= recording.duration) time = 0;
      playing = true;
      started = performance.now() - time * 1000;
      button.textContent = '暂停';
      button.setAttribute('aria-pressed', 'true');
      status.textContent = '真实终端输出回放，录制中的鼠标划动由脚本输入。';
      request = requestAnimationFrame(tick);
    } catch {
      // Keep the poster and retry control available after a failed request.
    } finally {
      button.disabled = false;
    }
  });
  seek.addEventListener('input', () => {
    time = Number(seek.value);
    started = performance.now() - time * 1000;
    paint();
    if (!playing) button.textContent = '播放';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) pause();
  });
}
