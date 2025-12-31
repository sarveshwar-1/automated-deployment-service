import { useState } from 'react';
import '../styles/Deploy.css';

interface DeployResponse {
  url: string;
  userId: string;
  projectId: string;
  commitSha: string;
  defaultBranch: string;
}

const ip = "10.12.67.131"

function Deploy() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [projectDetails, setProjectDetails] = useState<DeployResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setProjectDetails(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      const response = await fetch(`http://${ip}:3002/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': `${token}`,
        },
        body: JSON.stringify({
          repoUrl,
        }),
      });

      const data = await response.json();

      if (response.ok && data.projectId) {
        setSuccess('Project deployed successfully!');
        setProjectDetails(data);
        setRepoUrl('');
      } else {
        setError(data.error || 'Failed to deploy project');
      }
    } catch (err) {
      setError('Failed to deploy. Please check the URL and try again.');
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
            {loading ? 'Deploying...' : 'Deploy'}
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
                <label>Repository URL</label>
                <code>{projectDetails.url}</code>
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
