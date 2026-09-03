import Loader from '../components/Loader';
import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import api from '../api';
import toast from 'react-hot-toast';
import { KanbanColumn } from '../components/KanbanColumn';
import { KanbanCard } from '../components/KanbanCard';
import './KanbanBoard.css';

const COLUMNS = [
  { id: 'Open', title: 'Open' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'Resolved', title: 'Resolved' },
  { id: 'Closed', title: 'Closed' }
];

export default function KanbanBoard() {
  const [bugs, setBugs] = useState([]);
  const [activeBug, setActiveBug] = useState(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchBugs();

    const handleBugEvent = (e) => {
      const { action, bug } = e.detail;
      setBugs(prev => {
        if (action === 'created') return [bug, ...prev];
        if (action === 'deleted') return prev.filter(b => b.id !== bug.id);
        if (action === 'updated') {
          // If we drag a card ourselves, we do optimistic update. 
          // The WS event might arrive later. We should just merge it.
          return prev.map(b => b.id === bug.id ? { ...b, ...bug } : b);
        }
        return prev;
      });
    };
    
    window.addEventListener('ws_bug_event', handleBugEvent);
    return () => window.removeEventListener('ws_bug_event', handleBugEvent);
  }, []);

  const fetchBugs = async () => {
    try {
      const res = await api.get('bugs/');
      setBugs(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch bugs for the board');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const bug = bugs.find(b => b.id === active.id);
    if (bug) {
      setActiveBug(bug);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveBug(null);

    if (!over) return;

    const activeBugId = active.id;
    const overId = over.id;

    // Find the bug and determine target status
    const bug = bugs.find(b => b.id === activeBugId);
    let targetStatus = null;

    if (COLUMNS.find(c => c.id === overId)) {
      targetStatus = overId;
    } else {
      const overBug = bugs.find(b => b.id === overId);
      if (overBug) {
        targetStatus = overBug.status;
      }
    }

    if (targetStatus && bug.status !== targetStatus) {
      // Optimistic update
      const previousBugs = [...bugs];
      setBugs(bugs.map(b => b.id === activeBugId ? { ...b, status: targetStatus } : b));

      try {
        await api.patch(`bugs/${activeBugId}/`, { status: targetStatus });
        toast.success(`Bug moved to ${targetStatus}`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to update bug status');
        setBugs(previousBugs); // Revert on failure
      }
    } else if (targetStatus && bug.status === targetStatus) {
      // Reorder within the same column visually
      const oldIndex = bugs.findIndex(b => b.id === activeBugId);
      const newIndex = bugs.findIndex(b => b.id === overId);
      
      if (oldIndex !== newIndex && newIndex !== -1) {
        setBugs(arrayMove(bugs, oldIndex, newIndex));
      }
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Bug Board</h1>
          <p className="page-header__subtitle">Drag and drop bugs to update their status</p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board-container">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              bugs={bugs.filter(b => b.status === col.id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeBug ? <KanbanCard bug={activeBug} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
