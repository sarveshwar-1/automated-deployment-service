import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { SignUp } from './pages/SignUp';
import { SignIn } from './pages/SignIn';
import { Dashboard } from './pages/Dashboard';
import { CreateProject } from './pages/CreateProject';
import { ProtectedRoute } from './routes/ProtectedRoute';

function App() {
  const { user, token, setLoading } = useAuthStore();

  useEffect(() => {
    // Initialize auth state from localStorage on app load
    const token = localStorage.getItem('token');
    if (token) {
      setLoading(true);
      // The ProtectedRoute will handle fetching the user profile
      setLoading(false);
    }
  }, [setLoading]);

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route
          path="/signup"
          element={user ? <Navigate to="/dashboard" replace /> : <SignUp />}
        />
        <Route
          path="/signin"
          element={user ? <Navigate to="/dashboard" replace /> : <SignIn />}
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={<ProtectedRoute component={<Dashboard />} />}
        />
        <Route
          path="/create-project"
          element={<ProtectedRoute component={<CreateProject />} />}
        />

        {/* Default Route */}
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/signin" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
