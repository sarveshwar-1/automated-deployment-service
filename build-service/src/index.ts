// Main entry point - starts both worker and server
import { spawn } from "child_process";
import path from "path";

console.log("🚀 Starting Build Service...\n");

// Start the worker
const worker = spawn("npx", ["ts-node", path.join(__dirname, "worker.ts")], {
  stdio: "inherit",
  shell: true,
});

// Start the server
const server = spawn("npx", ["ts-node", path.join(__dirname, "server.ts")], {
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
