import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { minioClient, BUCKETS } from "./minio";
import { getAllFiles, getContentType } from "./utils";
import { client } from "./kafka";
import mongoose from "mongoose";
import { MONGODB_URI, REDIS_HOST, REDIS_PORT } from "./config/env";

const execAsync = promisify(exec);
const producer = client.producer();

(async () => {
  await producer.connect();
})();

// MongoDB connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ Build-service connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Project schema (same as upload-service)
const ProjectSchema = new mongoose.Schema({
  url: String,
  projectId: String,
  userId: mongoose.Schema.Types.ObjectId,
  commitSha: String,
  defaultBranch: String,
  buildStatus: { 
    type: String, 
    enum: ['pending', 'building', 'success', 'failed'], 
    default: 'pending' 
  },
  buildError: { type: String, default: null },
  lastBuildAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

const ProjectModel = mongoose.model('projects', ProjectSchema);

// Redis connection for queue
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

// Connect to the build queue
const buildQueue = new Queue("builds", {
  connection: redis,
});

// Queue for notifying host-service to start project servers
const hostJobsQueue = new Queue("host-jobs", {
  connection: redis,
});

// Deployment type configurations
interface DeploymentConfig {
  installCommand: string;
  buildCommand: string;
  outputDir: string;
  globalDependencies: string[];
}

const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  'vite-react-ts': {
    installCommand: 'npm install',
    buildCommand: 'npx tsc -b && npx vite build',
    outputDir: 'dist',
    globalDependencies: ['typescript', 'vite'],
  },
  'vite-react': {
    installCommand: 'npm install',
    buildCommand: 'npx vite build',
    outputDir: 'dist',
    globalDependencies: ['vite'],
  },
  'create-react-app': {
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDir: 'build',
    globalDependencies: [],
  },
  'nextjs': {
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDir: '.next',
    globalDependencies: [],
  },
  'static': {
    installCommand: '',
    buildCommand: '',
    outputDir: '.',
    globalDependencies: [],
  },
  'custom': {
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDir: 'dist',
    globalDependencies: [],
  },
};

// Helper function to download files from MinIO
async function downloadFromMinio(
  projectId: string,
  localPath: string
): Promise<void> {
  console.log(
    `📥 Downloading source code for project ${projectId} from MinIO...`
  );

  // Create the local directory if it doesn't exist
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  // List all objects with the project prefix
  const objectsStream = minioClient.listObjects(
    BUCKETS.SOURCE_CODE,
    `${projectId}/`,
    true
  );

  // First, collect all objects and create directory structure
  const objectsToDownload: { objectName: string; localFilePath: string }[] = [];

  for await (const obj of objectsStream) {
    const objectName = obj.name;
    if (!objectName) continue;

    // Remove the projectId prefix to get the relative path
    const relativePath = objectName.replace(`${projectId}/`, "");
    const localFilePath = path.join(localPath, relativePath);

    // Create directory structure synchronously before any downloads
    const fileDir = path.dirname(localFilePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    objectsToDownload.push({ objectName, localFilePath });
  }

  console.log(`📦 Found ${objectsToDownload.length} files to download`);

  // Now download all files sequentially to avoid race conditions
  for (const { objectName, localFilePath } of objectsToDownload) {
    await minioClient.fGetObject(BUCKETS.SOURCE_CODE, objectName, localFilePath);

    // Verify the file was downloaded correctly
    if (fs.existsSync(localFilePath)) {
      const stats = fs.statSync(localFilePath);
      console.log(`  📄 Downloaded: ${objectName} (${stats.size} bytes)`);

      // Check if file is empty (potential issue)
      if (stats.size === 0) {
        console.warn(`  ⚠️ Warning: Downloaded file is empty: ${objectName}`);
      }
    } else {
      console.error(`  ❌ Failed to download: ${objectName}`);
    }
  }

  console.log(`✅ Downloaded all source files for project ${projectId}`);
}

// Helper function to detect and run build commands
async function runBuildCommands(
  projectPath: string,
  deploymentType: string = 'vite-react-ts',
  customBuildCommand: string | null = null,
  envVars: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; isStatic: boolean }> {
  console.log(`🔨 Building project with deployment type: ${deploymentType}...`);

  // Get deployment configuration
  const config = DEPLOYMENT_CONFIGS[deploymentType] || DEPLOYMENT_CONFIGS['vite-react-ts'];

  // Handle static sites - no build needed
  if (deploymentType === 'static') {
    console.log('📁 Static site - no build required');
    return { stdout: '', stderr: '', isStatic: true };
  }

  // Check if package.json exists
  const packageJsonPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.log("No package.json found, treating as static site");
    return { stdout: "", stderr: "", isStatic: true };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  // Determine package manager
  let installCommand = config.installCommand;
  if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) {
    installCommand = installCommand.replace('npm install', 'pnpm install');
  } else if (fs.existsSync(path.join(projectPath, "yarn.lock"))) {
    installCommand = installCommand.replace('npm install', 'yarn install');
  }

  // Determine build command - use custom if provided, otherwise use config
  let buildCommand = customBuildCommand || config.buildCommand;

  // If using default config but package.json has a build script, use npm run build
  if (!customBuildCommand && packageJson.scripts?.build && deploymentType === 'custom') {
    buildCommand = 'npm run build';
  }

  console.log(`📦 Install command: ${installCommand || 'none'}`);
  console.log(`🔨 Build command: ${buildCommand || 'none'}`);

  // Build the full command
  const commands: string[] = [];
  if (installCommand) commands.push(installCommand);
  if (buildCommand) commands.push(buildCommand);

  if (commands.length === 0) {
    console.log("No commands to run, treating as static site");
    return { stdout: "", stderr: "", isStatic: true };
  }

  const fullCommand = commands.join(' && ');
  console.log(`Running: ${fullCommand}`);

  // Prepare environment variables
  const buildEnv = {
    ...process.env,
    CI: "true",
    NODE_ENV: "development", // Force dev dependencies installation
    ...envVars,
  };

  // Run the build command
  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd: projectPath,
      env: buildEnv,
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large outputs
    });

    console.log("Build stdout:", stdout);
    if (stderr) {
      console.log("Build stderr:", stderr);
    }

    await producer.send({
      topic: 'build-logs',
      messages: [
        {
          value: JSON.stringify({
            status: "success",
            message: "Build completed successfully",
            projectPath,
            stdout,
            stderr,
          }),
        },
      ],
    });

    return { stdout, stderr, isStatic: false };
  } catch (error: any) {
    console.error("❌ Build command failed!");
    console.error("Exit code:", error.code);
    if (error.stdout) console.error("Build stdout:", error.stdout);
    if (error.stderr) console.error("Build stderr:", error.stderr);
    throw error;
  }
}

