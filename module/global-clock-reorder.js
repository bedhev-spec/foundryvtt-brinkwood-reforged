/** Render-owned interactions; aborting the supplied signal also clears drag feedback. */
export function bindGlobalClockReorder(root, { signal, canReorder, move, format }) {
  const list = root.querySelector('.global-clock-list');
  if (!list) return;
  let source = null;
  const rows = () => [...list.querySelectorAll('.global-clock-entry')];
  const clearTargets = () => rows().forEach(row => row.removeAttribute('data-drop-position'));
  const cleanup = () => {
    source?.classList.remove('is-dragging');
    source = null;
    clearTargets();
  };
  const announce = row => {
    const status = root.querySelector('[data-reorder-status]');
    if (status) status.textContent = format('BITD.GlobalClock.Reordered', {
      name: row.querySelector('.global-clock__label').textContent,
      position: rows().indexOf(row) + 1,
      total: rows().length,
    });
  };
  const commit = async (row, target, after) => {
    if (!canReorder() || !target || row === target) return;
    const changed = await move(row.dataset.clockId, target.dataset.clockId, after);
    if (!changed || signal.aborted || !canReorder()) return;
    if (after) target.after(row);
    else target.before(row);
    row.querySelector('.global-clock__drag').focus();
    announce(row);
  };
  const options = { signal };
  list.querySelectorAll('.global-clock__drag').forEach(handle => {
    const row = handle.closest('.global-clock-entry');
    handle.addEventListener('dragstart', event => {
      if (!canReorder()) { event.preventDefault(); return; }
      cleanup();
      source = row;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.dataset.clockId);
      event.dataTransfer.setDragImage(row, 12, 18);
      row.classList.add('is-dragging');
      event.stopPropagation();
    }, options);
    handle.addEventListener('dragend', cleanup, options);
    handle.addEventListener('keydown', event => {
      if (!canReorder() || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const entries = rows();
      const index = entries.indexOf(row);
      const after = event.key === 'ArrowDown' || event.key === 'End';
      const target = event.key === 'Home' ? entries[0] : event.key === 'End'
        ? entries.at(-1) : entries[index + (after ? 1 : -1)];
      void commit(row, target, after);
    }, options);
  });
  list.addEventListener('dragover', event => {
    clearTargets();
    if (!source || !canReorder()) return;
    const target = event.target.closest('.global-clock-entry');
    if (!target || !list.contains(target) || target === source) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const rect = target.getBoundingClientRect();
    target.dataset.dropPosition = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
  }, options);
  list.addEventListener('dragleave', event => {
    if (!list.contains(event.relatedTarget)) clearTargets();
  }, options);
  list.addEventListener('drop', event => {
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    const row = source;
    const target = event.target.closest('.global-clock-entry');
    const position = target?.dataset.dropPosition;
    cleanup();
    if (position) void commit(row, target, position === 'after');
  }, options);
  root.ownerDocument.addEventListener('keydown', event => {
    if (event.key === 'Escape' && source) {
      event.preventDefault();
      event.stopPropagation();
      cleanup();
    }
  }, { signal, capture: true });
  signal.addEventListener('abort', cleanup, { once: true });
}
