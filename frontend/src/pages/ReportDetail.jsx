import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReportById, updateReportStatus, assignWorker, listUsers } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_BADGE = {
  SUBMITTED:'badge-gray', ANALYZING:'badge-blue', PENDING:'badge-yellow',
  ASSIGNED:'badge-purple', IN_PROGRESS:'badge-yellow', RESOLVED:'badge-green',
  CLOSED:'badge-gray', REJECTED:'badge-red',
};

const ALLOWED_TRANSITIONS = {
  PENDING:      ['ASSIGNED'],
  ASSIGNED:     ['IN_PROGRESS','REJECTED'],
  IN_PROGRESS:  ['RESOLVED','REJECTED'],
  RESOLVED:     ['CLOSED'],
};

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workers, setWorkers] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getReportById(id);
        const d = res.data?.data ?? res.data;
        setReport(d?.report ?? d);
      } catch (err) {
        setError(err.response?.data?.message ?? 'Report not found or access denied.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      listUsers({ role: 'WORKER', limit: 100 })
        .then((r) => {
          const d = r.data?.data ?? r.data;
          setWorkers(Array.isArray(d) ? d : (d?.users ?? []));
        })
        .catch(() => {});
    }
  }, [role]);

  async function handleAssign() {
    if (!assignTo) return;
    setActing(true);
    setActionMsg('');
    try {
      await assignWorker(id, { workerId: assignTo });
      setActionMsg('Worker assigned successfully.');
      const res = await getReportById(id);
      setReport(res.data?.data ?? res.data);
    } catch (e) {
      setActionMsg(e.response?.data?.message ?? 'Assignment failed.');
    } finally {
      setActing(false);
    }
  }

  async function handleStatusChange() {
    if (!newStatus) return;
    setActing(true);
    setActionMsg('');
    try {
      await updateReportStatus(id, { status: newStatus });
      setActionMsg('Status updated.');
      const res = await getReportById(id);
      setReport(res.data?.data ?? res.data);
      setNewStatus('');
    } catch (e) {
      setActionMsg(e.response?.data?.message ?? 'Status update failed.');
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!report) return null;

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isWorker = role === 'WORKER';
  const transitions = ALLOWED_TRANSITIONS[report.status] ?? [];

  return (
    <div style={{ maxWidth: 720 }}>
      <button className="btn btn-outline btn-sm mb-4" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {actionMsg && <div className="alert alert-info">{actionMsg}</div>}

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`badge ${STATUS_BADGE[report.status] ?? 'badge-gray'}`} style={{ fontSize: 13 }}>
            {report.status}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {report.createdAt ? new Date(report.createdAt).toLocaleString() : ''}
          </span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {report.title || report.description}
        </h2>
        {report.title && (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {report.description}
          </p>
        )}

        <div className="grid-2 mt-4">
          <div>
            <div className="form-label">Category</div>
            <div>{report.category ?? '—'}</div>
          </div>
          <div>
            <div className="form-label">Department</div>
            <div>{report.department ?? report.aiAnalysis?.recommendedDepartment ?? '—'}</div>
          </div>
          <div>
            <div className="form-label">Severity</div>
            <div>{report.aiAnalysis?.estimatedSeverity ?? report.severity ?? '—'}</div>
          </div>
          <div>
            <div className="form-label">AI Confidence</div>
            <div>{report.aiAnalysis?.confidence != null
              ? `${(report.aiAnalysis.confidence * 100).toFixed(0)}%`
              : '—'}</div>
          </div>
        </div>

        {report.images?.length > 0 && (
          <div className="mt-4">
            <div className="form-label mb-2">Photo{report.images.length > 1 ? 's' : ''}</div>
            {report.images.map((img, i) => (
              <img
                key={img.publicId || img.url || i}
                src={img.url}
                alt={`Report photo ${i + 1}`}
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
            ))}
          </div>
        )}

        {report.aiAnalysis?.aiReport?.summary && (
          <div className="mt-4" style={{ background: 'var(--surface-raised)', borderRadius: 8, padding: 14 }}>
            <div className="form-label mb-2">🤖 AI Analysis Report</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {report.aiAnalysis.aiReport.summary}
            </p>
            {report.aiAnalysis.aiReport.keyObservations?.length > 0 && (
              <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, marginTop: 8 }}>
                {report.aiAnalysis.aiReport.keyObservations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Admin Actions */}
      {isAdmin && report.status === 'PENDING' && (
        <div className="card mb-4">
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Assign to Worker</h3>
          <div className="flex gap-3 items-center">
            <select
              className="form-control"
              style={{ flex: 1 }}
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              <option value="">Select a worker…</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.displayName ?? w.email}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={handleAssign}
              disabled={acting || !assignTo}
            >
              Assign
            </button>
          </div>
        </div>
      )}

      {/* Status Update – Admin or Worker */}
      {(isAdmin || isWorker) && transitions.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Update Status</h3>
          <div className="flex gap-3 items-center">
            <select
              className="form-control"
              style={{ flex: 1 }}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">Choose new status…</option>
              {transitions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              className="btn btn-success"
              onClick={handleStatusChange}
              disabled={acting || !newStatus}
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