// Helper function to find the build output directory
function findBuildOutputDir(
  projectPath: string,
  deploymentType: string = 'vite-react-ts',
  customOutputDir: string | null = null
): string {
  // If custom output directory is specified, use it
  if (customOutputDir) {
    const customPath = path.join(projectPath, customOutputDir);
    if (fs.existsSync(customPath) && fs.statSync(customPath).isDirectory()) {
      console.log(`Using custom output directory: ${customOutputDir}`);
      return customPath;
    }
    console.warn(`Custom output directory '${customOutputDir}' not found, searching for alternatives...`);
  }

  // Get expected output dir from deployment config
  const config = DEPLOYMENT_CONFIGS[deploymentType] || DEPLOYMENT_CONFIGS['vite-react-ts'];
  const expectedDir = path.join(projectPath, config.outputDir);

  if (fs.existsSync(expectedDir) && fs.statSync(expectedDir).isDirectory()) {
    console.log(`Found expected output directory for ${deploymentType}: ${config.outputDir}`);
    return expectedDir;
  }

  // Fallback: search common directories
  const possibleDirs = ["dist", "build", "out", ".next/static", "public"];

  for (const dir of possibleDirs) {
    const fullPath = path.join(projectPath, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      console.log(`Found build output directory: ${dir}`);
      return fullPath;
    }
  }

  // Check package.json for custom output directory
  const packageJsonPath = path.join(projectPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    // Vite projects might have a custom outDir
    if (packageJson.scripts?.build?.includes("vite")) {
      return path.join(projectPath, "dist");
    }
  }

  throw new Error("Could not find build output directory");
}

