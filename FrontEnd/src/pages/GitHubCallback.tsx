import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../config";
import "../styles/Auth.css";

interface GitHubCallbackProps {
  setIsAuthenticated: (value: boolean) => void;
}

function GitHubCallback({ setIsAuthenticated }: GitHubCallbackProps) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle OAuth error (user denied access)
    if (error) {
      setStatus("error");
      setErrorMessage("GitHub authentication was cancelled");
      setTimeout(() => navigate("/signin"), 3000);
      return;
    }

    // Handle OAuth success - exchange code for tokens
    if (code) {
      exchangeCodeForToken(code);
    } else {
      setStatus("error");
      setErrorMessage("No authorization code received");
      setTimeout(() => navigate("/signin"), 3000);
    }
  }, [searchParams, navigate]);

  const exchangeCodeForToken = async (code: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (response.ok && data.accessToken) {
        // Store tokens
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        
        setStatus("success");
        setIsAuthenticated(true);
        
        // Redirect to deploy page
        setTimeout(() => navigate("/deploy"), 1000);
      } else {
        setStatus("error");
        setErrorMessage(data.error || "GitHub authentication failed");
        setTimeout(() => navigate("/signin"), 3000);
      }
    } catch (err) {
      console.error("GitHub callback error:", err);
      setStatus("error");
      setErrorMessage("Failed to authenticate with GitHub");
      setTimeout(() => navigate("/signin"), 3000);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        {status === "loading" && (
          <>
            <div className="loading-spinner"></div>
            <h3 style={{ textAlign: "center", marginTop: "24px" }}>
              Authenticating with GitHub...
            </h3>
          </>
        )}

        {status === "success" && (
          <>
            <div className="success-icon">✓</div>
            <h3 style={{ textAlign: "center", marginTop: "24px", color: "#10b981" }}>
              Successfully authenticated!
            </h3>
            <p style={{ textAlign: "center", color: "#94a3b8", marginTop: "8px" }}>
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="error-icon">✗</div>
            <h3 style={{ textAlign: "center", marginTop: "24px", color: "#ef4444" }}>
              Authentication Failed
            </h3>
            <p style={{ textAlign: "center", color: "#94a3b8", marginTop: "8px" }}>
              {errorMessage}
            </p>
            <p style={{ textAlign: "center", color: "#64748b", marginTop: "16px", fontSize: "14px" }}>
              Redirecting to sign in...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default GitHubCallback;
