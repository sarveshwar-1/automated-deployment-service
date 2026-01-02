# Redis Queue Architecture - Three Separate Processes

## Overview

This deployment system uses Redis + BullMQ to decouple three processes:

```
┌────────────────────┐         ┌──────────────────┐         ┌────────────────────┐
│   daemon.ts        │         │   Redis Queue    │         │   worker.ts        │
│  (Commit Checker)  │────────→│   "deployments"  │────────→│ (Job Processor)    │
│                    │         │                  │         │                    │
│ • Runs every 5 min │         │ • Stores jobs    │         │ • Clones repo      │
│ • Checks for new   │         │ • Handles retries│         │ • Uploads to MinIO │
│   commits          │         │ • Manages status │         │ • Concurrency: 1   │
│ • Queues jobs      │         │                  │         │                    │
└────────────────────┘         └──────────────────┘         └────────────────────┘
                                        ↑
                                        │
                                        │
                            ┌────────────────────┐
                            │   index.ts         │
                            │  (API Server)      │
                            │                    │
                            │ • /deploy endpoint │
                            │   queues jobs      │
                            │ • /viewProjects    │
                            │ • /deleteProject   │
                            └────────────────────┘
```

## How It Works

### 1. **daemon.ts** (Commit Detector)
```bash
npm run daemon
```
- Runs continuously, checks for new commits every 5 minutes
- When a new commit is detected, creates a job object with project details
- Pushes job to Redis queue with auto-retry configuration
- Job format:
  ```json
  {
    "projectId": "abc123",
    "repoUrl": "https://github.com/user/repo",
    "userId": "user_id",
    "commitSha": "abc123def456",
    "defaultBranch": "main"
  }
  ```

### 2. **worker.ts** (Job Processor)
```bash
npm run worker
```
- Runs continuously, listens to Redis queue
- Processes deployment jobs one at a time (`concurrency: 1`)
- For each job:
  1. Clones the repository as a mirror
  2. Creates a working copy from mirror
  3. Uploads all files to MinIO
- Auto-retries failed jobs 3 times with exponential backoff
- Logs job completion/failure events

### 3. **index.ts** (API Server)
```bash
npm run dev
```
- Express server running on port 3002
- Handles user authentication and API requests
- `/deploy` endpoint:
  - User submits repo URL
  - Server creates project in MongoDB
  - Queues initial deployment job
  - Returns project details immediately (doesn't wait for deployment)

## Running the Services

### Option 1: Manual (3 Terminal Tabs)
```bash
# Terminal 1: Start API server
cd upload-service && npm run dev

# Terminal 2: Start daemon (commit checker)
cd upload-service && npm run daemon

# Terminal 3: Start worker (job processor)
cd upload-service && npm run worker
```

### Option 2: Using tmux (All in one terminal)
```bash
tmux new-session -d -s deployment
tmux send-keys -t deployment 'cd upload-service && npm run dev' Enter
tmux new-window -t deployment
tmux send-keys -t deployment 'cd upload-service && npm run daemon' Enter
tmux new-window -t deployment
tmux send-keys -t deployment 'cd upload-service && npm run worker' Enter
tmux attach -t deployment
```

### Prerequisites
- **Redis** running on `localhost:6379`
- **MongoDB** running on `localhost:27017`
- **MinIO** configured in `minio.ts`

## Job Flow

```
1. User calls /deploy endpoint
   ↓
2. Project saved to MongoDB
   ↓
3. Initial deployment job queued to Redis
   ↓
4. /deploy returns immediately with project details
   ↓
5. Worker picks up job from Redis
   ↓
6. Worker clones repo and uploads to MinIO
   ↓
7. Job marked as complete in Redis
   ↓
8. If deployment fails → Auto-retry up to 3 times
```

## Benefits of This Architecture

✅ **Decoupled**: Each process can be restarted independently
✅ **Scalable**: Can run multiple workers to process jobs in parallel
✅ **Reliable**: Failed jobs auto-retry with exponential backoff
✅ **Non-blocking**: API server doesn't wait for deployments to complete
✅ **Observable**: Redis queue provides job status tracking

## Monitoring Jobs

Access Redis CLI to inspect queue:
```bash
redis-cli
```

Common commands:
```bash
# List all jobs in "deployments" queue
LRANGE deployments 0 -1

# Get job details
GET bullmq:deployments:1:d (replace ID as needed)

# Monitor in real-time
MONITOR
```

## Configuration Options

Modify job behavior in `daemon.ts` and `index.ts`:

```typescript
const job = await deploymentQueue.add('deploy', jobData, {
  attempts: 3,                                    // Retry 3 times
  backoff: { type: 'exponential', delay: 2000 }, // Exponential backoff
  removeOnComplete: true,                         // Auto-cleanup successful jobs
  // Other options:
  // priority: 1,                                 // Higher number = higher priority
  // delay: 5000,                                 // Start job after 5 seconds
});
```

Worker concurrency in `worker.ts`:
```typescript
const deploymentWorker = new Worker('deployments', handler, {
  connection: redis,
  concurrency: 1, // Change this to process multiple jobs in parallel
});
```
