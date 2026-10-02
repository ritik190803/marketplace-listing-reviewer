import axios from 'axios';

const baseURL = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api`;

// 90s: covers a cold-starting server plus a slow AI analysis
const api = axios.create({ baseURL, timeout: 90000 });

/** Turns any Axios error into { message, code, details } for display. */
export function errorInfo(err) {
  const apiError = err?.response?.data?.error;
  if (apiError) {
    return { message: apiError.message, code: apiError.code, details: apiError.details || null };
  }
  if (err?.code === 'ECONNABORTED') {
    return { message: 'The request timed out. The server may be waking up; please try again.', code: 'TIMEOUT', details: null };
  }
  if (!err?.response) {
    return { message: 'Cannot reach the server. Check your connection and try again.', code: 'NETWORK', details: null };
  }
  return { message: `Unexpected error (HTTP ${err.response.status}).`, code: 'UNKNOWN', details: null };
}

export const listingsApi = {
  queue: (status) => api.get('/listings', { params: status ? { status } : {} }).then((r) => r.data.items),
  detail: (id) => api.get(`/listings/${id}`).then((r) => r.data),
  create: (body) => api.post('/listings', body).then((r) => r.data),
  analyze: (id) => api.post(`/listings/${id}/analyze`).then((r) => r.data),
  decide: (id, findingId, body) => api.post(`/listings/${id}/findings/${findingId}/decision`, body).then((r) => r.data),
  approve: (id, body) => api.post(`/listings/${id}/approve`, body).then((r) => r.data),
  reject: (id, body) => api.post(`/listings/${id}/reject`, body).then((r) => r.data),
};