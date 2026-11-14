import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_CONFIG = {
  CITIZEN: [
    { to: '/dashboard',      icon: '🏠', label: 'Dashboard' },
    { to: '/reports',        icon: '📋', label: 'My Reports' },
    { to: '/reports/new',    icon: '➕', label: 'Submit Report' },
    { to: '/rewards',        icon: '🪙', label: 'Rewards' },
    { to: '/notifications',  icon: '🔔', label: 'Notifications' },
  ],
  WORKER: [
    { to: '/worker/tasks',   icon: '🗂️', label: 'My Tasks' },
    { to: '/worker/stats',   icon: '📊', label: 'My Stats' },
    { to: '/notifications',  icon: '🔔', label: 'Notifications' },
  ],
  ADMIN: [
    { to: '/admin/reports',  icon: '📋', label: 'Reports' },
    { to: '/admin/users',    icon: '👥', label: 'Users' },
    { to: '/admin/analytics',icon: '📊', label: 'Analytics' },
    { to: '/notifications',  icon: '🔔', label: 'Notifications' },
  ],
  SUPER_ADMIN: [
    { to: '/admin/reports',  icon: '📋', label: 'Reports' },
    { to: '/admin/users',    icon: '👥', label: 'Users' },
    { to: '/admin/analytics',icon: '📊', label: 'Analytics' },
    { to: '/admin/audit',    icon: '🔍', label: 'Audit Log' },
    { to: '/notifications',  icon: '🔔', label: 'Notifications' },
  ],
};

export default function Sidebar() {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();

  const links = NAV_CONFIG[role] ?? NAV_CONFIG.CITIZEN;
  const initials = (profile?.displayName ?? profile?.email ?? 'U')
    .slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        Civic<span>Flow</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name truncate">
              {profile?.displayName ?? profile?.email ?? 'User'}
            </div>
            <div className="sidebar-user-role">{role ?? 'CITIZEN'}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ background: 'none', color: 'rgba(255,255,255,.5)', fontSize: 18 }}
          >
            ⏏
          </button>
        </div>
      </div>
    </aside>
  );
}
