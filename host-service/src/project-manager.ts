// Project Manager - Manages project server lifecycle using PM2
import pm2 from 'pm2';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { portRegistry, DeploymentType, ProjectConfig } from './port-registry';
import { PROJECTS_PATH } from './config/env';
import { minioClient, BUCKETS } from './minio';

// Promisify PM2 methods
const pm2Connect = promisify(pm2.connect.bind(pm2));
const pm2Start = promisify(pm2.start.bind(pm2));
const pm2Stop = promisify(pm2.stop.bind(pm2));
const pm2Delete = promisify(pm2.delete.bind(pm2));
const pm2List = promisify(pm2.list.bind(pm2));
const pm2Restart = promisify(pm2.restart.bind(pm2));

// Deployment type configurations (matching build-service)
interface DeploymentConfig {
  startCommand: string;
  outputDir: string;
  needsNpmStart: boolean;
}

const DEPLOYMENT_CONFIGS: Record<DeploymentType, DeploymentConfig> = {
  'vite-react-ts': {
    startCommand: 'node server.js',  // We'll create a static server
    outputDir: 'dist',
    needsNpmStart: false,
  },
  'vite-react': {
    startCommand: 'node server.js',
    outputDir: 'dist',
    needsNpmStart: false,
  },
  'create-react-app': {
    startCommand: 'node server.js',
    outputDir: 'build',
    needsNpmStart: false,
  },
  'nextjs': {
    startCommand: 'npm start',
    outputDir: '.next',
    needsNpmStart: true,
  },
  'static': {
    startCommand: 'node server.js',
    outputDir: '.',
    needsNpmStart: false,
  },
  'custom': {
    startCommand: 'npm start',
    outputDir: 'dist',
    needsNpmStart: true,
  },
};

// Static server template for serving built files
const STATIC_SERVER_TEMPLATE = `
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PROJECT_DIR = process.env.PROJECT_DIR || __dirname;

// Serve static files
app.use(express.static(PROJECT_DIR));

// SPA fallback - middleware for all non-file routes
app.use((req, res) => {
  const indexPath = path.join(PROJECT_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

app.listen(PORT, () => {
  console.log('Project server running on port ' + PORT);
});
`;

class ProjectManager {
  private connected: boolean = false;

