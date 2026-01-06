import { useState, useEffect } from "react";
import "../styles/ViewProjects.css";
import { API_URL, BUILD_SERVICE_URL } from "../config";

interface Project {
  _id: string;
  url: string;
  projectId: string;
  defaultBranch: string;
  commitSha: string;
  userId: string;
}
function ViewProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
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
        setProjects(data.results);
      } else {
        setError("Failed to fetch projects");
      }
    } catch (err) {
      setError("Failed to load projects. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }

    setDeleting(projectId);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found");
        return;
      }

      const response = await fetch(`${API_URL}/deleteProject`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          token: `${token}`,
        },
        body: JSON.stringify({
          projectId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.message) {
        setProjects(projects.filter((p) => p.projectId !== projectId));
      } else {
        setError(data.error || "Failed to delete project");
      }
    } catch (err) {
      setError("Failed to delete project. Please try again.");
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="projects-container">
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="projects-container">
      <div className="projects-box">
        <h2>My Projects</h2>

        {error && <div className="error-message">{error}</div>}

        {projects.length === 0 ? (
          <div className="no-projects">
            <p>
              No projects yet. <a href="/deploy">Deploy your first project</a>
            </p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project._id} className="project-card">
                <div className="card-header">
                  <h3 className="project-name">
                    {project.url.split("/").pop()}
                  </h3>
                </div>

                <div className="card-body">
                  <div className="info-row">
                    <label>Project ID</label>
                    <code className="project-id">{project.projectId}</code>
                  </div>

                  <div className="info-row">
                    <label>Repository</label>
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="repo-link"
                    >
                      {project.url}
                    </a>
                  </div>

                  <div className="info-row">
                    <label>Default Branch</label>
                    <span>{project.defaultBranch}</span>
                  </div>

                  <div className="info-row">
                    <label>Preview URL</label>
                    <a
                      href={`${BUILD_SERVICE_URL}/${project.projectId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="preview-link"
                    >
                      {`${BUILD_SERVICE_URL}/${project.projectId}/`}
                    </a>
                  </div>
                </div>

                <div className="card-footer">
                  <a
                    href={`${BUILD_SERVICE_URL}/${project.projectId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="preview-btn"
                  >
                    🚀 Preview
                  </a>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteProject(project.projectId)}
                    disabled={deleting === project.projectId}
                  >
                    {deleting === project.projectId ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewProjects;
