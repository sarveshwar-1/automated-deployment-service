import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import { API_URL, BUILD_SERVICE_URL } from "../config";

interface ProjectDetails {
  _id: string;
  url: string;
  projectId: string;
  defaultBranch: string;
  commitSha: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  buildStatus?: 'pending' | 'building' | 'success' | 'failed';
  buildError?: string;
  lastBuildAt?: string;
}

interface BuildLog {
  fileName: string;
  timestamp: string;
  status: 'success' | 'failed';
  size: number;
}

function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'settings'>('overview');
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>("");
  const [logContentLoading, setLogContentLoading] = useState(false);
  const projectRef = useRef<ProjectDetails | null>(null);

  // Update ref when project changes
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    fetchProjectDetails();

    // Poll for build status updates every 5 seconds if building
    const pollInterval = setInterval(() => {
      if (projectRef.current?.buildStatus === 'building') {
        fetchProjectDetails();
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'deployments' && projectId) {
      fetchBuildLogs();
    }
  }, [activeTab, projectId]);

  const fetchProjectDetails = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/viewProjects`, {
        method: "GET",
        headers: {
          token: `${token}`,
        },
      });

      const data = await response.json();

      if (data.results && Array.isArray(data.results)) {
        const foundProject = data.results.find(
          (p: ProjectDetails) => p.projectId === projectId
        );
        
        if (foundProject) {
          setProject(foundProject);
        } else {
          setError("Project not found");
        }
      } else {
        setError("Failed to fetch project details");
      }
    } catch (err) {
      setError("Failed to load project. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildLogs = async () => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/projects/${projectId}/logs`, {
        method: "GET",
        headers: {
          token: `${token}`,
        },
      });

      const data = await response.json();
      if (data.logs) {
        setBuildLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to fetch build logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchLogContent = async (fileName: string) => {
    setLogContentLoading(true);
    setSelectedLog(fileName);
    setLogContent("");

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/projects/${projectId}/logs/${fileName}`, {
        method: "GET",
        headers: {
          token: `${token}`,
        },
      });

      const data = await response.json();
      if (data.content) {
        setLogContent(data.content);
      }
    } catch (err) {
      console.error("Failed to fetch log content:", err);
      setLogContent("Failed to load log content");
    } finally {
      setLogContentLoading(false);
    }
  };

  const handleRedeploy = async () => {
    if (!project) return;
    
    if (!window.confirm("Are you sure you want to redeploy this project?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found");
        return;
      }

      // TODO: Implement redeploy endpoint
      alert("Redeploy functionality coming soon!");
    } catch (err) {
      setError("Failed to redeploy project. Please try again.");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading project details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/projects')} className="back-btn">
          Back to Projects
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="dashboard-container">
        <div className="error-message">Project not found</div>
        <button onClick={() => navigate('/projects')} className="back-btn">
          Back to Projects
        </button>
      </div>
    );
  }

  const projectName = project.url.split("/").pop() || "Unknown Project";

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <button onClick={() => navigate('/projects')} className="back-btn">
          ← Back to Projects
        </button>
        <div className="project-title">
          <h1>{projectName}</h1>
          <div className="project-status">
            {project.buildStatus && (
              <span className={`status-badge status-${project.buildStatus}`}>
                {project.buildStatus === 'building' && 'Building'}
                {project.buildStatus === 'success' && 'Live'}
                {project.buildStatus === 'failed' && 'Failed'}
                {project.buildStatus === 'pending' && 'Pending'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'deployments' ? 'active' : ''}`}
          onClick={() => setActiveTab('deployments')}
        >
          Deployments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🚀</div>
                <div className="stat-content">
                  <div className="stat-label">Build Status</div>
                  <div className={`stat-value status-${project.buildStatus || 'unknown'}`}>
                    {project.buildStatus === 'building' && 'Building...'}
                    {project.buildStatus === 'success' && 'Live'}
                    {project.buildStatus === 'failed' && 'Failed'}
                    {project.buildStatus === 'pending' && 'Pending'}
                    {!project.buildStatus && 'Unknown'}
                  </div>
                </div>
              </div>
              
              {project.buildStatus === 'success' && (
                <div className="stat-card">
                  <div className="stat-icon">🌐</div>
                  <div className="stat-content">
                    <div className="stat-label">Live URL</div>
                    <a 
                      href={`${BUILD_SERVICE_URL}/${project.projectId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="stat-link"
                    >
                      View Site
                    </a>
                  </div>
                </div>
              )}

              {project.buildStatus === 'failed' && project.buildError && (
                <div className="stat-card error-card">
                  <div className="stat-icon">⚠️</div>
                  <div className="stat-content">
                    <div className="stat-label">Build Error</div>
                    <div className="stat-error">{project.buildError}</div>
                  </div>
                </div>
              )}

              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-content">
                  <div className="stat-label">Project ID</div>
                  <div className="stat-value-mono">{project.projectId}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🔀</div>
                <div className="stat-content">
                  <div className="stat-label">Branch</div>
                  <div className="stat-value">{project.defaultBranch}</div>
                </div>
              </div>
            </div>

            <div className="project-details-section">
              <h2>Project Information</h2>
              <div className="details-list">
                <div className="detail-row">
                  <span className="detail-label">Repository</span>
                  <a 
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="detail-value detail-link"
                  >
                    {project.url}
                  </a>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Default Branch</span>
                  <span className="detail-value">{project.defaultBranch}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Commit SHA</span>
                  <span className="detail-value detail-value-mono">{project.commitSha}</span>
                </div>
                {project.createdAt && (
                  <div className="detail-row">
                    <span className="detail-label">Created</span>
                    <span className="detail-value">{new Date(project.createdAt).toLocaleString()}</span>
                  </div>
                )}
                {project.updatedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Last Updated</span>
                    <span className="detail-value">{new Date(project.updatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="actions-section">
              <h2>Quick Actions</h2>
              <div className="action-buttons">
                {project.buildStatus === 'success' ? (
                  <a 
                    href={`${BUILD_SERVICE_URL}/${project.projectId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-btn action-btn-primary"
                  >
                    🌐 Visit Site
                  </a>
                ) : (
                  <button
                    className="action-btn action-btn-primary"
                    disabled
                    title="Build must complete successfully first"
                  >
                    🌐 Visit Site
                  </button>
                )}
                <button 
                  onClick={handleRedeploy}
                  className="action-btn action-btn-secondary"
                >
                  🔄 Redeploy
                </button>
                <a 
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn action-btn-secondary"
                >
                  📂 View Repository
                </a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deployments' && (
          <div className="deployments-section">
            <h2>Build Logs</h2>
            
            {logsLoading ? (
              <div className="loading">Loading build logs...</div>
            ) : buildLogs.length === 0 ? (
              <div className="empty-state">
                <p>No build logs available yet</p>
                <small>Build logs will appear here after deployments</small>
              </div>
            ) : (
              <div className="logs-container">
                <div className="logs-list">
                  {buildLogs.map((log) => (
                    <div 
                      key={log.fileName} 
                      className={`log-item ${selectedLog === log.fileName ? 'active' : ''}`}
                      onClick={() => fetchLogContent(log.fileName)}
                    >
                      <div className={`log-status log-${log.status}`}>●</div>
                      <div className="log-content">
                        <div className="log-header">
                          <strong>{log.status === 'success' ? 'Build Success' : 'Build Failed'}</strong>
                          <span className="log-size">{(log.size / 1024).toFixed(2)} KB</span>
                        </div>
                        <div className="log-meta">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="log-actions">
                        <span className="view-icon">→</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedLog && (
                  <div className="log-viewer">
                    <div className="log-viewer-header">
                      <h3>Build Log</h3>
                      <button 
                        className="close-log-btn"
                        onClick={() => setSelectedLog(null)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="log-viewer-content">
                      {logContentLoading ? (
                        <div className="loading">Loading log content...</div>
                      ) : (
                        <pre className="log-text">{logContent}</pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-section">
            <h2>Project Settings</h2>
            <div className="settings-group">
              <h3>General</h3>
              <div className="setting-item">
                <label>Project ID</label>
                <input 
                  type="text" 
                  value={project.projectId} 
                  readOnly 
                  className="setting-input"
                />
                <small>This is your unique project identifier</small>
              </div>
              <div className="setting-item">
                <label>Default Branch</label>
                <input 
                  type="text" 
                  value={project.defaultBranch} 
                  readOnly 
                  className="setting-input"
                />
                <small>The branch used for deployments</small>
              </div>
            </div>

            <div className="settings-group danger-zone">
              <h3>Danger Zone</h3>
              <div className="setting-item">
                <div className="danger-setting">
                  <div>
                    <strong>Delete Project</strong>
                    <p>Once you delete a project, there is no going back. Please be certain.</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
                        // Navigate to projects page to handle deletion there
                        navigate('/projects');
                      }
                    }}
                    className="danger-btn"
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
