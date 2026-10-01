import { Link } from 'react-router-dom';
import { FolderGit2, MessageSquare } from 'lucide-react';
import { DueDate, Person, PriorityBadge, StatusBadge, TagChip } from './ui';

const Meta = ({ bug, project }) => (
  <span className="issue__meta">
    <span className="issue__id">{bug.display_id}</span>
    {project && bug.project_detail && <span className="row" style={{ gap: 4 }}><FolderGit2 size={12} />{bug.project_detail.name}</span>}
    <DueDate bug={bug} />
    {bug.comment_count > 0 && <span className="row" style={{ gap: 4 }}><MessageSquare size={12} />{bug.comment_count}</span>}
    {bug.tags_detail?.slice(0, 3).map((t) => <TagChip key={t.id} tag={t} />)}
  </span>
);

/** Responsive bug list: a grid table on desktop, stacked cards on phones. */
const IssueList = ({ bugs, showProject = true }) => {
  const cols = showProject
    ? 'minmax(0, 3fr) minmax(0, 1.2fr) 118px 96px minmax(0, 1.3fr)'
    : 'minmax(0, 3fr) 118px 96px minmax(0, 1.3fr)';
  return (
    <div className="table" style={{ '--cols': cols }}>
      <div className="table__head" role="row">
        <span>Issue</span>
        {showProject && <span>Project</span>}
        <span>Status</span>
        <span>Priority</span>
        <span>Assignee</span>
      </div>
      {bugs.map((bug) => (
        <Link key={bug.id} to={`/bug/${bug.id}`} className="table__row">
          <span className="issue">
            <span className="issue__title truncate">{bug.title}</span>
            <Meta bug={bug} project={false} />
          </span>
          {showProject && (
            <span className="truncate" style={{ color: 'var(--text-2)' }}>{bug.project_detail?.name || <span className="muted">General</span>}</span>
          )}
          <span><StatusBadge status={bug.status} /></span>
          <span><PriorityBadge priority={bug.priority} /></span>
          <Person user={bug.assigned_to} />
        </Link>
      ))}
      <div className="cards-mobile">
        {bugs.map((bug) => (
          <Link key={bug.id} to={`/bug/${bug.id}`}>
            <span className="row row--between" style={{ alignItems: 'flex-start', gap: 12 }}>
              <span className="issue__title">{bug.title}</span>
              <PriorityBadge priority={bug.priority} />
            </span>
            <Meta bug={bug} project={showProject} />
            <span className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <StatusBadge status={bug.status} />
              <Person user={bug.assigned_to} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default IssueList;
