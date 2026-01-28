import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import GitHubCallback from './pages/GitHubCallback';
import Deploy from './pages/Deploy';
import ViewProjects from './pages/ViewProjects';
import Dashboard from './pages/Dashboard';
import LogAnalytics from './pages/LogAnalytics';
import TestLogAnalytics from './pages/TestLogAnalytics';
import './App.css';
import logo from './assets/logo.png';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <div className="nav-brand">
            <img src={logo} alt="Logo" className="nav-logo" />
          </div>
          {isAuthenticated && (
            <div className="nav-links">
              <a href="/deploy">Deploy</a>
              <a href="/projects">My Projects</a>
              <button 
                onClick={() => {
                  localStorage.removeItem('token');
                  setIsAuthenticated(false);
                  window.location.href = '/signin';
                }}
              >
                Logout
              </button>
            </div>
          )}
        </nav>

        <Routes>
          <Route 
            path="/signup" 
            element={!isAuthenticated ? <SignUp /> : <Navigate to="/deploy" />} 
          />
          <Route 
            path="/signin" 
            element={!isAuthenticated ? <SignIn setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/deploy" />} 
          />
          <Route 
            path="/auth/github/callback" 
            element={<GitHubCallback setIsAuthenticated={setIsAuthenticated} />} 
          />
          <Route 
            path="/deploy" 
            element={isAuthenticated ? <Deploy /> : <Navigate to="/signin" />} 
          />
          <Route 
            path="/projects" 
            element={isAuthenticated ? <ViewProjects /> : <Navigate to="/signin" />} 
          />
          <Route 
            path="/dashboard/:projectId" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/signin" />} 
          />
          <Route 
            path="/analytics/:projectId" 
            element={isAuthenticated ? <LogAnalytics /> : <Navigate to="/signin" />} 
          />
          <Route 
            path="/test-analytics" 
            element={isAuthenticated ? <TestLogAnalytics /> : <Navigate to="/signin" />} 
          />
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/deploy" /> : <Navigate to="/signup" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
