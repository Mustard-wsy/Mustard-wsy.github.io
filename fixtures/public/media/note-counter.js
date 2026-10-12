const counter = document.getElementById('note-counter');
const output = counter.querySelector('output');
counter.querySelector('button').addEventListener('click', () => {
  output.textContent = String(Number(output.textContent) + 1);
});
