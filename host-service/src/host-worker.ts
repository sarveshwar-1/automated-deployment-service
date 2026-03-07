// Host Worker - Listens for host-jobs queue and starts project servers
import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { projectManager } from './project-manager';
import { DeploymentType } from './port-registry';
import { REDIS_HOST, REDIS_PORT } from './config/env';

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

// Queue for receiving jobs from build-service
// Cast to any to handle ioredis version mismatch between direct dep and bullmq's bundled version
const hostQueue = new Queue('host-jobs', {
  connection: redis as any,
});

// Job types
interface HostJob {
  action: 'start' | 'stop' | 'restart' | 'delete';
  projectId: string;
  deploymentType?: DeploymentType;
  outputDir?: string;
}

// Worker to process host jobs
const hostWorker = new Worker(
  'host-jobs',
  async (job: Job<HostJob>) => {
    const { action, projectId, deploymentType, outputDir } = job.data;
    
    console.log(`\n📥 Processing host job: ${action} for ${projectId}`);

    try {
      switch (action) {
        case 'start':
          if (!deploymentType) {
            throw new Error('deploymentType required for start action');
          }
          await projectManager.startProject(projectId, deploymentType, outputDir);
          break;

        case 'stop':
          await projectManager.stopProject(projectId);
          break;

        case 'restart':
          await projectManager.restartProject(projectId);
          break;

        case 'delete':
          await projectManager.deleteProject(projectId);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      console.log(`✅ Host job completed: ${action} for ${projectId}`);
      return { success: true, action, projectId };

    } catch (err: any) {
      console.error(`❌ Host job failed: ${action} for ${projectId}: ${err.message}`);
      throw err;
    }
  },
  {
    connection: redis as any,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

hostWorker.on('completed', (job: Job<HostJob>) => {
  console.log(`✅ Host job ${job.id} completed`);
});

hostWorker.on('failed', (job: Job<HostJob> | undefined, err: Error) => {
  console.error(`❌ Host job ${job?.id} failed: ${err.message}`);
});

console.log('🎧 Host worker started. Listening for host-jobs...');

export { hostQueue, hostWorker };
