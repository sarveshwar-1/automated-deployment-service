// Startup script - Runs setup then starts the service
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

console.log("🚀 Build Service Startup...\n");

// Determine if we're in development or production
const isDevelopment = __dirname.includes('/src');
const setupScript = isDevelopment 
  ? path.join(__dirname, "setup.ts")
  : path.join(__dirname, "setup.js");

// Step 1: Run setup to ensure MinIO buckets exist
console.log("📋 Running setup to create MinIO buckets...");
try {
  if (isDevelopment) {
    // Development: use ts-node
    execSync(`npx ts-node ${setupScript}`, { stdio: "inherit" });
  } else {
    // Production: use node
    execSync(`node ${setupScript}`, { stdio: "inherit" });
  }
  console.log("✅ Setup completed\n");
} catch (err) {
  console.error("❌ Setup failed:", err);
  process.exit(1);
}

// Step 2: Start the main service (worker + server)
console.log("🏗️ Starting build service...\n");

// Start index.js (which spawns worker and server)
const indexScript = isDevelopment
  ? path.join(__dirname, "index.ts")
  : path.join(__dirname, "index.js");

if (isDevelopment) {
  execSync(`npx ts-node ${indexScript}`, { stdio: "inherit" });
} else {
  execSync(`node ${indexScript}`, { stdio: "inherit" });
}
