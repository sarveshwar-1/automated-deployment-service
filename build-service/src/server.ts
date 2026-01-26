import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { minioClient, BUCKETS } from "./minio";
import { getContentType } from "./utils";
import { RuntimeLogModel, RuntimeLog } from "./runtimeLog";

const app = express();

// === MONGODB CONNECTION ===
const MONGO_URI = process.env.MONGODB_URI || "mongodb://mongodb:27017/automated-deployment";
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Build-service server connected to MongoDB for runtime logs"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// === LOG BATCHING SYSTEM ===
/**
 * Why batching?
 * - Writing to MongoDB for EVERY request is slow
 * - Batching = collect 100 logs OR wait 5 seconds, then write all at once
 * - Reduces DB load from 1000 writes/sec → 10 writes/sec
 */
let logBuffer: RuntimeLog[] = [];
const BATCH_SIZE = 100;  // Flush after 100 logs
const BATCH_INTERVAL = 5000;  // Or flush every 5 seconds

/**
 * Flush logs to MongoDB
 * Uses insertMany() for bulk insert (much faster than individual inserts)
 */
async function flushLogs() {
  if (logBuffer.length === 0) return;
  
  const batch = logBuffer.splice(0, logBuffer.length);  // Take all logs, clear buffer
  
  try {
    await RuntimeLogModel.insertMany(batch, { ordered: false });
    console.log(`📊 Flushed ${batch.length} runtime logs to MongoDB`);
  } catch (err: any) {
    console.error(`❌ Failed to flush logs: ${err.message}`);
    // Don't re-add to buffer - accept data loss to prevent memory buildup
  }
}

// Auto-flush every 5 seconds (even if buffer not full)
setInterval(flushLogs, BATCH_INTERVAL);

// Graceful shutdown: flush remaining logs before exit
process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received, flushing logs...');
  await flushLogs();
  process.exit(0);
});

/**
 * Add log to buffer (called by middleware)
 * Automatically flushes if buffer reaches BATCH_SIZE
 */
function bufferLog(log: RuntimeLog) {
  logBuffer.push(log);
  
  if (logBuffer.length >= BATCH_SIZE) {
    flushLogs();  // Fire and forget (async)
  }
}

// Enable CORS for all routes
app.use(cors());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "build-service-server" });
});

/**
 * === RUNTIME LOGS API ===
 * 
 * Endpoint: GET /api/logs/:projectId
 * Purpose: Fetch runtime logs for a specific project
 * 
 * Query Parameters:
 * - limit: Number of logs to return (default: 100, max: 1000)
 * - errorsOnly: Filter for errors only (statusCode >= 400)
 * - startDate: Filter logs after this date (ISO 8601)
 * - endDate: Filter logs before this date (ISO 8601)
 * 
 * Example:
 * GET /api/logs/my-project?limit=50&errorsOnly=true
 * 
 * Response:
 * {
 *   logs: [...],
 *   total: 123,
 *   hasMore: true
 * }
 */
