// Port Registry - Manages port allocation for projects and isolated endpoints
import fs from 'fs';
import path from 'path';
import { 
  REGISTRY_PATH, 
  PROJECT_PORT_START, 
  PROJECT_PORT_END,
  ISOLATED_PORT_START,
  ISOLATED_PORT_END 
} from './config/env';

// Deployment types matching build-service DEPLOYMENT_CONFIGS
export type DeploymentType = 
  | 'vite-react-ts' 
  | 'vite-react' 
  | 'create-react-app' 
  | 'nextjs' 
  | 'static' 
  | 'custom';

export interface ProjectConfig {
  port: number;
  type: DeploymentType;
  status: 'running' | 'stopped' | 'error';
  outputDir: string;
  startCommand?: string;
  isolatedEndpoints: { [path: string]: number };
  createdAt: Date;
  lastAccessedAt?: Date;
}

export interface PortRegistry {
  projects: { [projectId: string]: ProjectConfig };
  nextProjectPort: number;
  nextIsolatedPort: number;
}

// Default registry state
const DEFAULT_REGISTRY: PortRegistry = {
  projects: {},
  nextProjectPort: PROJECT_PORT_START,
  nextIsolatedPort: ISOLATED_PORT_START
};

class PortRegistryManager {
  private registry: PortRegistry;
  private registryPath: string;

  constructor(registryPath: string = REGISTRY_PATH) {
    this.registryPath = registryPath;
    this.registry = this.loadRegistry();
  }

  /**
   * Load registry from file or create default
   */
  private loadRegistry(): PortRegistry {
    try {
      if (fs.existsSync(this.registryPath)) {
        const content = fs.readFileSync(this.registryPath, 'utf-8');
        const parsed = JSON.parse(content);
        console.log(`✅ Loaded port registry with ${Object.keys(parsed.projects || {}).length} projects`);
        return parsed;
      }
    } catch (err: any) {
      console.error(`⚠️ Failed to load port registry: ${err.message}`);
    }
    return { ...DEFAULT_REGISTRY };
  }

  /**
   * Save registry to file
   */
  private saveRegistry(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    } catch (err: any) {
      console.error(`❌ Failed to save port registry: ${err.message}`);
      throw err;
    }
  }

  /**
   * Allocate a port for a new project
   */
  allocatePort(projectId: string, type: DeploymentType, outputDir: string = 'dist'): ProjectConfig {
    // Check if project already exists
    if (this.registry.projects[projectId]) {
      console.log(`♻️ Project ${projectId} already exists, reusing port ${this.registry.projects[projectId].port}`);
      return this.registry.projects[projectId];
    }

    // Check port limit
    if (this.registry.nextProjectPort > PROJECT_PORT_END) {
      throw new Error(`Port limit reached. Maximum ${PROJECT_PORT_END - PROJECT_PORT_START + 1} projects supported.`);
    }

    const port = this.registry.nextProjectPort;
    const config: ProjectConfig = {
      port,
      type,
      status: 'stopped',
      outputDir,
      isolatedEndpoints: {},
      createdAt: new Date()
    };

    this.registry.projects[projectId] = config;
    this.registry.nextProjectPort++;
    this.saveRegistry();

    console.log(`📌 Allocated port ${port} for project ${projectId} (type: ${type})`);
    return config;
  }

  /**
   * Deallocate a project's port
   */
  deallocatePort(projectId: string): boolean {
    if (!this.registry.projects[projectId]) {
      console.warn(`⚠️ Project ${projectId} not found in registry`);
      return false;
    }

    const config = this.registry.projects[projectId];
    
    // Note: We don't reclaim ports to avoid conflicts with running processes
    // Port recycling could be added later with proper process verification
    delete this.registry.projects[projectId];
    this.saveRegistry();

    console.log(`🗑️ Deallocated project ${projectId} (port ${config.port})`);
    return true;
  }

  /**
   * Isolate a high-traffic endpoint to its own port
   */
  isolateEndpoint(projectId: string, endpointPath: string): number {
    const project = this.registry.projects[projectId];
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Check if already isolated
    if (project.isolatedEndpoints[endpointPath]) {
      return project.isolatedEndpoints[endpointPath];
    }

    // Check isolated port limit
    if (this.registry.nextIsolatedPort > ISOLATED_PORT_END) {
      throw new Error(`Isolated port limit reached. Maximum ${ISOLATED_PORT_END - ISOLATED_PORT_START + 1} isolated endpoints.`);
    }

    const isolatedPort = this.registry.nextIsolatedPort;
    project.isolatedEndpoints[endpointPath] = isolatedPort;
    this.registry.nextIsolatedPort++;
    this.saveRegistry();

    console.log(`🔀 Isolated endpoint ${projectId}${endpointPath} to port ${isolatedPort}`);
    return isolatedPort;
  }

  /**
   * Get port for a request (for routing)
   */
  getPortForRequest(projectId: string, requestPath: string = '/'): number | null {
    const project = this.registry.projects[projectId];
    if (!project || project.status !== 'running') {
      return null;
    }

    // Check isolated endpoints (longest match first)
    const sortedEndpoints = Object.keys(project.isolatedEndpoints).sort((a, b) => b.length - a.length);
    for (const endpoint of sortedEndpoints) {
      if (requestPath.startsWith(endpoint)) {
        return project.isolatedEndpoints[endpoint];
      }
    }

    return project.port;
  }

  /**
   * Update project status
   */
  updateStatus(projectId: string, status: 'running' | 'stopped' | 'error'): void {
    if (this.registry.projects[projectId]) {
      this.registry.projects[projectId].status = status;
      if (status === 'running') {
        this.registry.projects[projectId].lastAccessedAt = new Date();
      }
      this.saveRegistry();
    }
  }

  /**
   * Get project configuration
   */
  getProject(projectId: string): ProjectConfig | null {
    return this.registry.projects[projectId] || null;
  }

  /**
   * Get all projects
   */
  getAllProjects(): { [projectId: string]: ProjectConfig } {
    return this.registry.projects;
  }

  /**
   * Get running projects
   */
  getRunningProjects(): string[] {
    return Object.entries(this.registry.projects)
      .filter(([_, config]) => config.status === 'running')
      .map(([projectId, _]) => projectId);
  }
}

// Singleton instance
export const portRegistry = new PortRegistryManager();
export default portRegistry;
