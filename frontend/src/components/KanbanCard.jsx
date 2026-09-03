import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, CheckCircle, Clock, Circle, Calendar } from 'lucide-react';

export function KanbanCard({ bug, isOverlay }) {
  const sortableData = useSortable({
    id: bug.id,
    disabled: isOverlay,
    data: {
      type: 'Bug',
      bug,
    }
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = isOverlay ? {} : sortableData;

  const style = isOverlay ? {} : {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return 'var(--status-critical)';
      case 'High': return 'var(--status-warning)';
      case 'Medium': return 'var(--status-progress)';
      default: return 'var(--text-muted)';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'Critical': return <AlertCircle size={14} />;
      case 'High': return <Clock size={14} />;
      case 'Medium': return <CheckCircle size={14} />;
      default: return <Circle size={14} />;
    }
  };

  const assigneeInitial = bug.assigned_to_details?.first_name?.[0]?.toUpperCase() 
    || bug.assigned_to_details?.username?.[0]?.toUpperCase() 
    || '?';

  const isOverdue = bug.due_date && new Date(bug.due_date) < new Date(new Date().setHours(0,0,0,0)) && !['Resolved', 'Closed'].includes(bug.status);

  return (
    <div
      ref={isOverlay ? null : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      className={`kanban-card ${isDragging && !isOverlay ? 'kanban-card--dragging' : ''} ${isOverlay ? 'kanban-card--overlay' : ''}`}
    >
      <div className="kanban-card__title">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '6px' }}>{bug.display_id}</span>
        {bug.title}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {bug.project_details?.name || 'General'}
      </div>
      
      {bug.tags_detail && bug.tags_detail.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
          {bug.tags_detail.map(tag => (
            <span key={tag.id} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tag.color }} title={tag.name} />
          ))}
        </div>
      )}
      
      <div className="kanban-card__footer">
        <span 
          className="badge" 
          style={{ 
            color: getPriorityColor(bug.priority), 
            background: 'transparent',
            border: `1px solid ${getPriorityColor(bug.priority)}`,
            boxShadow: `0 0 12px ${getPriorityColor(bug.priority)}33`,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px'
          }}
        >
          {getPriorityIcon(bug.priority)} {bug.priority}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {bug.due_date && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: isOverdue ? 'var(--status-critical)' : 'var(--text-dim)', fontWeight: isOverdue ? 600 : 'normal' }}>
              <Calendar size={12} />
              {new Date(bug.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {bug.assigned_to_details ? (
            <div className="kanban-card__avatar" title={bug.assigned_to_details.username}>
              {assigneeInitial}
            </div>
          ) : (
            <div className="kanban-card__avatar" style={{ background: 'var(--bg-base)', border: '1px dashed var(--border)', color: 'var(--text-dim)' }} title="Unassigned">
              ?
            </div>
          )}
        </div>
      </div>
    </div>);
}