app.get("/api/logs/:projectId", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const {
    limit = '100',
    errorsOnly = 'false',
    startDate,
    endDate
  } = req.query;

  try {
    // Build query filter
    const filter: any = { projectId };

    // Filter by errors only
    if (errorsOnly === 'true') {
      filter.isError = true;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate as string);
      if (endDate) filter.timestamp.$lte = new Date(endDate as string);
    }

    // Parse limit (max 1000 to prevent overload)
    const parsedLimit = Math.min(parseInt(limit as string) || 100, 1000);

    // Fetch logs sorted by timestamp (newest first)
    const logs = await RuntimeLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(parsedLimit)
      .lean(); // Faster than returning full Mongoose documents

    // Get total count (useful for pagination)
    const total = await RuntimeLogModel.countDocuments(filter);

    res.json({
      logs,
      total,
      hasMore: total > parsedLimit,
      projectId
    });
  } catch (error: any) {
    console.error(`❌ Error fetching logs for ${projectId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

// === RUNTIME LOGGING MIDDLEWARE ===
/**
 * Captures HTTP requests to deployed websites (ONLY /:projectId/* routes)
 * 
 * Placed AFTER /health and /api/* routes so we only log actual user traffic.
 * 
 * What we capture:
 * - Request: method, path, IP, headers
 * - Response: status code, size, content type
 * - Performance: response time in milliseconds
 * - Errors: if statusCode >= 400
 */
function runtimeLogger(req: Request, res: Response, next: NextFunction) {
  // Skip if not a project route (must have projectId param)
  if (!req.params.projectId) {
    return next();
  }

  const startTime = Date.now();
  const requestId = uuidv4();  // Unique ID for request tracing
  
  // Listen for response finish (after data sent to client)
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    // Extract projectId from URL params (handle both string and array cases)
    const rawProjectId = req.params.projectId;
    const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId || 'unknown';
    
    // Build log object
    const log: RuntimeLog = {
      timestamp: new Date(),
      requestId,
      projectId,
      
      // Request details
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      
      // Performance
      responseTime,
      fileSize: parseInt(res.get('Content-Length') || '0'),
      
      // Client info
      ip: (req.ip || req.socket.remoteAddress || 'unknown') as string,
      userAgent: req.headers['user-agent'] || '',
      referer: (req.headers.referer || req.headers.referrer || '') as string,
      
      // Response info
      contentType: res.get('Content-Type') || '',
      
      // Error detection
      isError: res.statusCode >= 400,
      error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : '',
      errorType: res.statusCode >= 400 ? getErrorType(res.statusCode) : '',
      errorStack: ''  // Stack traces added in error handlers
    };
    
    // Add to buffer (async, doesn't block response)
    bufferLog(log);
  });
  
  next();
}

/**
 * Helper: Categorize errors by status code
 */
function getErrorType(statusCode: number): string {
  if (statusCode === 404) return 'NotFound';
  if (statusCode === 403) return 'Forbidden';
  if (statusCode === 500) return 'InternalServerError';
  if (statusCode === 502) return 'BadGateway';
  if (statusCode === 503) return 'ServiceUnavailable';
  if (statusCode === 504) return 'GatewayTimeout';
  return 'Unknown';
}

// Serve static files from MinIO
// Route: /:projectId/{*filePath} - serves files for a specific project (Express 5 syntax)
app.get("/:projectId/{*filePath}", runtimeLogger, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const rawFilePath = Array.isArray(req.params.filePath) ? req.params.filePath.join('/') : req.params.filePath;

  // Get the file path from the URL (everything after projectId)
  let filePath = rawFilePath || "index.html";

  // Default to index.html for empty path
  if (!filePath || filePath === "") {
    filePath = "index.html";
  }

  const objectKey = `${projectId}/${filePath}`;
  console.log(`📄 Serving: ${objectKey}`);

  try {
    // Check if file exists
    await minioClient.statObject(BUCKETS.STATIC_BUILDS, objectKey);

    // Get the file stream
    const stream = await minioClient.getObject(BUCKETS.STATIC_BUILDS, objectKey);

    // Set content type based on file extension
    const contentType = getContentType(filePath);
    res.setHeader("Content-Type", contentType);

    // Enable caching for static assets
    if (!filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }

    stream.pipe(res);
  } catch (err: any) {
    if (err.code === "NotFound" || err.code === "NoSuchKey") {
      // Try serving index.html for SPA routing
      try {
        const indexKey = `${projectId}/index.html`;
        console.log(`📄 File not found, trying SPA fallback: ${indexKey}`);

        await minioClient.statObject(BUCKETS.STATIC_BUILDS, indexKey);
        const stream = await minioClient.getObject(BUCKETS.STATIC_BUILDS, indexKey);
        res.setHeader("Content-Type", "text/html");
        stream.pipe(res);
      } catch {
        console.error(`❌ File not found: ${objectKey}`);
        res.status(404).send("File not found");
      }
    } else {
      console.error("Error serving file:", err);
      res.status(500).send("Internal server error");
    }
  }
});

// Serve root of a project (just projectId, no trailing slash)
app.get("/:projectId", runtimeLogger, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const objectKey = `${projectId}/index.html`;

  console.log(`📄 Serving project root: ${objectKey}`);

  try {
    await minioClient.statObject(BUCKETS.STATIC_BUILDS, objectKey);
    const stream = await minioClient.getObject(BUCKETS.STATIC_BUILDS, objectKey);
    res.setHeader("Content-Type", "text/html");
    stream.pipe(res);
  } catch (err: any) {
    if (err.code === "NotFound" || err.code === "NoSuchKey") {
      console.error(`❌ Project not found: ${projectId}`);
      res.status(404).send(`Project "${projectId}" not found or not built yet`);
    } else {
      console.error("Error serving file:", err);
      res.status(500).send("Internal server error");
    }
  }
});

// Root route - welcome message
app.get("/", async (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Build Service - Static File Server</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #0d1117;
            color: #c9d1d9;
          }
          h1 { color: #58a6ff; }
          code {
            background: #161b22;
            padding: 2px 8px;
            border-radius: 4px;
            color: #f0883e;
          }
          .info {
            background: #161b22;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #30363d;
          }
        </style>
      </head>
      <body>
        <h1>🚀 Build Service - Static File Server</h1>
        <div class="info">
          <p>Welcome to the static file server!</p>
          <p>Access your deployed projects at:</p>
          <code>http://localhost:3001/{projectId}/</code>
          <p style="margin-top: 20px;">Replace <code>{projectId}</code> with your actual project ID.</p>
        </div>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  const serverIp = process.env.SERVER_IP || 'localhost';
  console.log(`🌐 Build service server running on http://${serverIp}:${PORT}`);
  console.log(`Access projects at: http://${serverIp}:${PORT}/{projectId}/`);
});
