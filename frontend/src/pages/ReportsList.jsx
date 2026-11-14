import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReports } from '../lib/api';

const STATUS_BADGE = {
  SUBMITTED:'badge-gray', ANALYZING:'badge-blue', PENDING:'badge-yellow',
  ASSIGNED:'badge-purple', IN_PROGRESS:'badge-yellow', RESOLVED:'badge-green',
  CLOSED:'badge-gray', REJECTED:'badge-red',
};

export default function ReportsList() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const LIMIT = 10;

  async function load(p = page, s = status) {
    setLoading(true);
    try {
      const res = await listReports({ page: p, limit: LIMIT, ...(s ? { status: s } : {}) });
      const d = res.data?.data ?? res.data;
      setReports(Array.isArray(d) ? d : (d?.reports ?? []));
      setTotal(res.data?.meta?.total ?? d?.total ?? 0);
    } catch {
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, status); }, [status]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function goPage(p) {
    setPage(p);
    load(p, status);
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Reports</h1>
          <p>All civic issue reports you've submitted.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/reports/new')}>
          ➕ Submit Report
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-3">
          <label className="form-label" style={{ marginBottom: 0 }}>Filter by status:</label>
          <select
            className="form-control"
            style={{ width: 180 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {['SUBMITTED','ANALYZING','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED']
              .map(s => <option key={s} value={s}>{s}</option>)}
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id}>
                      <td style={{ maxWidth: 220 }} className="truncate">
                        {r.description ?? '—'}
                      </td>
                      <td>{r.category ?? '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-gray'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.recommendedDepartment ?? r.department ?? '—'}</td>
                      <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
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
                <button onClick={() => goPage(page - 1)} disabled={page === 1}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={p === page ? 'active' : ''}
                    onClick={() => goPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button onClick={() => goPage(page + 1)} disabled={page === totalPages}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
