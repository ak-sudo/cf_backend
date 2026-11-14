import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const TITLES = {
  '/dashboard':        'Citizen Dashboard',
  '/reports':          'Reports',
  '/reports/new':      'Submit New Report',
  '/rewards':          'Rewards & EcoCoins',
  '/notifications':    'Notifications',
  '/worker/tasks':     'My Assigned Tasks',
  '/worker/stats':     'Worker Stats',
  '/admin/reports':    'Report Management',
  '/admin/users':      'User Management',
  '/admin/analytics':  'Analytics',
  '/admin/audit':      'Audit Log',
};

export default function AppShell({ children }) {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'CivicFlow';

  return (
    <div>
      <Sidebar />
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            CivicFlow Platform
          </span>
        </div>
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}
