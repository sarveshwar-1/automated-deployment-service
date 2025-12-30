import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { authAPI } from '../api/client';

interface ProtectedRouteProps {
  component: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ component }) => {
  const { user, token, setUser, isLoading, setLoading } = useAuthStore();
  const [authChecked, setAuthChecked] = React.useState(false);

  useEffect(() => {
    if (!token) {
      setAuthChecked(true);
      return;
    }

    const checkAuth = async () => {
      try {
        setLoading(true);
        const response = await authAPI.getProfile();
        // Some backends wrap the user object; handle both shapes
        setUser(response.data?.user ?? response.data);
        setAuthChecked(true);
      } catch {
        setUser(null);
        setAuthChecked(true);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [token, setUser, setLoading]);

  if (!authChecked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <Navigate to="/signin" replace />;
  }

  return <>{component}</>;
};
