import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  signup: (email: string, password: string, name: string) =>
    apiClient.post('signup', { email, password, name }),
  signin: (email: string, password: string) =>
    apiClient.post('signin', { email, password }),
  getProfile: () => apiClient.get('profile'),
};

export const projectAPI = {
  createProject: (name: string, gitUrl: string) =>
    apiClient.post('/projects', { name, gitUrl }),
  getProjects: () =>
    apiClient.get('/projects'),
  getProject: (id: string) =>
    apiClient.get(`/projects/${id}`),
  deleteProject: (id: string) =>
    apiClient.delete(`/projects/${id}`),
  deployProject: (id: string) =>
    apiClient.post(`/projects/${id}/deploy`, {}),
};

export default apiClient;
