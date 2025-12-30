import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Alert, Navbar, Card } from '../components';
import { projectAPI } from '../api/client';
import { useProjectStore } from '../store';
import { FiGithub, FiArrowRight } from 'react-icons/fi';

export const CreateProject: React.FC = () => {
  const navigate = useNavigate();
  const { addProject, setError, setLoading, isLoading, error } = useProjectStore();
  const [formData, setFormData] = useState({
    name: '',
    gitUrl: '',
  });
  const [validationError, setValidationError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setValidationError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');

    if (!formData.name || !formData.gitUrl) {
      setValidationError('Project name and GitHub URL are required');
      return;
    }

    // Basic URL validation
    if (!formData.gitUrl.includes('github.com')) {
      setValidationError('Please provide a valid GitHub URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await projectAPI.createProject(
        formData.name,
        formData.gitUrl
      );

      addProject(response.data);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Project</h1>
            <p className="text-gray-600">Deploy your project in seconds</p>
          </div>

          {/* Form Card */}
          <Card className="!shadow-xl">
            {error && (
              <Alert
                type="error"
                message={error}
                onClose={() => setError(null)}
              />
            )}

            {validationError && (
              <Alert
                type="error"
                message={validationError}
                onClose={() => setValidationError('')}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="My Awesome Project"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a descriptive name for your project
                </p>
              </div>

              {/* GitHub URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Repository URL
                </label>
                <div className="flex gap-2">
                  <FiGithub className="text-gray-400 mt-3" size={20} />
                  <Input
                    type="url"
                    name="gitUrl"
                    value={formData.gitUrl}
                    onChange={handleChange}
                    placeholder="https://github.com/username/repo"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Paste the URL of your GitHub repository
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Your repository will be connected</li>
                  <li>• We'll analyze your project structure</li>
                  <li>• Automatic deployment will be triggered</li>
                  <li>• You'll get a live URL for your project</li>
                </ul>
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="flex-1"
                >
                  <FiArrowRight /> Create & Deploy
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
};
