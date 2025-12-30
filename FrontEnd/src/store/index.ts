import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  gitUrl: string;
  status: 'idle' | 'deploying' | 'deployed' | 'failed';
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

interface ProjectStore {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  setSelectedProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateProjectStatus: (projectId: string, status: Project['status']) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, error: null });
  },
}));

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
    })),
  setSelectedProject: (project) => set({ selectedProject: project }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  updateProjectStatus: (projectId, status) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, status } : p
      ),
    })),
}));
