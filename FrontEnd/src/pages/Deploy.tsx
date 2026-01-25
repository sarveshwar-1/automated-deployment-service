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

function Deploy() {
  const [repoUrl, setRepoUrl] = useState("");
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

      const response = await fetch(`${API_URL}/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: `${token}`,
        },
        body: JSON.stringify({
          repoUrl,
        }),
      });

      const data = await response.json();

      if (response.ok && data.projectId) {
        setSuccess("Build queued successfully! Your project is being built...");
        setProjectDetails(data);
        setRepoUrl("");
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

          <button type="submit" disabled={loading} className="deploy-btn">
            {loading ? "Deploying..." : "Deploy"}
          </button>
        </form>

        {projectDetails && (
          <div className="project-details">
            <h3>Build Started!</h3>
            <div className="build-status-info">
              <p>Your project is being built. You can view the progress in the Projects page.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Deploy;
