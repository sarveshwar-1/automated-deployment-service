import { useState } from "react";
import "../styles/Deploy.css";
import { API_URL } from "../config";

interface DeployResponse {
  url: string;
  userId: string;
  projectId: string;
  commitSha: string;
  defaultBranch: string;
  deploymentType: string;
}

interface DeploymentTypeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const DEPLOYMENT_TYPES: DeploymentTypeOption[] = [
  {
    id: "vite-react-ts",
    name: "Vite + React + TypeScript",
    description: "Modern React app with TypeScript and Vite bundler",
    icon: "⚡",
  },
  {
    id: "vite-react",
    name: "Vite + React",
    description: "React application with Vite (JavaScript)",
    icon: "⚛️",
  },
  {
    id: "create-react-app",
    name: "Create React App",
    description: "Traditional React app with CRA toolchain",
    icon: "📦",
  },
  {
    id: "nextjs",
    name: "Next.js",
    description: "React framework with SSR/SSG support",
    icon: "▲",
  },
  {
    id: "static",
    name: "Static HTML",
    description: "Plain HTML/CSS/JS - no build required",
    icon: "📄",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Specify your own build command",
    icon: "🔧",
  },
];

function Deploy() {
  const [repoUrl, setRepoUrl] = useState("");
  const [deploymentType, setDeploymentType] = useState("vite-react-ts");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customBuildCommand, setCustomBuildCommand] = useState("");
  const [customOutputDir, setCustomOutputDir] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [projectDetails, setProjectDetails] = useState<DeployResponse | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setProjectDetails(null);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found");
        setLoading(false);
        return;
      }

      const payload: Record<string, unknown> = {
        repoUrl,
        deploymentType,
      };

      // Add optional fields if provided
      if (customBuildCommand.trim()) {
        payload.buildCommand = customBuildCommand.trim();
      }
      if (customOutputDir.trim()) {
        payload.outputDir = customOutputDir.trim();
      }

      const response = await fetch(`${API_URL}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: `${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.projectId) {
        setSuccess("Project deployed successfully!");
        setProjectDetails(data);
        setRepoUrl("");
        setCustomBuildCommand("");
        setCustomOutputDir("");
      } else {
        setError(data.error || "Failed to deploy project");
      }
    } catch (err) {
      setError("Failed to deploy. Please check the URL and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deploy-container">
      <div className="deploy-box">
        <h2>Deploy New Project</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="repoUrl">GitHub Repository URL</label>
            <input
              type="url"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
              placeholder="https://github.com/username/repository"
              pattern="https://github\.com/.*"
            />
            <small>Enter a valid GitHub repository URL</small>
          </div>

          <div className="form-group">
            <label>Deployment Type</label>
            <div className="deployment-types-grid">
              {DEPLOYMENT_TYPES.map((type) => (
                <div
                  key={type.id}
                  className={`deployment-type-card ${
                    deploymentType === type.id ? "selected" : ""
                  }`}
                  onClick={() => setDeploymentType(type.id)}
                >
                  <span className="type-icon">{type.icon}</span>
                  <span className="type-name">{type.name}</span>
                  <span className="type-description">{type.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="advanced-toggle">
            <button
              type="button"
              className="toggle-btn"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "▼" : "▶"} Advanced Options
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-options">
              <div className="form-group">
                <label htmlFor="buildCommand">Custom Build Command</label>
                <input
                  type="text"
                  id="buildCommand"
                  value={customBuildCommand}
                  onChange={(e) => setCustomBuildCommand(e.target.value)}
                  placeholder="e.g., npm run build:prod"
                />
                <small>Override the default build command</small>
              </div>

              <div className="form-group">
                <label htmlFor="outputDir">Output Directory</label>
                <input
                  type="text"
                  id="outputDir"
                  value={customOutputDir}
                  onChange={(e) => setCustomOutputDir(e.target.value)}
                  placeholder="e.g., dist, build, out"
                />
                <small>Where your built files are located</small>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="deploy-btn">
            {loading ? "Deploying..." : "Deploy"}
          </button>
        </form>

        {projectDetails && (
          <div className="project-details">
            <h3>Deployment Successful!</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Project ID</label>
                <code>{projectDetails.projectId}</code>
              </div>
              <div className="detail-item">
                <label>Deployment Type</label>
                <code>{projectDetails.deploymentType}</code>
              </div>
              <div className="detail-item">
                <label>Default Branch</label>
                <code>{projectDetails.defaultBranch}</code>
              </div>
              <div className="detail-item">
                <label>Commit SHA</label>
                <code>{projectDetails.commitSha.substring(0, 7)}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Deploy;