// Helper function to rewrite asset paths in HTML/CSS/JS files to include projectId prefix
function rewriteAssetPaths(content: string, projectId: string, fileType: string): string {
  // For HTML files, rewrite src, href, and content attributes that start with /
  if (fileType === 'html') {
    // Rewrite src="/..." to src="/projectId/..."
    content = content.replace(/src="\//g, `src="/${projectId}/`);
    content = content.replace(/src='\//g, `src='/${projectId}/`);

    // Rewrite href="/..." to href="/projectId/..." (but not href="http" or href="https" or href="#")
    content = content.replace(/href="\/(?!\/)/g, `href="/${projectId}/`);
    content = content.replace(/href='\/(?!\/)/g, `href='/${projectId}/`);

    // Rewrite content URLs in meta tags (e.g., og:image)
    content = content.replace(/content="\/(?!\/)/g, `content="/${projectId}/`);
    content = content.replace(/content='\/(?!\/)/g, `content='/${projectId}/`);
  }

  // For JS files, rewrite common patterns for asset loading
  if (fileType === 'js') {
    // Rewrite "/static/ patterns commonly used in React/webpack builds
    content = content.replace(/"\/static\//g, `"/${projectId}/static/`);
    content = content.replace(/'\/static\//g, `'/${projectId}/static/`);

    // Rewrite "/assets/" patterns commonly used in Vite builds
    content = content.replace(/"\/assets\//g, `"/${projectId}/assets/`);
    content = content.replace(/'\/assets\//g, `'/${projectId}/assets/`);

    // Rewrite manifest.json and other root-level assets
    content = content.replace(/"\/manifest\.json"/g, `"/${projectId}/manifest.json"`);
    content = content.replace(/"\/favicon\.ico"/g, `"/${projectId}/favicon.ico"`);
    content = content.replace(/"\/favicon\.svg"/g, `"/${projectId}/favicon.svg"`);
    content = content.replace(/"\/vite\.svg"/g, `"/${projectId}/vite.svg"`);
  }

  // For CSS files, rewrite url() references
  if (fileType === 'css') {
    content = content.replace(/url\(\//g, `url(/${projectId}/`);
    content = content.replace(/url\("\//g, `url("/${projectId}/`);
    content = content.replace(/url\('\//g, `url('/${projectId}/`);
  }

  return content;
}

// Helper function to get file type category for rewriting
function getFileTypeCategory(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.js' || ext === '.mjs') return 'js';
  if (ext === '.css') return 'css';
  return null;
}

// Helper function to upload built files to MinIO
async function uploadToMinio(
  projectId: string,
  buildPath: string
): Promise<number> {
  console.log(`📤 Uploading built files for project ${projectId} to MinIO from ${buildPath}...`);

  const files = getAllFiles(buildPath);
  console.log(`Found ${files.length} files to upload:`, files.slice(0, 10)); // Log first 10 files
  let uploadedCount = 0;

  for (const file of files) {
    const localPath = path.join(buildPath, file);
    const objectKey = `${projectId}/${file}`;

    // Determine content type based on file extension
    const contentType = getContentType(file);

    // Verify file exists and has content before uploading
    if (!fs.existsSync(localPath)) {
      console.warn(`  ⚠️ Skipping non-existent file: ${file}`);
      continue;
    }

    const stats = fs.statSync(localPath);
    if (stats.size === 0) {
      console.warn(`  ⚠️ Warning: File is empty, but uploading anyway: ${file}`);
    }

    // Check if this file needs asset path rewriting
    const fileTypeCategory = getFileTypeCategory(file);
    let fileContent = fs.readFileSync(localPath);
    let finalSize = fileContent.length;

    if (fileTypeCategory) {
      // Rewrite asset paths in HTML, JS, and CSS files
      let textContent = fileContent.toString('utf-8');
      const originalLength = textContent.length;
      textContent = rewriteAssetPaths(textContent, projectId, fileTypeCategory);

      if (textContent.length !== originalLength) {
        console.log(`  🔄 Rewrote asset paths in: ${file}`);
      }

      // Write the modified content to a temp file for upload
      const tempPath = `${localPath}.modified`;
      fs.writeFileSync(tempPath, textContent, 'utf-8');
      finalSize = textContent.length;

      console.log(`  📄 Uploading: ${file} (${finalSize} bytes, type: ${contentType})`);

      await minioClient.fPutObject(BUCKETS.STATIC_BUILDS, objectKey, tempPath, {
        "Content-Type": contentType,
        "X-Amz-Meta-Original-Size": stats.size.toString(),
      });

      // Clean up temp file
      fs.unlinkSync(tempPath);
    } else {
      console.log(`  📄 Uploading: ${file} (${finalSize} bytes, type: ${contentType})`);

      await minioClient.fPutObject(BUCKETS.STATIC_BUILDS, objectKey, localPath, {
        "Content-Type": contentType,
        "X-Amz-Meta-Original-Size": stats.size.toString(),
      });
    }

    uploadedCount++;
  }

  console.log(`✅ Uploaded ${uploadedCount} files to ${BUCKETS.STATIC_BUILDS} bucket`);
  return uploadedCount;
}

// Helper function to save build logs to MinIO
async function saveBuildLogs(
  projectId: string,
  logs: string,
  status: 'success' | 'failed'
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `${timestamp}-${status}.log`;
  const objectKey = `${projectId}/${logFileName}`;
  const tempLogPath = path.join('/tmp', `${projectId}-${timestamp}.log`);

  try {
    // Write logs to temp file
    fs.writeFileSync(tempLogPath, logs, 'utf-8');
    
    console.log(`📝 Saving build logs to MinIO: ${objectKey}`);
    
    // Upload to MinIO
    await minioClient.fPutObject(BUCKETS.BUILD_LOGS, objectKey, tempLogPath, {
      'Content-Type': 'text/plain',
      'X-Amz-Meta-Project-Id': projectId,
      'X-Amz-Meta-Status': status,
      'X-Amz-Meta-Timestamp': timestamp,
    });
    
    // Clean up temp file
    fs.unlinkSync(tempLogPath);
    
    console.log(`✅ Build logs saved: ${objectKey}`);
    return objectKey;
  } catch (err: any) {
    console.error(`❌ Failed to save build logs: ${err.message}`);
    // Clean up temp file if it exists
    if (fs.existsSync(tempLogPath)) {
      fs.unlinkSync(tempLogPath);
    }
    throw err;
  }
}

// Build Worker: Listens for build jobs in the queue
const buildWorker = new Worker(
  "builds",
  async (job) => {
    console.log(`\n🏗️ Processing build job ${job.id}...`);
    console.log("Job data:", job.data);

    const { projectId, deploymentType, buildCommand, outputDir, envVars } = job.data;
    const buildPath = path.join("/tmp", `build-${projectId}`);
    
    // Initialize log collection
    const buildLogs: string[] = [];
    const startTime = new Date();
    buildLogs.push(`=== Build Started at ${startTime.toISOString()} ===\n`);
    buildLogs.push(`Project ID: ${projectId}\n`);
    buildLogs.push(`Job ID: ${job.id}\n\n`);

    console.log(`📋 Deployment type: ${deploymentType || 'vite-react-ts'}`);
    if (buildCommand) console.log(`🔧 Custom build command: ${buildCommand}`);
    if (outputDir) console.log(`📁 Custom output directory: ${outputDir}`);
    if (envVars && Object.keys(envVars).length > 0) {
      console.log(`🔐 Environment variables: ${Object.keys(envVars).join(', ')}`);
    }

    try {
      // Step 1: Clean up any existing build directory
      if (fs.existsSync(buildPath)) {
        console.log("🧹 Cleaning up existing build directory...");
        buildLogs.push("🧹 Cleaning up existing build directory...\n");
        fs.rmSync(buildPath, { recursive: true, force: true });
      }

      // Step 2: Download source code from MinIO
      buildLogs.push("\n📥 Downloading source code from MinIO...\n");
      await downloadFromMinio(projectId, buildPath);
      buildLogs.push("✅ Source code downloaded successfully\n");

      // Step 3: Run build commands with deployment type
      buildLogs.push("\n🔨 Running build commands...\n");
      const buildResult = await runBuildCommands(
        buildPath,
        deploymentType || 'vite-react-ts',
        buildCommand || null,
        envVars || {}
      );
      const isStatic = buildResult.isStatic;
      
      // Capture build output
      if (buildResult.stdout) {
        buildLogs.push("\n--- Build Output (stdout) ---\n");
        buildLogs.push(buildResult.stdout);
        buildLogs.push("\n");
      }
      if (buildResult.stderr) {
        buildLogs.push("\n--- Build Warnings/Errors (stderr) ---\n");
        buildLogs.push(buildResult.stderr);
        buildLogs.push("\n");
      }
      
      buildLogs.push(isStatic ? "✅ Static site (no build required)\n" : "✅ Build completed successfully\n");

      // Step 4: Find and upload build output
      
      buildLogs.push("\n📦 Finding build output directory...\n");
      const outputDirectory = isStatic
        ? buildPath
        : findBuildOutputDir(buildPath, deploymentType || 'vite-react-ts', outputDir || null);
      buildLogs.push(`✅ Found output directory: ${path.basename(outputDirectory)}\n`);

      // Check if index.html exists and has content
      const indexPath = path.join(outputDirectory, "index.html");
      if (!fs.existsSync(indexPath)) {
        throw new Error("Build output does not contain index.html");
      }
      const indexContent = fs.readFileSync(indexPath, "utf-8");
      if (indexContent.trim().length === 0) {
        throw new Error("Built index.html is empty");
      }
      console.log(`✅ Found valid index.html (${indexContent.length} characters)`);
      buildLogs.push(`✅ Found valid index.html (${indexContent.length} characters)\n`);

      buildLogs.push("\n📤 Uploading built files to MinIO...\n");
      const uploadedCount = await uploadToMinio(projectId, outputDirectory);
      buildLogs.push(`✅ Uploaded ${uploadedCount} files successfully\n`);

      // Step 5: Clean up
      console.log("🧹 Cleaning up build directory...");
      buildLogs.push("\n🧹 Cleaning up build directory...\n");
      fs.rmSync(buildPath, { recursive: true, force: true });

      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      buildLogs.push(`\n=== Build Completed Successfully at ${endTime.toISOString()} ===\n`);
      buildLogs.push(`Total Duration: ${(duration / 1000).toFixed(2)}s\n`);
      
      // Save logs to MinIO
      const logPath = await saveBuildLogs(projectId, buildLogs.join(''), 'success');

      // Update MongoDB: Build succeeded
      try {
        const updateResult = await ProjectModel.findOneAndUpdate(
          { projectId },
          { 
            buildStatus: 'success',
            buildError: null,
            lastBuildAt: endTime 
          },
          { new: true }
        );
        if (updateResult) {
          console.log(`✅ Updated build status to 'success' in database for project ${projectId}`);
        } else {
          console.error(`⚠️ Project ${projectId} not found in database for status update`);
        }
      } catch (dbErr: any) {
        console.error(`❌ Failed to update database status: ${dbErr.message}`);
      }

      // Notify host-service to start the project server
      try {
        const effectiveDeploymentType = deploymentType || 'vite-react-ts';
        const effectiveOutputDir = outputDir || DEPLOYMENT_CONFIGS[effectiveDeploymentType]?.outputDir || 'dist';
        
        await hostJobsQueue.add('start', {
          action: 'start',
          projectId,
          deploymentType: effectiveDeploymentType,
          outputDir: effectiveOutputDir,
        });
        console.log(`📤 Queued host-job to start project ${projectId}`);
      } catch (hostErr: any) {
        console.error(`⚠️ Failed to queue host-job: ${hostErr.message}`);
        // Don't throw - build was successful, hosting can be retried
      }

      console.log(`✅ Build completed for project ${projectId} (type: ${deploymentType || 'vite-react-ts'})`);
      return { success: true, projectId, filesUploaded: uploadedCount, deploymentType, logPath };
    } catch (err: any) {
      console.error(`❌ Build failed for project ${projectId}: ${err.message}`);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      buildLogs.push(`\n❌ Build Failed at ${endTime.toISOString()}\n`);
      buildLogs.push(`Error: ${err.message}\n`);
      if (err.stack) {
        buildLogs.push(`\nStack Trace:\n${err.stack}\n`);
      }
      buildLogs.push(`\nTotal Duration: ${(duration / 1000).toFixed(2)}s\n`);
      
      // Save failure logs to MinIO
      try {
        await saveBuildLogs(projectId, buildLogs.join(''), 'failed');
      } catch (logErr: any) {
        console.error(`Failed to save error logs: ${logErr.message}`);
      }

      // Update MongoDB: Build failed
      try {
        const updateResult = await ProjectModel.findOneAndUpdate(
          { projectId },
          { 
            buildStatus: 'failed',
            buildError: err.message,
            lastBuildAt: endTime 
          },
          { new: true }
        );
        if (updateResult) {
          console.log(`✅ Updated build status to 'failed' in database for project ${projectId}`);
          console.log(`   Error: ${err.message}`);
        } else {
          console.error(`⚠️ Project ${projectId} not found in database for status update`);
        }
      } catch (dbErr: any) {
        console.error(`❌ Failed to update database status: ${dbErr.message}`);
      }

      // Clean up on failure
      if (fs.existsSync(buildPath)) {
        fs.rmSync(buildPath, { recursive: true, force: true });
      }

      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 1, // Process 1 build at a time
  }
);

buildWorker.on("completed", (job) => {
  console.log(`✅ Build job ${job.id} completed successfully`);
});

buildWorker.on("failed", (job, err) => {
  console.error(`❌ Build job ${job?.id} failed: ${err.message}`);
});

console.log("🏗️ Build worker started. Waiting for build jobs...");
