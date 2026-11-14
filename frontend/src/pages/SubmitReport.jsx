import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUploadSignature, createReport } from '../lib/api';

// Must match backend ISSUE_CATEGORIES (anything else is rejected with 422)
const CATEGORIES = [
  'GARBAGE', 'POTHOLE', 'BROKEN_INFRASTRUCTURE', 'ANIMAL_CARCASS',
  'GRAFFITI', 'DAMAGED_SIGNBOARD', 'WATER_LEAKAGE', 'OTHER',
];

async function cloudinaryUpload(file, signature) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signature.apiKey);
  formData.append('timestamp', signature.timestamp);
  formData.append('signature', signature.signature);
  // Every param the backend signed must be sent, or Cloudinary answers 401 Invalid Signature
  formData.append('folder', signature.folder);
  if (signature.tags) formData.append('tags', signature.tags);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Cloudinary upload error:', res.status, data);
    throw new Error(`Image upload failed: ${data?.error?.message ?? res.statusText}`);
  }
  return { publicId: data.public_id, url: data.secure_url };
}

export default function SubmitReport() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    latitude: '',
    longitude: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setForm((f) => ({
        ...f,
        latitude: coords.latitude.toFixed(6),
        longitude: coords.longitude.toFixed(6),
      }));
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!imageFile) throw new Error('Please attach a photo of the issue.');

      // 1 — Get Cloudinary upload signature from backend, then upload directly
      const sigRes = await getUploadSignature();
      const sig = sigRes.data?.data ?? sigRes.data;
      const image = await cloudinaryUpload(imageFile, sig);

      // 2 — Submit report (shape must match backend createReportSchema)
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category || undefined,
        coordinates: [
          parseFloat(form.longitude) || 0,
          parseFloat(form.latitude) || 0,
        ],
        images: [image],
      };

      const res = await createReport(payload);
      const d = res.data?.data ?? res.data;
      const created = d?.report ?? d;
      setSuccess('Report submitted successfully! Our AI will analyze it shortly.');
      setTimeout(() => navigate(`/reports/${created._id ?? ''}`), 1800);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? 'Submission failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1>Submit a Civic Issue</h1>
        <p>Describe the problem and our AI will classify it and route it to the right department.</p>
      </div>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              className="form-control"
              required
              minLength={5}
              maxLength={150}
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Large pothole near the market"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              className="form-control"
              rows={4}
              required
              minLength={10}
              value={form.description}
              onChange={set('description')}
              placeholder="Describe the civic issue in detail…"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category (optional — AI will classify if blank)</label>
            <select className="form-control" value={form.category} onChange={set('category')}>
              <option value="">Let AI classify</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Photo Evidence *</label>
            {preview && (
              <img
                src={preview}
                alt="preview"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={handleFile}
              className="form-control"
              style={{ padding: '7px' }}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input
                className="form-control"
                type="number"
                step="any"
                value={form.latitude}
                onChange={set('latitude')}
                placeholder="e.g. 28.6139"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input
                className="form-control"
                type="number"
                step="any"
                value={form.longitude}
                onChange={set('longitude')}
                placeholder="e.g. 77.2090"
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm mb-4"
            onClick={useCurrentLocation}
          >
            📍 Use my current location
          </button>

          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting…' : '🚀 Submit Report'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/reports')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
