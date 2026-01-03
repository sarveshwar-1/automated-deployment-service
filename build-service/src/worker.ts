import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { minioClient, BUCKETS } from "./minio";
import { getAllFiles, getContentType } from "./utils";

const execAsync = promisify(exec);

// Redis connection for queue
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

// Connect to the build queue
const buildQueue = new Queue("builds", {
  connection: redis,
});

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

  const downloadPromises: Promise<void>[] = [];

  for await (const obj of objectsStream) {
    const objectName = obj.name;
    if (!objectName) continue;

    // Remove the projectId prefix to get the relative path
    const relativePath = objectName.replace(`${projectId}/`, "");
    const localFilePath = path.join(localPath, relativePath);

    // Create directory structure
    const fileDir = path.dirname(localFilePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // Download the file
    downloadPromises.push(
      minioClient.fGetObject(BUCKETS.SOURCE_CODE, objectName, localFilePath)
    );
  }

  await Promise.all(downloadPromises);
  console.log(`✅ Downloaded all source files for project ${projectId}`);
}

// Helper function to detect and run build commands
async function runBuildCommands(
  projectPath: string
): Promise<{ stdout: string; stderr: string }> {
  console.log(`🔨 Running build commands in ${projectPath}...`);

  // Check if package.json exists
  const packageJsonPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("No package.json found in the project");
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  // Check if build script exists
  if (packageJson.scripts?.build) {
    console.log(`Found build script: ${packageJson.scripts.build}`);
  } else {
    throw new Error("No build script found in package.json");
  }

  // Determine package manager (npm, pnpm, yarn)
  let installCommand = "npm install";
  let buildCommand = "npm run build";

  if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) {
    installCommand = "pnpm install";
    buildCommand = "pnpm run build";
  } else if (fs.existsSync(path.join(projectPath, "yarn.lock"))) {
    installCommand = "yarn install";
    buildCommand = "yarn build";
  }

  const fullCommand = `${installCommand} && ${buildCommand}`;
  console.log(`Running: ${fullCommand}`);

  // Run the build command
  const { stdout, stderr } = await execAsync(fullCommand, {
    cwd: projectPath,
    env: { ...process.env, CI: "true" },
    maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large outputs
  });

  console.log("Build stdout:", stdout);
  if (stderr) {
    console.log("Build stderr:", stderr);
  }

  return { stdout, stderr };
}

// Helper function to find the build output directory
function findBuildOutputDir(projectPath: string): string {
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

// Helper function to upload built files to MinIO
async function uploadToMinio(
  projectId: string,
  buildPath: string
): Promise<number> {
  console.log(`📤 Uploading built files for project ${projectId} to MinIO...`);

  const files = getAllFiles(buildPath);
  let uploadedCount = 0;

  for (const file of files) {
    const localPath = path.join(buildPath, file);
    const objectKey = `${projectId}/${file}`;

    // Determine content type based on file extension
    const contentType = getContentType(file);

    await minioClient.fPutObject(BUCKETS.STATIC_BUILDS, objectKey, localPath, {
      "Content-Type": contentType,
    });
    uploadedCount++;
    console.log(`  📄 Uploaded: ${file}`);
  }

  console.log(`✅ Uploaded ${uploadedCount} files to ${BUCKETS.STATIC_BUILDS} bucket`);
  return uploadedCount;
}

// Build Worker: Listens for build jobs in the queue
const buildWorker = new Worker(
  "builds",
  async (job) => {
    console.log(`\n🏗️ Processing build job ${job.id}...`);
    console.log("Job data:", job.data);

    const { projectId } = job.data;
    const buildPath = path.join("/tmp", `build-${projectId}`);

    try {
      // Step 1: Clean up any existing build directory
      if (fs.existsSync(buildPath)) {
        console.log("🧹 Cleaning up existing build directory...");
        fs.rmSync(buildPath, { recursive: true, force: true });
      }

      // Step 2: Download source code from MinIO
      await downloadFromMinio(projectId, buildPath);

      // Step 3: Run build commands
      await runBuildCommands(buildPath);

      // Step 4: Find and upload build output
      const outputDir = findBuildOutputDir(buildPath);
      const uploadedCount = await uploadToMinio(projectId, outputDir);

      // Step 5: Clean up
      console.log("🧹 Cleaning up build directory...");
      fs.rmSync(buildPath, { recursive: true, force: true });

      console.log(`✅ Build completed for project ${projectId}`);
      return { success: true, projectId, filesUploaded: uploadedCount };
    } catch (err: any) {
      console.error(`❌ Build failed for project ${projectId}: ${err.message}`);

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
