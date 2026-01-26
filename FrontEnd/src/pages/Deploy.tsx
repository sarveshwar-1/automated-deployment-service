import { useState } from "react";
import "../styles/Deploy.css";
import { API_URL } from "../config";

interface DeployResponse {
  url: string;
  userId: string;
  projectId: string;
  commitSha: string;
  defaultBranch: string;
  buildStatus?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
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
  
  // GitHub repos state
  const [showRepos, setShowRepos] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGitHubRepos = async () => {
    setLoadingRepos(true);
    setReposError("");
    setShowRepos(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setReposError("No authentication token found");
        setLoadingRepos(false);
        return;
      }

      const response = await fetch(`${API_URL}/github/repos`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.repos) {
        setRepos(data.repos);
      } else {
        setReposError(data.error || "Failed to fetch repositories");
      }
    } catch (err) {
      console.error("Error fetching repos:", err);
      setReposError("Failed to fetch repositories. Please try again.");
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleRepoSelect = (repo: GitHubRepo) => {
    setRepoUrl(repo.cloneUrl);
    setShowRepos(false);
  };

  const handleCloseModal = () => {
    setShowRepos(false);
    setReposError("");
    setSearchQuery("");
  };

  // Filter repositories based on search query
  const filteredRepos = repos.filter((repo) => {
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query)) ||
      (repo.language && repo.language.toLowerCase().includes(query))
    );
  });

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

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
        setSuccess("Build queued successfully! Your project is being built...");
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

        <div className="divider">OR</div>

        <button
          onClick={fetchGitHubRepos}
          disabled={loadingRepos}
          className="github-repos-btn"
        >
          {loadingRepos ? "Loading..." : "Choose a repository from your GitHub account"}
        </button>

        {projectDetails && (
          <div className="project-details">
            <h3>Build Started!</h3>
            <div className="build-status-info">
              <p>Your project is being built. You can view the progress in the Projects page.</p>
            </div>
          </div>
        )}
      </div>

      {/* GitHub Repos Modal */}
      {showRepos && (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
          <div className="repos-modal">
            <div className="modal-header">
              <h3>Select a Repository</h3>
              <button onClick={handleCloseModal} className="close-modal-btn">
                ✕
              </button>
            </div>

            {!loadingRepos && repos.length > 0 && (
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search repositories by name, description, or language..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="repo-search-input"
                />
                <span className="search-icon">🔍</span>
              </div>
            )}

            {loadingRepos ? (
              <div className="modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading repositories...</p>
              </div>
            ) : reposError ? (
              <div className="modal-error">
                <p className="error-message">{reposError}</p>
              </div>
            ) : filteredRepos.length > 0 ? (
              <div className="repos-grid">
                {filteredRepos.map((repo) => (
                  <div key={repo.id} className="repo-card">
                    <div className="repo-header">
                      <h4>{repo.name}</h4>
                      {repo.private && <span className="private-badge">Private</span>}
                    </div>
                    {repo.description && (
                      <p className="repo-description">{repo.description}</p>
                    )}
                    <div className="repo-meta">
                      {repo.language && (
                        <span className="repo-language">{repo.language}</span>
                      )}
                      <span className="repo-updated">
                        Updated {new Date(repo.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRepoSelect(repo)}
                      className="select-repo-btn"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="modal-empty">
                <p>No repositories match "{searchQuery}"</p>
                <button onClick={() => setSearchQuery("")} className="clear-search-btn">
                  Clear search
                </button>
              </div>
            ) : (
              <div className="modal-empty">
                <p>No repositories found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Deploy;
