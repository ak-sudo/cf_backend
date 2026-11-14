import React, { useEffect, useRef, useState } from 'react';
import { getWallet, getRewardsCatalog, getRewardHistory, redeemReward, seedDummyRewards } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_META = {
  PUBLIC_TRANSIT:   { icon: '🚇', label: 'Public Transit',  badge: 'badge-blue' },
  UTILITY_DISCOUNT: { icon: '💡', label: 'Utility Discount', badge: 'badge-yellow' },
  ENVIRONMENT:      { icon: '🌱', label: 'Environment',      badge: 'badge-green' },
  COMMUNITY:        { icon: '🤝', label: 'Community',        badge: 'badge-purple' },
};

const TX_LABELS = {
  EARNED_REPORT_RESOLVED: 'Report resolved',
  BONUS_HIGH_SEVERITY: 'Severity bonus',
  REWARD_REDEMPTION: 'Redemption',
  ADMIN_ADJUSTMENT: 'Adjustment',
};

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

export default function Rewards() {
  const { role } = useAuth();
  const isCitizen = role === 'CITIZEN';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [wallet, setWallet] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [voucher, setVoucher] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [redeemingId, setRedeemingId] = useState(null);
  const [seeding, setSeeding] = useState(false);
  // One key per confirmed redemption attempt; reused if that same attempt is retried
  const pendingKey = useRef(null);

  async function reload() {
    const [wRes, cRes, hRes] = await Promise.allSettled([
      getWallet(), getRewardsCatalog(), getRewardHistory({ limit: 20 }),
    ]);
    if (wRes.status === 'fulfilled') setWallet(unwrap(wRes.value));
    if (cRes.status === 'fulfilled') {
      const d = unwrap(cRes.value);
      setCatalog(Array.isArray(d) ? d : (d?.items ?? []));
    }
    if (hRes.status === 'fulfilled') {
      const d = unwrap(hRes.value);
      setHistory(Array.isArray(d) ? d : (d?.transactions ?? []));
    }
    if (cRes.status === 'rejected') {
      setMsg({ type: 'error', text: cRes.reason?.response?.data?.message ?? 'Failed to load rewards catalog.' });
    }
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  function startConfirm(itemId) {
    setConfirmingId(itemId);
    pendingKey.current = newIdempotencyKey();
    setMsg({ type: '', text: '' });
    setVoucher(null);
  }

  async function handleRedeem(item) {
    if (redeemingId) return; // guard against double submission
    setRedeemingId(item.id);
    setMsg({ type: '', text: '' });
    try {
      const res = await redeemReward({ rewardItemId: item.id, idempotencyKey: pendingKey.current });
      const receipt = unwrap(res);
      setVoucher(receipt);
      setMsg({ type: 'success', text: res.data?.message ?? 'Reward redeemed successfully!' });
      setConfirmingId(null);
      pendingKey.current = null;
      await reload();
    } catch (e) {
      console.error('Redemption failed:', e);
      setMsg({
        type: 'error',
        text: e.response
          ? (e.response.data?.message ?? `Redemption failed (HTTP ${e.response.status}).`)
          : 'Could not reach the server (network/CORS error). Check that the backend is running and try again.',
      });
      // Keep the same key only for network failures (the server may have processed it)
      if (e.response) pendingKey.current = newIdempotencyKey();
    } finally {
      setRedeemingId(null);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await seedDummyRewards();
      setMsg({ type: 'success', text: res.data?.message ?? 'Dummy rewards initialized.' });
      await reload();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.message ?? 'Failed to initialize rewards.' });
    } finally {
      setSeeding(false);
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  const balance = wallet?.balance ?? 0;

  return (
    <div>
      <div className="page-header">
        <h1>Rewards & EcoCoins 🪙</h1>
        <p>Earn EcoCoins when your reports are resolved and redeem them for civic perks.</p>
      </div>

      {msg.text && (
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`}>
          {msg.text}
          {voucher?.voucherCode && (
            <div style={{ marginTop: 8 }}>
              Voucher for <strong>{voucher.rewardTitle}</strong>:{' '}
              <code style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>{voucher.voucherCode}</code>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Present this code to {voucher.partnerName}. It is also saved in your transaction history.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wallet */}
      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-value">{balance}</div>
          <div className="stat-label">EcoCoins Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--brand-secondary)' }}>
            {wallet?.totalEarned ?? 0}
          </div>
          <div className="stat-label">Total Earned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--brand-danger)' }}>
            {wallet?.totalSpent ?? 0}
          </div>
          <div className="stat-label">Total Redeemed</div>
        </div>
      </div>

      {/* Catalog */}
      <div className="card mb-4">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Available Rewards</h2>
        {catalog.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏷️</div>
            <p>No rewards available yet.</p>
            {isSuperAdmin && (
              <button className="btn btn-primary btn-sm mt-4" onClick={handleSeed} disabled={seeding}>
                {seeding ? 'Initializing…' : 'Initialize dummy rewards'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid-3">
            {catalog.map((item) => {
              const meta = CATEGORY_META[item.category] ?? { icon: '🎁', label: item.category, badge: 'badge-gray' };
              const outOfStock = item.stock === 0;
              const affordable = balance >= item.costCoins;
              const isConfirming = confirmingId === item.id;
              const isRedeeming = redeemingId === item.id;

              return (
                <div key={item.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 30 }}>{meta.icon}</span>
                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{item.partnerName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, flex: 1 }}>
                    {item.description}
                  </div>
                  {item.terms && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{item.terms}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {item.stock === -1 ? 'Unlimited availability' : outOfStock ? 'Out of stock' : `${item.stock} left`}
                  </div>

                  <div className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>🪙 {item.costCoins}</span>

                    {isCitizen && !isConfirming && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => startConfirm(item.id)}
                        disabled={Boolean(redeemingId) || outOfStock || !affordable}
                        title={!affordable ? `You need ${item.costCoins - balance} more EcoCoins` : undefined}
                      >
                        {outOfStock ? 'Sold out' : 'Redeem'}
                      </button>
                    )}

                    {isCitizen && isConfirming && (
                      <div className="flex" style={{ gap: 6 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setConfirmingId(null)}
                          disabled={isRedeeming}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleRedeem(item)}
                          disabled={isRedeeming}
                        >
                          {isRedeeming ? 'Redeeming…' : `Confirm`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isCitizen && catalog.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Rewards can only be redeemed from citizen accounts.
          </p>
        )}
      </div>

      {/* Transaction history */}
      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Transaction History</h2>
        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>No transactions yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Voucher</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => {
                  const credit = tx.amount > 0;
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className={`badge ${credit ? 'badge-green' : 'badge-red'}`}>
                          {TX_LABELS[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: credit ? 'var(--brand-secondary)' : 'var(--brand-danger)' }}>
                        {credit ? '+' : '−'}{Math.abs(tx.amount)}
                      </td>
                      <td>{tx.description ?? '—'}</td>
                      <td>{tx.metadata?.voucherCode ? <code>{tx.metadata.voucherCode}</code> : '—'}</td>
                      <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
