

export interface Deployment {
  projectId: string;
  repoUrl: string;
  repoName: string;
  createdAt: number;
}

export const deployments = new Map<string, Deployment>();


