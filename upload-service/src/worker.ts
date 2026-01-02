import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import simpleGit from "simple-git";
import path from "path";
import { minioClient } from "./minio.js";  
import { getAllFiles } from "./utils.js";
import fs from "fs";

// Redis connection for queue
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

// Connect to the same queue that daemon.ts pushes to
const deploymentQueue = new Queue('deployments', {
  connection: redis,
});

//Worker: Listens for deployment jobs in the queue
const deploymentWorker = new Worker(
  'deployments',
  async (job) => {
    console.log(`\nProcessing deployment job ${job.id}...`);
    console.log('Job data:', job.data);

    try {
      const { projectId, repoUrl, userId, commitSha, defaultBranch } = job.data;
      const clonePath = path.join('/tmp', projectId);
      const mirrorPath = path.join(__dirname, `gitBare/${projectId}.git`);

      // ---- ACTUAL DEPLOYMENT LOGIC ----
      
      // Check if mirror repo already exists
      if (fs.existsSync(mirrorPath)) {
        console.log('Mirror repo exists, updating...');
        // Update existing mirror repo instead of cloning again
        await simpleGit(mirrorPath).fetch();
      } else {
        console.log('📥 Cloning repository (first time)...');
        await simpleGit().clone(repoUrl, mirrorPath, ["--mirror"]);
      }

      // Clean up old working directory if it exists
      if (fs.existsSync(clonePath)) {
        console.log('🧹 Cleaning up old working directory...');
        fs.rmSync(clonePath, { recursive: true, force: true });
      }

      console.log('📂 Creating working copy...');
      await simpleGit().clone(mirrorPath, clonePath);

      console.log('Uploading files to MinIO...');
      const files = getAllFiles(clonePath);
      let uploadedCount = 0;
      
      for (const file of files) {
        const localPath = path.join(clonePath, file);
        const objectKey = `${projectId}/${file}`;
        await minioClient.fPutObject("source-code", objectKey, localPath);
        uploadedCount++;
      }

      console.log(`Deployment completed for project ${projectId} (${uploadedCount} files uploaded)`);
      return { success: true, projectId, filesUploaded: uploadedCount };
    } catch (err: any) {
      console.error(`Deployment failed: ${err.message}`);
      throw err; // This triggers retries (if configured)
    }
  },
  {
    connection: redis,
    concurrency: 1, // Process 1 job at a time
  }
);

deploymentWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

deploymentWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});