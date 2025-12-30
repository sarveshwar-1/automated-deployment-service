import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Alert } from '../components';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store';
import { FiMail, FiLock } from 'react-icons/fi';

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken, setLoading, setError, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.signin(formData.email, formData.password);

      const { user, token } = response.data;
      setUser(user);
      setToken(token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Deploy</h1>
          <p className="text-gray-600">Sign in to your deployment platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <Input
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              icon={<FiMail />}
            />

            {/* Password Input */}
            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              icon={<FiLock />}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-6"
            >
              Sign In
            </Button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
