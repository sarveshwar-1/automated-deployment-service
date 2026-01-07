// Main entry point - starts both worker and server
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

console.log("🚀 Starting Build Service...\n");

// Check if we're running in development (ts-node) or production (compiled)
const isDevelopment = __dirname.includes('/src');
const isProduction = !isDevelopment;

let worker, server;

if (isDevelopment) {
  console.log("Running in DEVELOPMENT mode (ts-node)...\n");
  
  // Start the worker with ts-node
  worker = spawn("npx", ["ts-node", path.join(__dirname, "worker.ts")], {
    stdio: "inherit",
    shell: true,
  });

  // Start the server with ts-node
  server = spawn("npx", ["ts-node", path.join(__dirname, "server.ts")], {
    stdio: "inherit",
    shell: true,
  });
} else {
  console.log("Running in PRODUCTION mode (compiled)...\n");
  
  // Start the worker
  worker = spawn("node", [path.join(__dirname, "worker.js")], {
    stdio: "inherit",
    shell: true,
  });

  // Start the server
  server = spawn("node", [path.join(__dirname, "server.js")], {
    stdio: "inherit",
    shell: true,
  });
}

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down build service...");
  worker.kill();
  server.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  worker.kill();
  server.kill();
  process.exit(0);
});
