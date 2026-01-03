import express, { Request, Response } from "express";
import cors from "cors";
import { minioClient, BUCKETS } from "./minio";
import { getContentType } from "./utils";

const app = express();

// Enable CORS for all routes
app.use(cors());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "build-service-server" });
});

// Serve static files from MinIO
// Route: /:projectId/{*filePath} - serves files for a specific project (Express 5 syntax)
app.get("/:projectId/{*filePath}", async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const rawFilePath = req.params.filePath as string;

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
app.get("/:projectId", async (req: Request, res: Response) => {
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
          <code>http://localhost:3003/{projectId}/</code>
          <p style="margin-top: 20px;">Replace <code>{projectId}</code> with your actual project ID.</p>
        </div>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`🌐 Build service server running on http://localhost:${PORT}`);
  console.log(`Access projects at: http://localhost:${PORT}/{projectId}/`);
});
