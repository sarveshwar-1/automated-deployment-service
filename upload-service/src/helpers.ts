export function generateProjectId(): string {
  return Math.random().toString(36).substring(2, 8);
}
import fs from "fs";
import path from "path";

export function getAllFiles(dir: string, base = ""): string[] {
  const files: string[] = [];

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(base, item);

    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}
