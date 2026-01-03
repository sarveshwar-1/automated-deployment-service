# Build Service

Independent build service for the Automated Deployment platform. This service handles:

1. **Build Worker** - Processes build jobs from Redis queue, compiles projects
2. **Static Server** - Serves built static files from MinIO

## Architecture

```
┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│   upload-service    │     │   Redis Queue   │     │   build-service     │
│   (worker.ts)       │────→│    "builds"     │────→│   (worker.ts)       │
│                     │     │                 │     │                     │
│ • Queues build job  │     │ • Stores jobs   │     │ • Downloads source  │
│   after upload      │     │ • Handles retry │     │ • Runs npm build    │
└─────────────────────┘     └─────────────────┘     │ • Uploads dist      │
                                                    └─────────────────────┘
                                                             │
                                                             ↓
                                                    ┌─────────────────────┐
                                                    │   MinIO Bucket      │
                                                    │  "static-builds"    │
                                                    └─────────────────────┘
                                                             │
                                                             ↓
                                                    ┌─────────────────────┐
                                                    │   build-service     │
                                                    │   (server.ts)       │
                                                    │                     │
                                                    │ • Serves files      │
                                                    │ • SPA routing       │
                                                    │ • Port 3003         │
                                                    └─────────────────────┘
```

## Installation

```bash
cd build-service
pnpm install
```

## Setup

Before running, ensure MinIO buckets are created:

```bash
pnpm run setup
```

## Running

### Option 1: Run both worker and server together

```bash
pnpm run dev
```

### Option 2: Run separately

```bash
# Terminal 1: Build Worker
pnpm run worker

# Terminal 2: Static File Server
pnpm run server
```

## Environment Variables

| Variable           | Default    | Description           |
| ------------------ | ---------- | --------------------- |
| `REDIS_HOST`       | localhost  | Redis server host     |
| `REDIS_PORT`       | 6379       | Redis server port     |
| `MINIO_ENDPOINT`   | localhost  | MinIO server endpoint |
| `MINIO_PORT`       | 9000       | MinIO server port     |
| `MINIO_ACCESS_KEY` | minioadmin | MinIO access key      |
| `MINIO_SECRET_KEY` | minioadmin | MinIO secret key      |
| `MINIO_USE_SSL`    | false      | Use SSL for MinIO     |
| `PORT`             | 3003       | Static server port    |

## Accessing Built Projects

After a project is built, access it at:

```
http://localhost:3003/{projectId}/
```

Replace `{projectId}` with the actual project ID from your deployment.
