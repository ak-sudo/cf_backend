import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReports, assignWorker, updateReportStatus, listUsers } from '../lib/api';

const STATUS_BADGE = {
  SUBMITTED:'badge-gray', ANALYZING:'badge-blue', PENDING:'badge-yellow',
  ASSIGNED:'badge-purple', IN_PROGRESS:'badge-yellow', RESOLVED:'badge-green',
  CLOSED:'badge-gray', REJECTED:'badge-red',
};

export default function AdminReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [acting, setActing] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const LIMIT = 15;

  async function load(p = page, s = status) {
    setLoading(true);
    try {
      const [rRes, wRes] = await Promise.allSettled([
        listReports({ page: p, limit: LIMIT, ...(s ? { status: s } : {}) }),
        listUsers({ role: 'WORKER', limit: 100 }),
      ]);
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data?.data ?? rRes.value.data;
        setReports(Array.isArray(d) ? d : (d?.reports ?? []));
        setTotal(d?.total ?? 0);
      }
      if (wRes.status === 'fulfilled') {
        const d = wRes.value.data?.data ?? wRes.value.data;
        setWorkers(Array.isArray(d) ? d : (d?.users ?? []));
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(1, status); }, [status]);

  async function handleAssign(reportId, workerId) {
    if (!workerId) return;
    setActing(reportId);
    try {
      await assignWorker(reportId, { workerId });
      setMsg('Worker assigned.');
      await load(page, status);
    } catch (e) {
      setMsg(e.response?.data?.message ?? 'Assignment failed.');
    } finally {
      setActing(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <div className="page-header">
        <h1>Report Management 📋</h1>
        <p>Manage, assign and update all civic issue reports.</p>
      </div>

      {msg && <div className="alert alert-info mb-4">{msg}</div>}

      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div className="flex gap-3 items-center">
          <label className="form-label" style={{ marginBottom: 0 }}>Filter:</label>
          <select
            className="form-control"
            style={{ width: 200 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {['SUBMITTED','ANALYZING','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED']
              .map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No reports found.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Department</th>
                    <th>Submitted</th>
                    <th>Assign Worker</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id}>
                      <td style={{ maxWidth: 180 }} className="truncate">{r.description ?? '—'}</td>
                      <td>{r.category ?? '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>{r.status}</span></td>
                      <td>{r.recommendedDepartment ?? r.department ?? '—'}</td>
                      <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                      <td>
                        {(r.status === 'PENDING' || r.status === 'SUBMITTED') && (
                          <div className="flex gap-2">
                            <select
                              className="form-control"
                              style={{ width: 150 }}
                              defaultValue=""
                              onChange={(e) => handleAssign(r._id, e.target.value)}
                              disabled={acting === r._id}
                            >
                              <option value="">Assign…</option>
                              {workers.map((w) => (
                                <option key={w._id} value={w._id}>
                                  {w.displayName ?? w.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/reports/${r._id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => { setPage(page - 1); load(page - 1, status); }} disabled={page === 1}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={p === page ? 'active' : ''} onClick={() => { setPage(p); load(p, status); }}>{p}</button>
                ))}
                <button onClick={() => { setPage(page + 1); load(page + 1, status); }} disabled={page === totalPages}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
