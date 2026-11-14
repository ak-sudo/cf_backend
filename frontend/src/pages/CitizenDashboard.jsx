import React, { useEffect, useState } from 'react';
import { getCitizenDashboard, listReports, getWallet } from '../lib/api';

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : {}}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function statusBadge(s) {
  const map = {
    SUBMITTED: 'badge-gray', ANALYZING: 'badge-blue', PENDING: 'badge-yellow',
    ASSIGNED: 'badge-purple', IN_PROGRESS: 'badge-yellow', RESOLVED: 'badge-green',
    CLOSED: 'badge-gray', REJECTED: 'badge-red',
  };
  return <span className={`badge ${map[s] ?? 'badge-gray'}`}>{s}</span>;
}

export default function CitizenDashboard() {
  const [dash, setDash] = useState(null);
  const [reports, setReports] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [dRes, rRes, wRes] = await Promise.allSettled([
          getCitizenDashboard(),
          listReports({ limit: 5 }),
          getWallet(),
        ]);
        if (dRes.status === 'fulfilled') setDash(dRes.value.data?.data ?? dRes.value.data);
        if (rRes.status === 'fulfilled') {
          const d = rRes.value.data?.data ?? rRes.value.data;
          setReports(Array.isArray(d) ? d : (d?.reports ?? []));
        }
        if (wRes.status === 'fulfilled') setWallet(wRes.value.data?.data ?? wRes.value.data);
      } catch (err) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back 👋</h1>
        <p>Here's what's happening with your civic reports.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-4 mb-4">
        <StatCard label="Total Reports"    value={dash?.totalReports ?? reports.length} />
        <StatCard label="Resolved"         value={dash?.resolvedReports} color="var(--brand-secondary)" />
        <StatCard label="Pending"          value={dash?.pendingReports}  color="var(--brand-accent)" />
        <StatCard label="EcoCoins Balance" value={wallet?.balance ?? '—'} color="var(--brand-primary)" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Recent Reports</h2>
          <a href="/reports" className="btn btn-outline btn-sm">View all →</a>
        </div>
        {reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No reports yet. <a href="/reports/new" style={{ color: 'var(--brand-primary)' }}>Submit your first report →</a></p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <a href={`/reports/${r._id}`} style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                        {r.title ?? r.description?.slice(0, 40)}
                      </a>
                    </td>
                    <td>{r.category ?? '—'}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
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
