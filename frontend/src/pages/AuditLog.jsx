import React, { useEffect, useState } from 'react';
import { getAuditLog } from '../lib/api';

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await getAuditLog({ page: p, limit: LIMIT });
      const d = res.data?.data ?? res.data;
      setEntries(Array.isArray(d) ? d : (d?.entries ?? []));
      setTotal(d?.total ?? 0);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(1); }, []);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <div className="page-header">
        <h1>System Audit Log 🔍</h1>
        <p>Immutable log of all privileged actions. Super Admin only.</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>No audit entries found.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e._id ?? i}>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{e.actorEmail ?? e.actor ?? '—'}</div>
                        {e.actorRole && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.actorRole}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-blue">{e.action}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>{e.targetId ?? e.target ?? '—'}</td>
                      <td style={{ fontSize: 11, maxWidth: 220, color: 'var(--text-secondary)' }}>
                        {e.details ? JSON.stringify(e.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => { setPage(page - 1); load(page - 1); }} disabled={page === 1}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={p === page ? 'active' : ''} onClick={() => { setPage(p); load(p); }}>{p}</button>
                ))}
                <button onClick={() => { setPage(page + 1); load(page + 1); }} disabled={page === totalPages}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
