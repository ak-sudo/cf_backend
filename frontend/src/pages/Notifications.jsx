import React, { useEffect, useState } from 'react';
import { listNotifications, getActivityStream, markAllRead, markOneRead } from '../lib/api';

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [stream, setStream] = useState([]);
  const [tab, setTab] = useState('notifications');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function loadNotifs() {
    try {
      const res = await listNotifications({ limit: 50 });
      const d = res.data?.data ?? res.data;
      setNotifs(Array.isArray(d) ? d : (d?.notifications ?? []));
    } catch {}
  }

  async function loadStream() {
    try {
      const res = await getActivityStream();
      const d = res.data?.data ?? res.data;
      setStream(Array.isArray(d) ? d : []);
    } catch {}
  }

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([loadNotifs(), loadStream()]).finally(() => setLoading(false));
  }, []);

  async function handleMarkAll() {
    setMarking(true);
    try {
      await markAllRead();
      await loadNotifs();
    } catch {} finally {
      setMarking(false);
    }
  }

  async function handleMarkOne(id) {
    try {
      await markOneRead(id);
      setNotifs((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    } catch {}
  }

  const unread = notifs.filter((n) => !n.isRead).length;

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Notifications {unread > 0 && <span className="badge badge-red" style={{ fontSize: 13 }}>{unread}</span>}</h1>
          <p>Your activity and system notifications.</p>
        </div>
        {unread > 0 && (
          <button className="btn btn-outline" onClick={handleMarkAll} disabled={marking}>
            ✓ Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['notifications', 'activity'].map((t) => (
          <button
            key={t}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(t)}
          >
            {t === 'notifications' ? '🔔 Notifications' : '📜 Activity Stream'}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <div className="card">
          {notifs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔕</div>
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div>
              {notifs.map((n) => (
                <div
                  key={n._id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border)',
                    opacity: n.isRead ? 0.65 : 1,
                  }}
                >
                  <div style={{ fontSize: 24, minWidth: 32, textAlign: 'center' }}>
                    {n.type === 'REPORT_ANALYZED'    ? '🤖'
                     : n.type === 'REPORT_ASSIGNED'  ? '📌'
                     : n.type === 'REPORT_RESOLVED'  ? '✅'
                     : '🔔'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.isRead ? 400 : 600 }}>{n.title ?? n.type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {n.message ?? n.body}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleMarkOne(n._id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card">
          {stream.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <p>No activity yet.</p>
            </div>
          ) : (
            <div>
              {stream.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', minWidth: 90, fontSize: 11 }}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                  </div>
                  <div>{item.message ?? JSON.stringify(item)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
