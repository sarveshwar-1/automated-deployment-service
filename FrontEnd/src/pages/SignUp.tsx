import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Alert } from '../components';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store';
import { FiMail, FiLock, FiUser } from 'react-icons/fi';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken, setLoading, setError, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setValidationError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.signup(
        formData.email,
        formData.password,
        formData.name
      );

      const { user, token } = response.data;
      setUser(user);
      setToken(token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
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
          <p className="text-gray-600">Create your deployment platform account</p>
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

          {validationError && (
            <Alert
              type="error"
              message={validationError}
              onClose={() => setValidationError('')}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <Input
              label="Full Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              icon={<FiUser />}
            />

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

            {/* Confirm Password Input */}
            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
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
              Create Account
            </Button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-gray-600 mt-6">
            Already have an account?{' '}
            <Link to="/signin" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
