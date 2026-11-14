import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listWorkerTasks, getWorkerStats, startTask, resolveTask } from '../lib/api';

const STATUS_BADGE = {
  PENDING:'badge-yellow', ASSIGNED:'badge-purple',
  IN_PROGRESS:'badge-yellow', RESOLVED:'badge-green',
};

export default function WorkerTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [acting, setActing] = useState(null);

  async function reload() {
    try {
      const [tRes, sRes] = await Promise.allSettled([
        listWorkerTasks({ limit: 50 }),
        getWorkerStats(),
      ]);
      if (tRes.status === 'fulfilled') {
        const d = tRes.value.data?.data ?? tRes.value.data;
        setTasks(Array.isArray(d) ? d : (d?.tasks ?? []));
      }
      if (sRes.status === 'fulfilled') {
        setStats(sRes.value.data?.data ?? sRes.value.data);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function handleStart(id) {
    setActing(id); setMsg('');
    try {
      await startTask(id);
      setMsg('Task marked as In Progress.');
      await reload();
    } catch (e) {
      setMsg(e.response?.data?.message ?? 'Failed.');
    } finally {
      setActing(null);
    }
  }

  async function handleResolve(id) {
    const notes = prompt('Resolution notes (optional):') ?? '';
    setActing(id); setMsg('');
    try {
      await resolveTask(id, { resolutionNotes: notes });
      setMsg('Task resolved successfully!');
      await reload();
    } catch (e) {
      setMsg(e.response?.data?.message ?? 'Failed.');
    } finally {
      setActing(null);
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Assigned Tasks</h1>
        <p>Civic issues assigned to you for field resolution.</p>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      {/* Stats */}
      {stats && (
        <div className="grid-4 mb-4">
          <div className="stat-card"><div className="stat-value">{stats.totalTasks ?? '—'}</div><div className="stat-label">Total Assigned</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--brand-accent)' }}>{stats.inProgress ?? '—'}</div><div className="stat-label">In Progress</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--brand-secondary)' }}>{stats.resolved ?? '—'}</div><div className="stat-label">Resolved</div></div>
          <div className="stat-card"><div className="stat-value">{stats.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : '—'}</div><div className="stat-label">Avg. Resolution</div></div>
        </div>
      )}

      <div className="card">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗂️</div>
            <p>No tasks assigned yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id}>
                    <td style={{ maxWidth: 200 }} className="truncate">
                      {t.description ?? '—'}
                    </td>
                    <td>{t.category ?? '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.assignedAt ? new Date(t.assignedAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/reports/${t._id}`)}
                        >View</button>
                        {t.status === 'ASSIGNED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleStart(t._id)}
                            disabled={acting === t._id}
                          >
                            Start
                          </button>
                        )}
                        {t.status === 'IN_PROGRESS' && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleResolve(t._id)}
                            disabled={acting === t._id}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
