import axios from 'axios';

// Base REST API configuration for api.zotdor.uz
export const API_BASE_URL = 'https://api.zotdor.uz/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to attach JWT token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('zotdor_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for graceful error handling & mock fallback
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.warn('[Zotdor API] Remote backend unavailable, falling back to mock mode.', error.message);
    return Promise.reject(error);
  }
);
