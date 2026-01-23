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
  port: parseInt(process.env.REDIS_PORT || "6380"),
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
  projectPath: string
): Promise<{ stdout: string; stderr: string; isStatic: boolean }> {
  console.log(`🔨 Checking build setup in ${projectPath}...`);

  // Check if package.json exists
  const packageJsonPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.log("No package.json found, treating as static site");
    return { stdout: "", stderr: "", isStatic: true };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  // Check if build script exists
  if (!packageJson.scripts?.build) {
    console.log("No build script found, treating as static site");
    return { stdout: "", stderr: "", isStatic: true };
  }

  console.log(`Found build script: ${packageJson.scripts.build}`);

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

  return { stdout, stderr, isStatic: false };
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
    
    // Rewrite manifest.json and other root-level assets
    content = content.replace(/"\/manifest\.json"/g, `"/${projectId}/manifest.json"`);
    content = content.replace(/"\/favicon\.ico"/g, `"/${projectId}/favicon.ico"`);
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
      const buildResult = await runBuildCommands(buildPath);
      const isStatic = buildResult.isStatic;

      // Step 4: Find and upload build output
      const outputDir = isStatic ? buildPath : findBuildOutputDir(buildPath);

      // Check if index.html exists and has content
      const indexPath = path.join(outputDir, "index.html");
      if (!fs.existsSync(indexPath)) {
        throw new Error("Build output does not contain index.html");
      }
      const indexContent = fs.readFileSync(indexPath, "utf-8");
      if (indexContent.trim().length === 0) {
        throw new Error("Built index.html is empty");
      }
      console.log(`✅ Found valid index.html (${indexContent.length} characters)`);

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
