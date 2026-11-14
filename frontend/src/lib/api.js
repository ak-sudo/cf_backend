import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  try {
    const { getAuth } = await import('firebase/auth');
    const user = getAuth().currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // Request continues without a token; the backend will answer 401.
    console.warn('Could not attach Firebase ID token:', err?.code ?? err?.message);
  }
  return config;
});

// The backend serializes Mongo documents with `id` (toJSON transform) but some
// lean() queries still return `_id`. Give every object both keys so pages can
// rely on either.
function normalizeIds(value) {
  if (Array.isArray(value)) {
    value.forEach(normalizeIds);
  } else if (value && typeof value === 'object') {
    if (value.id !== undefined && value._id === undefined) value._id = value.id;
    else if (value._id !== undefined && value.id === undefined) value.id = value._id;
    Object.values(value).forEach(normalizeIds);
  }
  return value;
}

api.interceptors.response.use((res) => {
  normalizeIds(res.data);
  return res;
});

// ----- Auth -----
// Identity comes only from the Bearer ID token; no body is sent. (Posting the
// Firebase User object would leak its refresh token to the server.)
export const syncUser = () => api.post('/auth/sync');
export const getMe = () => api.get('/auth/me');
export const updateMe = (data) => api.patch('/auth/me', data);

// ----- Users (Admin) -----
export const listUsers = (params) => api.get('/users', { params });
export const getUserById = (id) => api.get(`/users/${id}`);
export const updateUserRole = (id, data) => api.patch(`/users/${id}/role`, data);
export const updateUserStatus = (id, data) => api.patch(`/users/${id}/status`, data);

// ----- Reports -----
export const getUploadSignature = () => api.post('/reports/upload-signature');
export const createReport = (data) => api.post('/reports', data);
export const listReports = (params) => api.get('/reports', { params });
export const getReportById = (id) => api.get(`/reports/${id}`);
export const assignWorker = (id, data) => api.patch(`/reports/${id}/assign`, data);
export const updateReportStatus = (id, data) => api.patch(`/reports/${id}/status`, data);

// ----- Rewards -----
export const getRewardsCatalog = () => api.get('/rewards/catalog');
export const getWallet = () => api.get('/rewards/wallet');
export const getRewardHistory = (params) => api.get('/rewards/history', { params });
// idempotencyKey: one per user-initiated redemption, so retries/double-clicks can't double-spend.
// Sent in the body (not an Idempotency-Key header) so it needs no extra CORS allow-listing.
export const redeemReward = ({ rewardItemId, idempotencyKey }) =>
  api.post('/rewards/redeem', { rewardItemId, idempotencyKey });
// SUPER_ADMIN only
export const listAdminRewardItems = (params) => api.get('/rewards/admin/items', { params });
export const createRewardItem = (data) => api.post('/rewards/admin/items', data);
export const updateRewardItem = (id, data) => api.patch(`/rewards/admin/items/${id}`, data);
export const seedDummyRewards = () => api.post('/rewards/admin/seed');

// ----- Citizen Dashboard -----
export const getCitizenDashboard = () => api.get('/citizen/dashboard');

// ----- Worker -----
export const listWorkerTasks = (params) => api.get('/worker/tasks', { params });
export const getWorkerStats = () => api.get('/worker/stats');
export const getTaskDetails = (id) => api.get(`/worker/tasks/${id}`);
export const startTask = (id) => api.patch(`/worker/tasks/${id}/start`);
export const resolveTask = (id, data) => api.patch(`/worker/tasks/${id}/resolve`, data);

// ----- Analytics -----
export const getAnalyticsOverview = (params) => api.get('/analytics/overview', { params });
export const getCategoryBreakdown = (params) => api.get('/analytics/by-category', { params });
export const getHeatmap = (params) => api.get('/analytics/heatmap', { params });
export const getWorkerLeaderboard = () => api.get('/analytics/workers');

// ----- Notifications -----
export const listNotifications = (params) => api.get('/notifications', { params });
export const getActivityStream = () => api.get('/notifications/stream');
export const markAllRead = () => api.patch('/notifications/read-all');
export const markOneRead = (id) => api.patch(`/notifications/${id}/read`);

// ----- Audit -----
export const getAuditLog = (params) => api.get('/audit', { params });

// ----- Health -----
export const getLiveness = () => api.get('/health/liveness');
export const getReadiness = () => api.get('/health/readiness');

export default api;
