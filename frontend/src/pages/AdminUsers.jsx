import React, { useEffect, useState } from 'react';
import { listUsers, updateUserRole, updateUserStatus } from '../lib/api';

const ROLES = ['CITIZEN', 'WORKER', 'ADMIN', 'SUPER_ADMIN'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterRole, setFilterRole] = useState('');
  const [msg, setMsg] = useState('');
  const [acting, setActing] = useState(null);
  const LIMIT = 15;

  async function load(p = page, r = filterRole) {
    setLoading(true);
    try {
      const res = await listUsers({ page: p, limit: LIMIT, ...(r ? { role: r } : {}) });
      const d = res.data?.data ?? res.data;
      setUsers(Array.isArray(d) ? d : (d?.users ?? []));
      setTotal(d?.total ?? 0);
    } catch {
      setMsg('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, filterRole); }, [filterRole]);

  async function handleRoleChange(userId, role) {
    setActing(userId);
    try {
      await updateUserRole(userId, { role });
      setMsg(`Role updated to ${role}.`);
      await load(page, filterRole);
    } catch (e) {
      setMsg(e.response?.data?.message ?? 'Role update failed.');
    } finally {
      setActing(null);
    }
  }

  async function handleToggleStatus(userId, currentActive) {
    setActing(userId);
    try {
      await updateUserStatus(userId, { isActive: !currentActive });
      setMsg('User status updated.');
      await load(page, filterRole);
    } catch (e) {
      setMsg(e.response?.data?.message ?? 'Status update failed.');
    } finally {
      setActing(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <div className="page-header">
        <h1>User Management 👥</h1>
        <p>View, assign roles and manage user accounts.</p>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div className="flex gap-3 items-center">
          <label className="form-label" style={{ marginBottom: 0 }}>Filter by role:</label>
          <select
            className="form-control"
            style={{ width: 180 }}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <p>No users found.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name / Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Change Role</th>
                    <th>Toggle</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.displayName ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.email}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          u.role === 'SUPER_ADMIN' ? 'badge-purple'
                          : u.role === 'ADMIN'     ? 'badge-blue'
                          : u.role === 'WORKER'    ? 'badge-yellow'
                          : 'badge-gray'
                        }`}>{u.role}</span>
                      </td>
                      <td>{u.department ?? '—'}</td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <select
                          className="form-control"
                          style={{ width: 140 }}
                          value={u.role}
                          disabled={acting === u._id}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => handleToggleStatus(u._id, u.isActive)}
                          disabled={acting === u._id}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => { setPage(page - 1); load(page - 1, filterRole); }} disabled={page === 1}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={p === page ? 'active' : ''} onClick={() => { setPage(p); load(p, filterRole); }}>{p}</button>
                ))}
                <button onClick={() => { setPage(page + 1); load(page + 1, filterRole); }} disabled={page === totalPages}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
