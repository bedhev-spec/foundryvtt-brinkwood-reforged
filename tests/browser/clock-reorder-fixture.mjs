import { bindGlobalClockReorder } from '../../module/global-clock-reorder.js';

const root = document.querySelector('#brinkwood-global-clock-overlay');
root.innerHTML = `<div class="global-clock-list">${['A', 'B', 'C'].map(id => `
  <article class="global-clock-entry" data-clock-id="${id}">
    <span class="global-clock__label">${id}</span>
    <div class="global-clock__controls">
      <button class="global-clock__drag" draggable="true" aria-label="Reorder ${id}">↕</button>
      <button aria-label="Visibility">V</button><button aria-label="Edit">E</button><button aria-label="Delete">D</button>
    </div><button class="global-clock__face" aria-label="Progress ${id}"></button>
  </article>`).join('')}</div><span data-reorder-status role="status"></span>`;
let writes = 0;
let gm = true;
let progress = 0;
let controller;
const bind = () => {
  controller = new AbortController();
  bindGlobalClockReorder(root, { signal: controller.signal, canReorder: () => gm,
    move: async () => { writes++; return true; }, format: (_key, data) => `${data.name}: ${data.position}/${data.total}` });
};
const row = id => root.querySelector(`[data-clock-id="${id}"]`);
const handle = id => row(id).querySelector('.global-clock__drag');
const order = () => [...root.querySelectorAll('.global-clock-entry')].map(el => el.dataset.clockId).join('');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const key = (id, key) => handle(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const transfer = new DataTransfer();
const drag = (element, type, clientY = 0) => element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientY }));
const assertions = {};
bind();
key('C', 'Home'); await tick();
assertions.keyboardMovesAndAnnounces = order() === 'CAB' && document.activeElement === handle('C') && root.querySelector('[role="status"]').textContent === 'C: 1/3';
drag(handle('C'), 'dragstart');
drag(row('B'), 'dragover', row('B').getBoundingClientRect().bottom - 1);
assertions.dragFeedback = row('C').classList.contains('is-dragging') && row('B').dataset.dropPosition === 'after';
drag(row('B'), 'drop'); await tick();
assertions.dropMovesAndCleans = order() === 'ABC' && !root.querySelector('.is-dragging, [data-drop-position]');
const beforeCancel = writes;
drag(handle('A'), 'dragstart');
drag(row('C'), 'dragover', row('C').getBoundingClientRect().bottom - 1);
key('A', 'Escape');
drag(row('C'), 'drop'); await tick();
assertions.escapeCancels = writes === beforeCancel && order() === 'ABC' && !root.querySelector('.is-dragging, [data-drop-position]');
drag(handle('A'), 'dragstart'); drag(handle('A'), 'dragend');
assertions.dragendCleans = !root.querySelector('.is-dragging, [data-drop-position]');
controller.abort(); bind();
const beforeRebind = writes;
key('A', 'End'); await tick();
assertions.rebindHasOneListener = writes === beforeRebind + 1 && order() === 'BCA';
gm = false;
key('A', 'Home'); await tick();
assertions.playersCannotMove = writes === beforeRebind + 1;
gm = true;
row('A').querySelector('.global-clock__face').addEventListener('click', () => progress++);
row('A').querySelector('.global-clock__face').click();
assertions.faceStillSteps = progress === 1 && writes === beforeRebind + 1;
drag(handle('A'), 'dragstart'); controller.abort();
assertions.abortCleans = !root.querySelector('.is-dragging, [data-drop-position]');
bind();
const output = document.querySelector('#clock-reorder-results');
output.dataset.status = Object.values(assertions).every(Boolean) ? 'passed' : 'failed';
output.textContent = JSON.stringify({ assertions }, null, 2);
