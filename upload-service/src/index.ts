import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import path from "path";

import { minioClient } from "./minio";
import { deployments } from "./store";
import {
  extractRepoName,
  generateProjectId,
  getAllFiles,
} from "./utils";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * List all live projects
 */
app.get("/projects", (req, res) => {
  const projects = Array.from(deployments.values());
  res.json(projects);
});

/**
 * Delete a project
 */
app.delete("/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;

  if (!deployments.has(projectId)) {
    return res.status(404).json({ error: "Project not found" });
  }

  try {
    const deleteFolder = async (bucket: string, prefix: string) => {
      const objects: string[] = [];
      const stream = minioClient.listObjects(bucket, prefix, true);

      for await (const obj of stream) {
        objects.push(obj.name);
      }

      if (objects.length > 0) {
        await minioClient.removeObjects(bucket, objects);
      }
    };

    await deleteFolder("source-code", `${projectId}/`);
    await deleteFolder("static-builds", `${projectId}/`);

    deployments.delete(projectId);

    res.json({ message: "Deployment deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete deployment" });
  }
});

/**
 * Deploy a repository
 */
app.post("/deploy", async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: "repoUrl is required" });
  }

  const projectId = generateProjectId();
  const clonePath = path.join("/tmp", projectId);

  try {
    await simpleGit().clone(repoUrl, clonePath);

    const files = getAllFiles(clonePath);

    for (const file of files) {
      const localPath = path.join(clonePath, file);
      const objectKey = `${projectId}/${file}`;

      await minioClient.fPutObject(
        "source-code",
        objectKey,
        localPath
      );
    }

    const repoName = extractRepoName(repoUrl);

    deployments.set(projectId, {
      projectId,
      repoUrl,
      repoName,
      createdAt: Date.now(),
    });

    res.json({
      projectId,
      repoName,
      message: "Source uploaded successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Deployment failed" });
  }
});

app.listen(3000, () => {
  console.log("🚀 Upload Service running on http://localhost:3000");
});
