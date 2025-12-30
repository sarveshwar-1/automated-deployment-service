import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Navbar, Alert } from '../components';
import { projectAPI } from '../api/client';
import { useProjectStore, useAuthStore } from '../store';
import { FiPlus, FiGithub, FiExternalLink, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    projects,
    setProjects,
    setError,
    setLoading,
    isLoading,
    error,
    updateProjectStatus,
  } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectAPI.getProjects();
      setProjects(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (projectId: string) => {
    try {
      updateProjectStatus(projectId, 'deploying');
      await projectAPI.deployProject(projectId);
      updateProjectStatus(projectId, 'deployed');
    } catch (err: any) {
      updateProjectStatus(projectId, 'failed');
      setError(err.response?.data?.message || 'Deployment failed');
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await projectAPI.deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      idle: 'bg-gray-100 text-gray-700',
      deploying: 'bg-yellow-100 text-yellow-700',
      deployed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return colors[status as keyof typeof colors] || colors.idle;
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
                <p className="text-gray-600 mt-1">Manage and deploy your projects</p>
              </div>
              <Button
                onClick={() => navigate('/create-project')}
                className="flex items-center gap-2"
              >
                <FiPlus size={20} />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.length === 0 ? (
              <div className="col-span-full">
                <Card className="text-center py-12">
                  <FiGithub size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No projects yet
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Create your first project to get started with deployment
                  </p>
                  <Button onClick={() => navigate('/create-project')}>
                    Create Project
                  </Button>
                </Card>
              </div>
            ) : (
              projects.map((project) => (
                <Card key={project.id} className="flex flex-col">
                  {/* Project Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {project.gitUrl}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        'px-3 py-1 rounded-full text-xs font-medium',
                        getStatusColor(project.status)
                      )}
                    >
                      {project.status.charAt(0).toUpperCase() +
                        project.status.slice(1)}
                    </span>
                  </div>

                  {/* Project Info */}
                  <div className="bg-gray-50 rounded p-3 mb-4 text-sm text-gray-600">
                    <p>
                      Created:{' '}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    {project.deployUrl && (
                      <a
                        href={project.deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                      >
                        <FiExternalLink size={14} />
                        View Deployment
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-4 border-t border-gray-200">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeploy(project.id)}
                      isLoading={project.status === 'deploying'}
                      className="flex-1"
                      disabled={project.status === 'deploying'}
                    >
                      <FiRefreshCw size={16} />
                      Deploy
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(project.id)}
                      className="flex-1"
                    >
                      <FiTrash2 size={16} />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};
