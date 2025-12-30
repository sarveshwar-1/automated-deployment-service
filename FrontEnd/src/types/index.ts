// Auth Types
export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  gitUrl: string;
  status: 'idle' | 'deploying' | 'deployed' | 'failed';
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  gitUrl: string;
}

export interface CreateProjectResponse {
  project: Project;
}

export interface GetProjectsResponse {
  projects: Project[];
}

// Error Response Type
export interface ErrorResponse {
  message: string;
  status: number;
  details?: Record<string, string>;
}
