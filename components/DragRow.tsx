import { useLayoutEffect, useRef, type ReactNode } from 'react';

const transferType = 'application/x-ritm-row';
const beforeDrop = new WeakMap<Element, number>();

export function moved<T extends { id: string }>(items: T[], from: string, to: string) {
  const first = items.findIndex(item => item.id === from);
  const last = items.findIndex(item => item.id === to);
  if (first < 0 || last < 0 || first === last) return items;
  const result = [...items];
  result.splice(last, 0, result.splice(first, 1)[0]);
  return result;
}

export function DragRow({ id, group, move, children }: {
  id: string; group: string; move: (from: string, to: string) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || !beforeDrop.has(row)) return;
    const delta = beforeDrop.get(row)! - row.getBoundingClientRect().top;
    beforeDrop.delete(row);
    if (delta && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      row.animate([{ transform: 'translateY(' + delta + 'px)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  });
  return <div ref={ref} draggable data-ritm-row={group} style={{ userSelect: 'none', cursor: 'grab' }}
    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData(transferType, JSON.stringify([group,id])); }}
    onDragOver={e => { if (e.dataTransfer.types.includes(transferType)) { e.preventDefault(); e.currentTarget.dataset.over = 'yes'; } }}
    onDragLeave={e => { delete e.currentTarget.dataset.over; }}
    onDrop={e => {
      delete e.currentTarget.dataset.over;
      const raw = e.dataTransfer.getData(transferType);
      if (!raw) return;
      e.preventDefault();
      let source;
      try { source = JSON.parse(raw); } catch { return; }
      if (source[0] !== group || source[1] === id) return;
      for (const row of Array.from(e.currentTarget.parentElement?.children ?? []))
        beforeDrop.set(row, row.getBoundingClientRect().top);
      move(source[1], id);
    }}>{children}</div>;
}
