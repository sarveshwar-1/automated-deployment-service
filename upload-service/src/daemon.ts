import mongoose from 'mongoose';
import { simpleGit } from 'simple-git';
import path from 'path';
import { UserModel, ProjectModel } from './db.js';
import axios from 'axios';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Create a queue for deployments
// This same queue name can be accessed from index.ts
export const deploymentQueue = new Queue('deployments', {
  connection: redis,
});

// Queue configuration
deploymentQueue.on('error', (err) => {
  console.error('Queue error:', err);
});

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/automated-deployment';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB');
}
connectDB();

async function getAllProjects() {
  console.log("Fetching all projects from the database");
  const projects = await ProjectModel.find({});
  return projects;
}

async function daemonTask() {
  console.log("Daemon task running every 5 minutes");
  const projects = await getAllProjects();
  
  for (let project of projects) {
    console.log(`Checking project: ${project.projectId}`);
    const currentSha = project.commitSha;
    const repoUrl = project.url;
    const repoMeta = repoUrl.replace('.git', '').replace('https://github.com/', 'https://api.github.com/repos/');
    const branchName = project.defaultBranch;
    
    try {
      const response = await axios.get(`${repoMeta}/branches/${branchName}`);
      const latestSha = response.data.commit.sha;
      
      if (currentSha !== latestSha) {
        console.log(
          `New commit detected for project ${project.projectId}. ` +
          `Updating commit SHA from ${currentSha} to ${latestSha}`
        );
        
        // Update the project in DB with new SHA
        project.commitSha = latestSha;
        await project.save();
        
        // This job will be picked up by a worker process (in index.ts)
        const jobData = {
          projectId: project.projectId,
          repoUrl: project.url,
          userId: project.userId,
          commitSha: latestSha,
          defaultBranch: project.defaultBranch,
        };
        
        const job = await deploymentQueue.add('deploy', jobData, {
          attempts: 3,                                    // Retry up to 3 times
          backoff: { type: 'exponential', delay: 2000 }, // Wait 2s, 4s, 8s between retries
          removeOnComplete: true,                         // Auto-cleanup on success
        });
        
        console.log(`Queued deployment job for project ${project.projectId} with jobId: ${job.id}`);
      } else {
        console.log(`No new commits for project ${project.projectId}`);
      }
    } catch (err: any) {
      console.error(
        `Error while fetching branch metadata for project ${project.projectId}: ${err.message}`
      );
    }
  }
}

// Run the daemon task immediately, then every 5 minutes (300000 ms)
daemonTask();
setInterval(daemonTask, 5 * 60 * 1000);

console.log('Daemon process started. Checking for new commits every 5 minutes...');
