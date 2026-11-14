import React, { useEffect, useState } from 'react';
import {
  getAnalyticsOverview,
  getCategoryBreakdown,
  getHeatmap,
  getWorkerLeaderboard,
} from '../lib/api';

function BarChart({ data, labelKey, valueKey, color = 'var(--brand-primary)' }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No data.</p>;
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
            {String(item[labelKey] ?? '').replace(/_/g, ' ')}
          </div>
          <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 20, overflow: 'hidden' }}>
            <div
              style={{
                width: `${((item[valueKey] ?? 0) / max) * 100}%`,
                background: color,
                height: '100%',
                borderRadius: 4,
                transition: 'width .4s',
              }}
            />
          </div>
          <div style={{ width: 30, fontSize: 12, fontWeight: 700 }}>{item[valueKey]}</div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState('');

  async function load(d = dept) {
    setLoading(true);
    const params = d ? { department: d } : {};
    try {
      const [oRes, cRes, lRes] = await Promise.allSettled([
        getAnalyticsOverview(params),
        getCategoryBreakdown(params),
        getWorkerLeaderboard(),
      ]);
      if (oRes.status === 'fulfilled') setOverview(oRes.value.data?.data ?? oRes.value.data);
      if (cRes.status === 'fulfilled') {
        const d2 = cRes.value.data?.data ?? cRes.value.data;
        setCategories(Array.isArray(d2) ? d2 : []);
      }
      if (lRes.status === 'fulfilled') {
        const d3 = lRes.value.data?.data ?? lRes.value.data;
        setLeaderboard(Array.isArray(d3) ? d3 : []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Analytics Dashboard 📊</h1>
        <p>Operational overview, SLA metrics and worker performance.</p>
      </div>

      {/* KPI strip */}
      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-value">{overview?.totalReports ?? '—'}</div>
          <div className="stat-label">Total Reports</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--brand-secondary)' }}>
            {overview?.resolvedReports ?? '—'}
          </div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--brand-accent)' }}>
            {overview?.pendingReports ?? '—'}
          </div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {overview?.avgResolutionHours != null ? `${overview.avgResolutionHours}h` : '—'}
          </div>
          <div className="stat-label">Avg. Resolution</div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Category breakdown */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Reports by Category</h2>
          <BarChart
            data={categories}
            labelKey="_id"
            valueKey="count"
            color="var(--brand-primary)"
          />
        </div>

        {/* Worker leaderboard */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Worker Leaderboard 🏆</h2>
          {leaderboard.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No data.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Worker</th>
                    <th>Resolved</th>
                    <th>Avg (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 10).map((w, i) => (
                    <tr key={w._id ?? i}>
                      <td style={{ fontWeight: 700, color: i < 3 ? 'var(--brand-accent)' : undefined }}>
                        {i + 1}
                      </td>
                      <td>{w.name ?? w.email ?? w._id}</td>
                      <td>{w.resolved ?? w.resolvedCount ?? '—'}</td>
                      <td>{w.avgHours ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