  /**
   * Connect to PM2 daemon
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    await pm2Connect();
    this.connected = true;
    console.log('✅ Connected to PM2 daemon');
  }

  /**
   * Download project files from MinIO
   */
  private async downloadProject(projectId: string, localPath: string): Promise<void> {
    console.log(`📥 Downloading project ${projectId} from MinIO...`);

    // Create directory
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    // List and download all objects for this project
    const objectsStream = minioClient.listObjects(BUCKETS.STATIC_BUILDS, `${projectId}/`, true);
    
    const objectsToDownload: { objectName: string; localFilePath: string }[] = [];

    for await (const obj of objectsStream) {
      if (!obj.name) continue;
      
      const relativePath = obj.name.replace(`${projectId}/`, '');
      const localFilePath = path.join(localPath, relativePath);
      
      // Create directory structure
      const fileDir = path.dirname(localFilePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      
      objectsToDownload.push({ objectName: obj.name, localFilePath });
    }

    console.log(`📦 Found ${objectsToDownload.length} files to download`);

    for (const { objectName, localFilePath } of objectsToDownload) {
      await minioClient.fGetObject(BUCKETS.STATIC_BUILDS, objectName, localFilePath);
    }

    console.log(`✅ Downloaded project ${projectId} to ${localPath}`);
  }

  /**
   * Create static server script for non-Node projects
   */
  private createStaticServer(projectPath: string): void {
    const serverPath = path.join(projectPath, 'server.js');
    fs.writeFileSync(serverPath, STATIC_SERVER_TEMPLATE);
    console.log(`📝 Created static server at ${serverPath}`);
  }

  /**
   * Start a project server
   */
  async startProject(projectId: string, type: DeploymentType, outputDir?: string): Promise<ProjectConfig> {
    await this.connect();

    const config = DEPLOYMENT_CONFIGS[type];
    const effectiveOutputDir = outputDir || config.outputDir;

    // Allocate port
    const projectConfig = portRegistry.allocatePort(projectId, type, effectiveOutputDir);
    const projectPath = path.join(PROJECTS_PATH, projectId);

    try {
      // Download project files from MinIO
      await this.downloadProject(projectId, projectPath);

      // For static builds, create a server script
      if (!config.needsNpmStart) {
        this.createStaticServer(projectPath);
      } else {
        // For dynamic apps, ensure node_modules exists
        const nodeModulesPath = path.join(projectPath, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
          console.log(`📦 Installing dependencies for ${projectId}...`);
          const { exec } = require('child_process');
          await new Promise<void>((resolve, reject) => {
            exec('npm install --production', { cwd: projectPath }, (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }

      // Get PM2 process name
      const processName = `project-${projectId}`;

      // Check if already running
      const list = await pm2List() as any[];
      const existing = list.find(p => p.name === processName);
      if (existing && existing.pm2_env?.status === 'online') {
        console.log(`♻️ Project ${projectId} already running on port ${projectConfig.port}`);
        portRegistry.updateStatus(projectId, 'running');
        return projectConfig;
      }

      // Start the process
      await pm2Start({
        name: processName,
        script: config.needsNpmStart ? 'npm' : 'server.js',
        args: config.needsNpmStart ? ['start'] : undefined,
        cwd: projectPath,
        env: {
          PORT: projectConfig.port.toString(),
          PROJECT_DIR: projectPath,
          NODE_ENV: 'production',
        },
        max_memory_restart: '200M',
        autorestart: true,
      } as any);

      portRegistry.updateStatus(projectId, 'running');
      console.log(`🚀 Started project ${projectId} on port ${projectConfig.port}`);

      return projectConfig;

    } catch (err: any) {
      console.error(`❌ Failed to start project ${projectId}: ${err.message}`);
      portRegistry.updateStatus(projectId, 'error');
      throw err;
    }
  }

  /**
   * Stop a project server
   */
  async stopProject(projectId: string): Promise<void> {
    await this.connect();

    const processName = `project-${projectId}`;

    try {
      await pm2Stop(processName);
      portRegistry.updateStatus(projectId, 'stopped');
      console.log(`⏹️ Stopped project ${projectId}`);
    } catch (err: any) {
      console.warn(`⚠️ Failed to stop project ${projectId}: ${err.message}`);
    }
  }

  /**
   * Restart a project (e.g., after redeploy)
   */
  async restartProject(projectId: string): Promise<void> {
    await this.connect();

    const project = portRegistry.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found in registry`);
    }

    const processName = `project-${projectId}`;
    const projectPath = path.join(PROJECTS_PATH, projectId);

    // Re-download files from MinIO
    await this.downloadProject(projectId, projectPath);

    try {
      await pm2Restart(processName);
      portRegistry.updateStatus(projectId, 'running');
      console.log(`🔄 Restarted project ${projectId}`);
    } catch (err: any) {
      // If restart fails, try full start
      console.log(`⚠️ Restart failed, attempting full start...`);
      await this.startProject(projectId, project.type, project.outputDir);
    }
  }

  /**
   * Delete a project completely
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.connect();

    const processName = `project-${projectId}`;
    const projectPath = path.join(PROJECTS_PATH, projectId);

    try {
      await pm2Delete(processName);
    } catch (err) {
      // Ignore if not found
    }

    // Remove project files
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    // Deallocate port
    portRegistry.deallocatePort(projectId);

    console.log(`🗑️ Deleted project ${projectId}`);
  }

  /**
   * List all running projects with their ports
   */
  async listProjects(): Promise<Array<{ projectId: string; port: number; status: string }>> {
    const projects = portRegistry.getAllProjects();
    const result = [];

    for (const [projectId, config] of Object.entries(projects)) {
      result.push({
        projectId,
        port: config.port,
        status: config.status,
      });
    }

    return result;
  }

  /**
   * Restore all projects on startup
   */
  async restoreProjects(): Promise<void> {
    console.log('🔄 Restoring projects from registry...');
    
    const projects = portRegistry.getAllProjects();
    const projectIds = Object.keys(projects);

    if (projectIds.length === 0) {
      console.log('📭 No projects to restore');
      return;
    }

    for (const projectId of projectIds) {
      const config = projects[projectId];
      try {
        await this.startProject(projectId, config.type, config.outputDir);
      } catch (err: any) {
        console.error(`❌ Failed to restore project ${projectId}: ${err.message}`);
      }
    }

    console.log(`✅ Restored ${projectIds.length} projects`);
  }
}

// Singleton instance
export const projectManager = new ProjectManager();
export default projectManager;
