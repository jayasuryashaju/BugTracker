import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';

export function KanbanColumn({ id, title, bugs }) {
  const { setNodeRef } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      title,
    }
  });

  const bugIds = useMemo(() => bugs.map(b => b.id), [bugs]);

  return (
    <div className="kanban-column">
      <div className="kanban-column__header">
        {title}
        <span className="badge" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
          {bugs.length}
        </span>
      </div>
      
      <div className="kanban-column__body" ref={setNodeRef}>
        <SortableContext items={bugIds} strategy={verticalListSortingStrategy}>
          {bugs.map(bug => (
            <KanbanCard key={bug.id} bug={bug} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
