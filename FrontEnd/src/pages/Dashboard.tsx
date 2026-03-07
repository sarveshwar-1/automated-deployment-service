import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import { API_URL, BUILD_SERVICE_URL, HOST_SERVICE_URL } from "../config";

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
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'analytics' | 'settings'>('overview');
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

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'success':
        return { label: 'Production', color: 'success' };
      case 'building':
        return { label: 'Building', color: 'building' };
      case 'failed':
        return { label: 'Failed', color: 'failed' };
      case 'pending':
        return { label: 'Pending', color: 'pending' };
      default:
        return { label: 'Unknown', color: 'unknown' };
    }
  };

  const statusConfig = getStatusConfig(project.buildStatus || '');

  return (
    <div className="dashboard-wrapper">
      {/* Top Navigation Bar */}
      <div className="dashboard-nav">
        <button onClick={() => navigate('/projects')} className="nav-back">
          Back to Projects
        </button>
        <div className="nav-actions">
          {project.buildStatus === 'success' && (
            <a 
              href={`${HOST_SERVICE_URL}/${project.projectId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-btn nav-btn-primary"
            >
              Visit Site
            </a>
          )}
        </div>
      </div>

      <div className="dashboard-container">
        {/* Project Header */}
        <div className="project-header">
          <div className="project-header-content">
            <div className="project-icon">
              {projectName.charAt(0).toUpperCase()}
            </div>
            <div className="project-info">
              <h1 className="project-name">{projectName}</h1>
              <div className="project-meta">
                <span className={`status-pill status-${statusConfig.color}`}>
                  <span className="status-dot"></span>
                  {statusConfig.label}
                </span>
                <span className="project-branch">{project.defaultBranch}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="tabs-container">
          <div className="tabs-nav">
            <button 
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`tab ${activeTab === 'deployments' ? 'active' : ''}`}
              onClick={() => setActiveTab('deployments')}
            >
              Deployments
            </button>
            <button 
              className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button 
              className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-layout">
              {/* Main Column */}
              <div className="main-column">
                {/* Deployment Status Card */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">Deployment Status</h2>
                  </div>
                  <div className="card-content">
                    {project.buildStatus === 'success' && (
                      <div className="deployment-success">
                        <div className="deployment-status-icon success"></div>
                        <div>
                          <p className="deployment-message">Your project is live and running</p>
                          <a 
                            href={`${HOST_SERVICE_URL}/${project.projectId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="deployment-url"
                          >
                            {HOST_SERVICE_URL.replace(/^https?:\/\//, '')}/{project.projectId}
                          </a>
                        </div>
                      </div>
                    )}
                    {project.buildStatus === 'building' && (
                      <div className="deployment-building">
                        <div className="deployment-status-icon building"></div>
                        <div>
                          <p className="deployment-message">Build in progress...</p>
                          <p className="deployment-subtitle">This may take a few minutes</p>
                        </div>
                      </div>
                    )}
                    {project.buildStatus === 'failed' && (
                      <div className="deployment-failed">
                        <div className="deployment-status-icon failed"></div>
                        <div>
                          <p className="deployment-message">Deployment failed</p>
                          {project.buildError && (
                            <div className="error-details">{project.buildError}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {project.buildStatus === 'pending' && (
                      <div className="deployment-pending">
                        <div className="deployment-status-icon pending"></div>
                        <div>
                          <p className="deployment-message">Deployment queued</p>
                          <p className="deployment-subtitle">Waiting to start build</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Details Card */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">Project Details</h2>
                  </div>
                  <div className="card-content">
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Repository</span>
                        <a 
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="info-value info-link"
                        >
                          {project.url.replace(/^https?:\/\/github\.com\//, '')}
                        </a>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Branch</span>
                        <span className="info-value">{project.defaultBranch}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Commit SHA</span>
                        <span className="info-value info-mono">{project.commitSha.substring(0, 7)}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Project ID</span>
                        <span className="info-value info-mono">{project.projectId}</span>
                      </div>
                      {project.createdAt && (
                        <div className="info-item">
                          <span className="info-label">Created</span>
                          <span className="info-value">{new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {project.lastBuildAt && (
                        <div className="info-item">
                          <span className="info-label">Last Build</span>
                          <span className="info-value">{new Date(project.lastBuildAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="sidebar-column">
                {/* Quick Actions Card */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">Actions</h2>
                  </div>
                  <div className="card-content">
                    <div className="action-list">
                      <button 
                        onClick={handleRedeploy}
                        className="action-item"
                      >
                        <div className="action-icon">↻</div>
                        <div className="action-details">
                          <div className="action-name">Redeploy</div>
                          <div className="action-desc">Trigger new deployment</div>
                        </div>
                      </button>
                      <a 
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-item"
                      >
                        <div className="action-icon">↗</div>
                        <div className="action-details">
                          <div className="action-name">View Repository</div>
                          <div className="action-desc">Open in GitHub</div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {activeTab === 'deployments' && (
          <div className="deployments-layout">
            <div className="card card-full">
              <div className="card-header">
                <h2 className="card-title">Build History</h2>
              </div>
              <div className="card-content">
                {logsLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading build logs...</p>
                  </div>
                ) : buildLogs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">◎</div>
                    <p className="empty-title">No deployments yet</p>
                    <p className="empty-text">Build logs will appear here after your first deployment</p>
                  </div>
                ) : (
                  <div className="logs-layout">
                    <div className="logs-sidebar">
                      {buildLogs.map((log) => (
                        <div 
                          key={log.fileName} 
                          className={`log-card ${selectedLog === log.fileName ? 'selected' : ''}`}
                          onClick={() => fetchLogContent(log.fileName)}
                        >
                          <div className={`log-indicator log-${log.status}`}></div>
                          <div className="log-info">
                            <div className="log-title">
                              {log.status === 'success' ? 'Successful Build' : 'Failed Build'}
                            </div>
                            <div className="log-time">
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                            <div className="log-size">{(log.size / 1024).toFixed(2)} KB</div>
                          </div>
                          <div className="log-arrow">›</div>
                        </div>
                      ))}
                    </div>

                    {selectedLog && (
                      <div className="log-display">
                        <div className="log-display-header">
                          <h3>Build Output</h3>
                          <button 
                            className="log-close"
                            onClick={() => setSelectedLog(null)}
                          >
                            ×
                          </button>
                        </div>
                        <div className="log-display-content">
                          {logContentLoading ? (
                            <div className="loading-state">
                              <div className="spinner"></div>
                              <p>Loading log content...</p>
                            </div>
                          ) : (
                            <pre className="log-output">{logContent}</pre>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <LogAnalyticsTab projectId={project.projectId} />
        )}

        {activeTab === 'settings' && (
          <div className="settings-layout">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">General Settings</h2>
              </div>
              <div className="card-content">
                <div className="settings-list">
                  <div className="setting-field">
                    <label className="setting-label">Project ID</label>
                    <input 
                      type="text" 
                      value={project.projectId} 
                      readOnly 
                      className="setting-input"
                    />
                    <p className="setting-help">Unique identifier for this project</p>
                  </div>
                  <div className="setting-field">
                    <label className="setting-label">Default Branch</label>
                    <input 
                      type="text" 
                      value={project.defaultBranch} 
                      readOnly 
                      className="setting-input"
                    />
                    <p className="setting-help">Branch used for automatic deployments</p>
                  </div>
                  <div className="setting-field">
                    <label className="setting-label">Repository URL</label>
                    <input 
                      type="text" 
                      value={project.url} 
                      readOnly 
                      className="setting-input"
                    />
                    <p className="setting-help">Source repository location</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card card-danger">
              <div className="card-header">
                <h2 className="card-title">Danger Zone</h2>
              </div>
              <div className="card-content">
                <div className="danger-item">
                  <div className="danger-info">
                    <h3 className="danger-title">Delete Project</h3>
                    <p className="danger-text">
                      Permanently remove this project and all its deployments. This action cannot be undone.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
                        navigate('/projects');
                      }
                    }}
                    className="danger-button"
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
    </div>
  );
}

// Simplified Analytics Component
function LogAnalyticsTab({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const runAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching logs for project: ${projectId}`);
      const response = await fetch(`${BUILD_SERVICE_URL}/api/logs/${projectId}?limit=5000`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch logs' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.logs?.length || 0} logs for ${projectId}`);
      
      const logs = (data.logs || []).map((log: any) => ({
        timestamp: new Date(log.timestamp),
        method: log.method,
        path: log.path,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        ip: log.ip
      }));

      if (logs.length === 0) {
        setAnalytics({
          totalRequests: 0,
          uniqueIPs: 0,
          avgResponseTime: 0,
          errorRate: 0,
          topPaths: [],
          statusDistribution: [],
          hourlyTraffic: [],
          isEmpty: true
        });
        setLoading(false);
        return;
      }

      // Process analytics
      const totalRequests = logs.length;
      const uniqueIPs = new Set(logs.map((l: any) => l.ip)).size;
      const avgResponseTime = Math.round(logs.reduce((sum: number, l: any) => sum + l.responseTime, 0) / logs.length);
      const errorCount = logs.filter((l: any) => l.statusCode >= 400).length;
      const errorRate = Number(((errorCount / totalRequests) * 100).toFixed(2));

      // Top paths
      const pathCounts = new Map<string, number>();
      logs.forEach((log: any) => {
        pathCounts.set(log.path, (pathCounts.get(log.path) || 0) + 1);
      });
      const topPaths = Array.from(pathCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));

      // Status distribution
      const statusCounts = new Map<string, number>();
      logs.forEach((log: any) => {
        const status = `${Math.floor(log.statusCode / 100)}xx`;
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      });
      const statusDistribution = Array.from(statusCounts.entries())
        .map(([status, count]) => ({ status, count }));

      // Hourly aggregation
      const hourlyMap = new Map<string, number>();
      logs.forEach((log: any) => {
        const hour = new Date(log.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = hour.toISOString();
        hourlyMap.set(key, (hourlyMap.get(key) || 0) + 1);
      });
      const hourlyTraffic = Array.from(hourlyMap.entries())
        .map(([timestamp, count]) => ({ timestamp, count }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setAnalytics({
        totalRequests,
        uniqueIPs,
        avgResponseTime,
        errorRate,
        topPaths,
        statusDistribution,
        hourlyTraffic,
        isEmpty: false
      });

    } catch (err: any) {
      console.error('Analytics error:', err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analytics-tab">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Log Analytics</h2>
          <button 
            onClick={runAnalytics}
            disabled={loading}
            className="run-analytics-btn"
            type="button"
          >
            {loading ? "Loading..." : analytics ? "Refresh" : "Run Analysis"}
          </button>
        </div>

        {loading && !analytics && (
          <div className="analytics-loading">
            <div className="loading-spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        )}

        {error && (
          <div className="analytics-error">
            ⚠️ {error}
          </div>
        )}

        {analytics?.isEmpty && (
          <div className="analytics-empty">
            <div className="empty-icon">📊</div>
            <h3>No Traffic Data Yet</h3>
            <p>Your site hasn't received any visits yet. Once users access your deployed project, you'll see analytics here.</p>
            <div className="empty-actions">
              <a 
                href={`${HOST_SERVICE_URL}/${projectId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="visit-site-btn"
              >
                Visit Your Site →
              </a>
            </div>
          </div>
        )}

        {analytics && !analytics.isEmpty && (
          <div className="card-content">
            {/* Metrics Grid */}
            <div className="analytics-metrics">
              <div className="analytics-metric">
                <div className="metric-label">Total Requests</div>
                <div className="metric-value">{analytics.totalRequests.toLocaleString()}</div>
              </div>
              <div className="analytics-metric">
                <div className="metric-label">Unique IPs</div>
                <div className="metric-value">{analytics.uniqueIPs.toLocaleString()}</div>
              </div>
              <div className="analytics-metric">
                <div className="metric-label">Avg Response</div>
                <div className="metric-value">{analytics.avgResponseTime}ms</div>
              </div>
              <div className="analytics-metric">
                <div className="metric-label">Error Rate</div>
                <div className="metric-value">{analytics.errorRate}%</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="analytics-charts">
              <div className="analytics-chart-card">
                <h3>Status Distribution</h3>
                <div className="status-list">
                  {analytics.statusDistribution.map(({ status, count }: any) => (
                    <div key={status} className="status-item">
                      <span className="status-name">{status}</span>
                      <div className="status-bar-wrapper">
                        <div 
                          className={`status-bar-fill status-${status.replace('xx', '')}`}
                          style={{ width: `${(count / analytics.totalRequests) * 100}%` }}
                        />
                      </div>
                      <span className="status-value">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="analytics-chart-card">
                <h3>Top Paths</h3>
                <div className="paths-list">
                  {analytics.topPaths.slice(0, 8).map(({ path, count }: any) => (
                    <div key={path} className="path-item">
                      <span className="path-name" title={path}>
                        {path.length > 40 ? path.substring(0, 40) + "..." : path}
                      </span>
                      <span className="path-value">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Traffic Chart */}
            <div className="analytics-chart-card traffic-chart">
              <h3>Traffic Over Time ({analytics.hourlyTraffic.length} hours)</h3>
              <SimpleTrafficChart data={analytics.hourlyTraffic} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleTrafficChart({ data }: { data: { timestamp: string; count: number }[] }) {
  if (data.length === 0) return <div className="no-data">No data</div>;

  const maxCount = Math.max(...data.map(d => d.count));
  
  return (
    <div className="simple-chart">
      {data.map((d, i) => (
        <div key={i} className="chart-bar-wrapper">
          <div 
            className="chart-bar"
            style={{ height: `${(d.count / maxCount) * 100}%` }}
            title={`${new Date(d.timestamp).toLocaleString()}: ${d.count} requests`}
          />
        </div>
      ))}
    </div>
  );
}

export default Dashboard;
