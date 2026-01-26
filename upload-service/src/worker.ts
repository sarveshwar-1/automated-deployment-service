import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import simpleGit from "simple-git";
import path from "path";
import { minioClient } from "./minio";
import { getAllFiles, getContentType } from "./utils";
import fs from "fs";

// Redis connection for queue
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  maxRetriesPerRequest: null,
});

// Connect to the same queue that daemon.ts pushes to
const deploymentQueue = new Queue('deployments', {
  connection: redis,
});

// Build queue - to queue build jobs after upload completes
const buildQueue = new Queue('builds', {
  connection: redis,
});

//Worker: Listens for deployment jobs in the queue
const deploymentWorker = new Worker(
  'deployments',
  async (job) => {
    console.log(`\nProcessing deployment job ${job.id}...`);
    console.log('Job data:', job.data);

    try {
      const { projectId, repoUrl, userId, commitSha, defaultBranch, githubToken } = job.data;
      const clonePath = path.join('/tmp', projectId);
      const mirrorPath = path.join(__dirname, `gitBare/${projectId}.git`);

      // ---- ACTUAL DEPLOYMENT LOGIC ----
      
      // Construct authenticated URL if GitHub token is available
      let authenticatedUrl = repoUrl;
      if (githubToken && repoUrl.includes('github.com')) {
        // Format: https://x-access-token:<token>@github.com/user/repo.git
        authenticatedUrl = repoUrl.replace('https://github.com/', `https://x-access-token:${githubToken}@github.com/`);
        console.log('🔑 Using authenticated git clone (avoids rate limits)');
      }
      
      // Check if mirror repo already exists
      if (fs.existsSync(mirrorPath)) {
        console.log('Mirror repo exists, updating...');
        // Update existing mirror repo instead of cloning again
        await simpleGit(mirrorPath).fetch();
      } else {
        console.log('📥 Cloning repository (first time)...');
        await simpleGit().clone(authenticatedUrl, mirrorPath, ["--mirror"]);
      }

      // Clean up old working directory if it exists
      if (fs.existsSync(clonePath)) {
        console.log('🧹 Cleaning up old working directory...');
        fs.rmSync(clonePath, { recursive: true, force: true });
      }

      console.log('📂 Creating working copy...');
      await simpleGit().clone(mirrorPath, clonePath);

      console.log('📤 Uploading files to MinIO...');
      const files = getAllFiles(clonePath);
      let uploadedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        const localPath = path.join(clonePath, file);
        const objectKey = `${projectId}/${file}`;

        // Verify file exists and has content before uploading
        if (!fs.existsSync(localPath)) {
          console.warn(`  ⚠️ Skipping non-existent file: ${file}`);
          skippedCount++;
          continue;
        }

        const stats = fs.statSync(localPath);

        // Log file details for debugging
        console.log(`  📄 Uploading: ${file} (${stats.size} bytes)`);

        // Upload with explicit content type to preserve file integrity
        const contentType = getContentType(file);
        await minioClient.fPutObject("source-code", objectKey, localPath, {
          "Content-Type": contentType,
          "X-Amz-Meta-Original-Size": stats.size.toString(),
        });

        // Verify upload was successful by checking the object exists
        uploadedCount++;
      }

      console.log(`✅ Deployment completed for project ${projectId}`);
      console.log(`   📊 Uploaded: ${uploadedCount} files, Skipped: ${skippedCount} files`);

      // ---- QUEUE BUILD JOB ----
      console.log(`📦 Queuing build job for project ${projectId}...`);
      const { deploymentType, buildCommand, outputDir, envVars } = job.data;
      await buildQueue.add('build', {
        projectId,
        repoUrl,
        userId,
        commitSha,
        defaultBranch,
        deploymentType: deploymentType || 'vite-react-ts',
        buildCommand: buildCommand || null,
        outputDir: outputDir || null,
        envVars: envVars || {},
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      });
      console.log(`✅ Build job queued for project ${projectId} (type: ${deploymentType || 'vite-react-ts'})`);

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