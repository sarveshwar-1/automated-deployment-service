// Main entry point - starts both worker and server
import { spawn } from "child_process";
import path from "path";

console.log("🚀 Starting Build Service...\n");

// Start the worker
const worker = spawn("node", [path.join(__dirname, "worker.js")], {
  stdio: "inherit",
  shell: true,
});

// Start the server
const server = spawn("node", [path.join(__dirname, "server.js")], {
  stdio: "inherit",
  shell: true,
});

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
