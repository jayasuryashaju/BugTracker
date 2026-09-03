import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, X, Send, Camera, Film, FileText, CheckCircle2, ArrowLeft, Upload, User, AlertCircle, FolderGit2 } from 'lucide-react';
import MarkdownEditor from '../components/MarkdownEditor';
import toast from 'react-hot-toast';

const BugCreate = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    steps_to_reproduce: '',
    priority: 'Medium',
    project: '',
    due_date: '',
    assigned_to_id: '',
    tag_ids: []
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('users/'),
      api.get('projects/'),
      api.get('tags/')
    ]).then(([usersRes, projectsRes, tagsRes]) => {
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.results || []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data.results || []);
      setAvailableTags(Array.isArray(tagsRes.data) ? tagsRes.data : tagsRes.data.results || []);
    }).catch(err => console.error(err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (!payload.assigned_to_id) delete payload.assigned_to_id;
      if (!payload.project) delete payload.project;
      if (!payload.due_date) delete payload.due_date;
      if (!payload.steps_to_reproduce) delete payload.steps_to_reproduce;
      if (!payload.tag_ids || payload.tag_ids.length === 0) delete payload.tag_ids;
      
      const res = await api.post('bugs/', payload);
      if (file) {
        const fd = new FormData();
        fd.append('bug', res.data.id);
        fd.append('file', file);
        await api.post('attachments/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      toast.success('Bug report created successfully!');
      navigate('/bugs');
    } catch (err) {
      console.error(err);
      let msg = 'Failed to create bug report.';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          msg = err.response.data;
        } else if (err.response.data.detail) {
          msg = err.response.data.detail;
        } else if (err.response.data.error) {
          msg = Array.isArray(err.response.data.error) ? err.response.data.error[0] : err.response.data.error;
        } else {
          const firstKey = Object.keys(err.response.data)[0];
          if (firstKey) {
            const val = err.response.data[firstKey];
            msg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : `${firstKey}: ${val}`;
          }
        }
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Log a Bug</h1>
          <p className="page-header__subtitle">Report a new issue, assign it to a project and developer</p>
        </div>
        <button onClick={() => navigate('/bugs')} className="btn btn--secondary">
          <ArrowLeft size={16} /> Back to Bugs
        </button>
      </div>

      <div className="card" style={{ width: '100%' }}>
        <div className="card__header">
          <span className="card__title">Bug Details</span>
        </div>
        <div className="card__body">
          <form onSubmit={handleSubmit} className="flex-col gap-4" style={{ display: 'flex' }}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 3 }}>
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  required
                  placeholder="Brief summary of the issue"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tags</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {availableTags.map(tag => (
                  <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.tag_ids.includes(tag.id)}
                      onChange={e => {
                        const newTagIds = e.target.checked 
                          ? [...formData.tag_ids, tag.id] 
                          : formData.tag_ids.filter(id => id !== tag.id);
                        setFormData({ ...formData, tag_ids: newTagIds });
                      }}
                    />
                    <span style={{ color: tag.color, fontWeight: 500 }}>{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row form-row--3">
              <div className="form-group">
                <label className="form-label">Select Project</label>
                <select
                  className="form-select"
                  value={formData.project}
                  onChange={e => setFormData({ ...formData, project: e.target.value })}
                >
                  <option value="">General (No specific project)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select
                  className="form-select"
                  value={formData.assigned_to_id}
                  onChange={e => setFormData({ ...formData, assigned_to_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => {
                    const name = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username;
                    const roleLabel = u.profile?.role || 'Developer';
                    return (
                      <option key={u.id} value={u.id}>
                        {name} ({roleLabel}) - {u.email}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label flex items-center gap-2">Description *</label>
              <MarkdownEditor
                value={formData.description}
                onChange={val => setFormData({ ...formData, description: val })}
                placeholder="Describe the bug in detail. What happened? What did you expect?"
                minHeight="150px"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Steps to Reproduce</label>
              <MarkdownEditor
                value={formData.steps_to_reproduce}
                onChange={val => setFormData({ ...formData, steps_to_reproduce: val })}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
                minHeight="100px"
              />
            </div>



            <div className="form-group">
              <label className="form-label">Attachment (Screenshot or Video Recording)</label>
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-fast)',
                  position: 'relative'
                }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = 'var(--border)';
                  if (e.dataTransfer.files.length > 0) setFile(e.dataTransfer.files[0]);
                }}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <Upload size={24} style={{ color: 'var(--text-dim)', marginBottom: '8px' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {file ? file.name : 'Click to upload screenshot or screen recording video'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  PNG, JPG, WEBP, MP4, WEBM up to 50MB
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*,video/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => setFile(e.target.files[0])}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => navigate('/bugs')} className="btn btn--secondary">Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Create Bug Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BugCreate;
