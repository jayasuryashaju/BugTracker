import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { Bug as BugIcon, MessageSquare, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useBugEvents } from '../context/NotificationsContext';
import { errorMessage, STATUSES, unwrap } from '../lib/utils';
import { Avatar, DueDate, EmptyState, PageHead, PriorityBadge, TagChip } from '../components/ui';

// The column under the pointer wins; keyboard drags (no pointer) fall back to the nearest center.
const collision = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCenter(args);
};

const COLUMN_COLOR = { Open: 'var(--s1)', 'In Progress': 'var(--s2)', Resolved: 'var(--s3)', Closed: 'var(--s4)' };

const CardBody = ({ bug }) => (
  <>
    <span className="row" style={{ gap: 6 }}>
      <span className="issue__id">{bug.display_id}</span>
      {bug.project_detail && <span className="muted truncate" style={{ fontSize: 12 }}>{bug.project_detail.name}</span>}
    </span>
    <span className="kcard__title">{bug.title}</span>
    {bug.tags_detail?.length > 0 && <span className="row row--wrap" style={{ gap: 4 }}>{bug.tags_detail.slice(0, 3).map((t) => <TagChip key={t.id} tag={t} />)}</span>}
    <span className="kcard__foot">
      <PriorityBadge priority={bug.priority} />
      <DueDate bug={bug} />
      {bug.comment_count > 0 && <span className="muted row" style={{ gap: 3, fontSize: 12 }}><MessageSquare size={12} />{bug.comment_count}</span>}
      <span className="spacer"><Avatar user={bug.assigned_to} size="sm" /></span>
    </span>
  </>
);

const Card = ({ bug }) => {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: bug.id, data: { bug } });
  return (
    <div
      ref={setNodeRef}
      className={`kcard ${isDragging ? 'kcard--dragging' : ''}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      onClick={() => navigate(`/bug/${bug.id}`)}
      {...attributes}
      {...listeners}
      aria-label={`${bug.display_id} ${bug.title}. Press space to pick up, arrow keys to move, space to drop.`}
    >
      <CardBody bug={bug} />
    </div>
  );
};

const Column = ({ status, bugs }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className="column" data-over={isOver} aria-label={`${status}, ${bugs.length} bugs`}>
      <div className="column__head">
        <span style={{ width: 10, height: 10, borderRadius: 3, background: COLUMN_COLOR[status] }} />
        {status}<span className="column__count">{bugs.length}</span>
      </div>
      <div className="column__body" ref={setNodeRef}>
        {bugs.map((b) => <Card key={b.id} bug={b} />)}
        {bugs.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: '18px 0', fontSize: 13 }}>Drop bugs here</div>}
      </div>
    </section>
  );
};

const KanbanBoard = () => {
  const { user } = useAuth();
  const [bugs, setBugs] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState('');
  const [mine, setMine] = useState(false);
  const [active, setActive] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const load = useCallback(async () => {
    try {
      const res = await api.get('bugs/', { params: { page_size: 500, ordering: '-priority_rank,-created_at', ...(project && { project }), ...(mine && { mine: true }) } });
      setBugs(unwrap(res));
      setTruncated((res.data.count ?? 0) > unwrap(res).length);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load the board.'));
      setBugs((b) => b ?? []);
    }
  }, [project, mine]);

  useEffect(() => { load(); }, [load]);
  useBugEvents(load);
  useEffect(() => { api.get('projects/', { params: { page_size: 500 } }).then((r) => setProjects(unwrap(r))).catch(() => {}); }, []);

  const byStatus = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (bugs || []).filter((b) => b.status === s)])), [bugs]);

  const onDragEnd = async ({ active: a, over }) => {
    setActive(null);
    const bug = a.data.current?.bug;
    const target = over?.id;
    if (!bug || !STATUSES.includes(target) || bug.status === target) return;
    const previous = bugs;
    setBugs((list) => list.map((b) => (b.id === bug.id ? { ...b, status: target } : b)));
    try {
      await api.patch(`bugs/${bug.id}/`, { status: target });
      toast.success(`${bug.display_id} moved to ${target}`);
    } catch (err) {
      setBugs(previous);
      toast.error(errorMessage(err, 'Could not move that bug.'));
    }
  };

  return (
    <div>
      <PageHead title="Board" subtitle="Drag a card to change its status. Click it to open the bug."
        actions={(
          <>
            <select className="select" style={{ width: 180 }} aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Assigned to me</label>
          </>
        )} />
      {truncated && <div className="alert alert--info" style={{ marginBottom: 12 }}>Showing the first 500 bugs. Narrow the board with a project filter.</div>}
      {bugs && bugs.length === 0 ? (
        <div className="card"><EmptyState icon={BugIcon} title="Nothing on the board" action={<Link to="/create" className="btn btn--primary"><PlusCircle size={16} /> Log a bug</Link>}>{mine || project ? 'No bugs match these filters.' : `Bugs ${user?.profile?.role === 'Developer' ? 'assigned to you ' : ''}will appear here.`}</EmptyState></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e) => setActive(e.active.data.current?.bug)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="board" aria-busy={bugs === null}>
            {STATUSES.map((s) => <Column key={s} status={s} bugs={byStatus[s]} />)}
          </div>
          <DragOverlay>{active && <div className="kcard kcard--overlay"><CardBody bug={active} /></div>}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default KanbanBoard;
