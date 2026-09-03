import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bug, FolderGit2, User, X } from 'lucide-react';
import api from '../api';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [bugs, setBugs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      api.get('bugs/').then(res => setBugs(res.data.results || res.data)).catch(err => console.error(err));
      api.get('projects/').then(res => setProjects(res.data.results || res.data)).catch(err => console.error(err));
      api.get('users/').then(res => setUsers(res.data.results || res.data)).catch(err => console.error(err));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredBugs = bugs.filter(b => b.title.toLowerCase().includes(query.toLowerCase()) || (b.display_id && b.display_id.toLowerCase().includes(query.toLowerCase())));
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(query.toLowerCase()));

  const allResults = [
    ...filteredProjects.map(p => ({ id: p.id, type: 'Project', name: p.name, icon: <FolderGit2 size={16}/>, path: `/projects/${p.id}` })),
    ...filteredBugs.map(b => ({ id: b.id, type: 'Bug', name: `${b.display_id} ${b.title}`, icon: <Bug size={16}/>, path: `/bug/${b.id}` })),
    ...filteredUsers.map(u => ({ id: u.id, type: 'User', name: u.username, icon: <User size={16}/>, path: `/team` }))
  ].slice(0, 8); // Limit to top 8

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (allResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % allResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (allResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + allResults.length) % allResults.length);
      }
    } else if (e.key === 'Enter' && allResults.length > 0) {
      e.preventDefault();
      navigate(allResults[selectedIndex].path);
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette__header">
          <Search size={20} className="command-palette__icon" />
          <input
            ref={inputRef}
            className="command-palette__input"
            placeholder="Search projects, bugs, or teammates... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn-icon" onClick={() => setIsOpen(false)}><X size={20} /></button>
        </div>
        <div className="command-palette__body">
          {allResults.length > 0 ? (
            allResults.map((item, idx) => (
              <div 
                key={`${item.type}-${item.id}`} 
                className={`command-palette__item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => { navigate(item.path); setIsOpen(false); }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="command-palette__item-icon">{item.icon}</div>
                <div className="command-palette__item-content">
                  <span className="command-palette__item-title">{item.name}</span>
                  <span className="command-palette__item-type">{item.type}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="command-palette__empty">No results found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
