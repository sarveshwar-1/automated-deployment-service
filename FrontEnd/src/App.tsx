import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import Deploy from './pages/Deploy';
import ViewProjects from './pages/ViewProjects';
import './App.css';

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
          <div className="nav-brand">Vercel Clone</div>
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
            path="/deploy" 
            element={isAuthenticated ? <Deploy /> : <Navigate to="/signin" />} 
          />
          <Route 
            path="/projects" 
            element={isAuthenticated ? <ViewProjects /> : <Navigate to="/signin" />} 
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
