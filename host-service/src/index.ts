// Host Service - Entry point
// Starts the host worker, API server, and traffic monitor

import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { projectManager } from './project-manager';
import { portRegistry } from './port-registry';
import { startTrafficMonitor } from './traffic-monitor';
import { MONGODB_URI, SERVER_IP, HOST_SERVICE_PORT } from './config/env';

// Import worker to start it
import './host-worker';

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Host-service connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ===== API ENDPOINTS =====

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'host-service' });
});

// List all projects
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const projects = await projectManager.listProjects();
    res.json({ projects });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get project details
app.get('/api/projects/:projectId', (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const project = portRegistry.getProject(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json({ projectId, ...project });
});

// Start a project manually
app.post('/api/projects/:projectId/start', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { deploymentType, outputDir } = req.body;

  try {
    const config = await projectManager.startProject(
      projectId,
      deploymentType || 'static',
      outputDir
    );
    res.json({ success: true, projectId, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a project
app.post('/api/projects/:projectId/stop', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    await projectManager.stopProject(projectId);
    res.json({ success: true, projectId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restart a project
app.post('/api/projects/:projectId/restart', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    await projectManager.restartProject(projectId);
    res.json({ success: true, projectId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a project
app.delete('/api/projects/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    await projectManager.deleteProject(projectId);
    res.json({ success: true, projectId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get port registry (for debugging)
app.get('/api/registry', (req: Request, res: Response) => {
  const projects = portRegistry.getAllProjects();
  const running = portRegistry.getRunningProjects();
  res.json({ projects, runningCount: running.length });
});

// Isolate an endpoint manually
app.post('/api/projects/:projectId/isolate', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint required' });
  }

  try {
    const port = portRegistry.isolateEndpoint(projectId, endpoint);
    res.json({ success: true, projectId, endpoint, port });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== STARTUP =====

const API_PORT = 3002; // Internal API port (NGINX proxies /api/* here)

async function startup() {
  console.log('🚀 Starting Host Service...\n');

  // Start API server
  app.listen(API_PORT, () => {
    console.log(`🌐 Host API running on port ${API_PORT}`);
  });

  // Restore projects from registry
  try {
    await projectManager.restoreProjects();
  } catch (err: any) {
    console.error('⚠️ Failed to restore projects:', err.message);
  }

  // Start traffic monitoring
  startTrafficMonitor();

  console.log(`\n✅ Host Service started successfully`);
  console.log(`   NGINX router: http://${SERVER_IP}:${HOST_SERVICE_PORT}`);
  console.log(`   Access projects at: http://${SERVER_IP}:${HOST_SERVICE_PORT}/{projectId}/`);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ SIGINT received, shutting down...');
  process.exit(0);
});

startup().catch(console.error);
