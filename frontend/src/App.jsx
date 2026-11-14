import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './components/AppShell';
import AuthPage from './pages/AuthPage';

// Pages
import CitizenDashboard from './pages/CitizenDashboard';
import ReportsList     from './pages/ReportsList';
import ReportDetail    from './pages/ReportDetail';
import SubmitReport    from './pages/SubmitReport';
import Rewards         from './pages/Rewards';
import Notifications   from './pages/Notifications';
import WorkerTasks     from './pages/WorkerTasks';
import Analytics       from './pages/Analytics';
import AdminUsers      from './pages/AdminUsers';
import AdminReports    from './pages/AdminReports';
import AuditLog        from './pages/AuditLog';
import Profile         from './pages/Profile';

// Landing page for each role (first entry of that role's sidebar)
const ROLE_HOME = {
  CITIZEN: '/dashboard',
  WORKER: '/worker/tasks',
  ADMIN: '/admin/reports',
  SUPER_ADMIN: '/admin/reports',
};
const homeFor = (role) => ROLE_HOME[role] ?? '/dashboard';

// Signed in with Firebase, but the CivicFlow profile could not be loaded
function ProfileError() {
  const { profileError, retryProfile, logout } = useAuth();
  return (
    <div className="spinner-wrap" style={{ minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>We couldn't load your account</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
          {profileError ?? 'Your profile is unavailable right now.'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={retryProfile}>Try again</button>
          <button className="btn" onClick={logout}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

// A route that requires the user to be signed in
function PrivateRoute({ children, roles }) {
  const { user, profile, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!profile) return <ProfileError />;

  if (roles && !roles.includes(role)) {
    // Send the user to their own role's home page if role doesn't match
    return <Navigate to={homeFor(role)} replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth */}
      <Route
        path="/auth"
        element={user ? <Navigate to={homeFor(role)} replace /> : <AuthPage />}
      />

      {/* Citizen */}
      <Route path="/dashboard" element={
        <PrivateRoute><CitizenDashboard /></PrivateRoute>
      } />
      <Route path="/reports" element={
        <PrivateRoute><ReportsList /></PrivateRoute>
      } />
      <Route path="/reports/new" element={
        <PrivateRoute><SubmitReport /></PrivateRoute>
      } />
      <Route path="/reports/:id" element={
        <PrivateRoute><ReportDetail /></PrivateRoute>
      } />
      <Route path="/rewards" element={
        <PrivateRoute><Rewards /></PrivateRoute>
      } />
      <Route path="/notifications" element={
        <PrivateRoute><Notifications /></PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute><Profile /></PrivateRoute>
      } />

      {/* Worker */}
      <Route path="/worker/tasks" element={
        <PrivateRoute roles={['WORKER']}><WorkerTasks /></PrivateRoute>
      } />
      <Route path="/worker/stats" element={
        <PrivateRoute roles={['WORKER']}><WorkerTasks /></PrivateRoute>
      } />

      {/* Admin / Super Admin */}
      <Route path="/admin/reports" element={
        <PrivateRoute roles={['ADMIN', 'SUPER_ADMIN']}><AdminReports /></PrivateRoute>
      } />
      <Route path="/admin/users" element={
        <PrivateRoute roles={['ADMIN', 'SUPER_ADMIN']}><AdminUsers /></PrivateRoute>
      } />
      <Route path="/admin/analytics" element={
        <PrivateRoute roles={['ADMIN', 'SUPER_ADMIN']}><Analytics /></PrivateRoute>
      } />
      <Route path="/admin/audit" element={
        <PrivateRoute roles={['SUPER_ADMIN']}><AuditLog /></PrivateRoute>
      } />

      {/* Default */}
      <Route path="/" element={<Navigate to={user ? homeFor(role) : '/auth'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
