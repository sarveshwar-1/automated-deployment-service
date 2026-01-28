# Environment Configuration

This project uses centralized environment configuration to ensure consistent IP/URL usage across all services.

## How It Works

1. **Set `SERVER_IP` in `.env`** at the project root:
   ```env
   SERVER_IP=192.168.1.100  # Your server's IP address
   ```

2. **All services read from centralized config**:
   - `upload-service/src/config/env.ts`
   - `build-service/src/config/env.ts`
   - `FrontEnd/src/config.ts`

3. **URLs are automatically constructed** from `SERVER_IP`:
   - `UPLOAD_SERVICE_URL` = `http://{SERVER_IP}:3002`
   - `BUILD_SERVICE_URL` = `http://{SERVER_IP}:3001`
   - `FRONTEND_URL` = `http://{SERVER_IP}:5173`

## Configuration Files

### Backend Services (upload-service, build-service)

Located at `src/config/env.ts`:

```typescript
import { SERVER_IP, MONGODB_URI, REDIS_HOST } from './config/env';
```

Exports:
- `SERVER_IP` - Base IP address for all services
- `UPLOAD_SERVICE_URL` / `BUILD_SERVICE_URL` / `FRONTEND_URL` - Full URLs
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST` / `REDIS_PORT` - Redis configuration
- `MINIO_*` - MinIO storage configuration
- `ALLOWED_ORIGINS` - CORS allowed origins array

### Frontend

Located at `src/config.ts`:

```typescript
import { API_URL, BUILD_SERVICE_URL, GITHUB_CALLBACK_URL } from './config';
```

Uses Vite environment variables (`VITE_*` prefix).

## Environment Variables

### Required in `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `SERVER_IP` | Server IP address | `192.168.1.100` |
| `MONGODB_URI` | MongoDB connection | `mongodb://mongodb:27017/automated-deployment` |
| `REDIS_HOST` | Redis hostname | `redis` |
| `MINIO_ENDPOINT` | MinIO endpoint | `minio` |

### Frontend (Vite) Variables:

| Variable | Description |
|----------|-------------|
| `VITE_SERVER_IP` | Server IP for frontend |
| `VITE_API_URL` | Upload service URL |
| `VITE_BUILD_SERVICE_URL` | Build service URL |
| `VITE_GITHUB_CALLBACK_URL` | GitHub OAuth callback |

## Usage Example

```typescript
// In upload-service
import { MONGODB_URI, FRONTEND_URL, ALLOWED_ORIGINS } from './config/env';

// Connect to MongoDB
mongoose.connect(MONGODB_URI);

// CORS with dynamic origins
app.use(cors({ origin: ALLOWED_ORIGINS }));
```

```typescript
// In frontend
import { API_URL, GITHUB_CALLBACK_URL } from './config';

// API call
fetch(`${API_URL}/signin`);
```

## Docker Compose

The `docker-compose.yml` uses the same environment variables. Set them in `.env` file:

```env
SERVER_IP=192.168.1.100
```

Then run:
```bash
docker compose up
```

## Switching from localhost to IP

To switch from localhost to a specific IP address:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and change `SERVER_IP`:
   ```env
   SERVER_IP=192.168.1.100
   ```

3. Rebuild frontend (to bake in the new URLs):
   ```bash
   docker compose build frontend
   docker compose up -d
   ```
