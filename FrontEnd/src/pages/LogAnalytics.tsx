import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/LogAnalytics.css";
import { BUILD_SERVICE_URL, HOST_SERVICE_URL, ISOLATION_THRESHOLD_RPM } from "../config";

interface AnalyticsStep {
  id: string;
  name: string;
  status: "pending" | "processing" | "complete" | "error";
  description: string;
  result?: Record<string, string | number>;
}

interface LogEntry {
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  ip: string;
}

interface TimeSeriesData {
  timestamp: string;
  count: number;
}

interface ForecastData {
  timestamp: string;
  predicted: number;
  lower: number;
  upper: number;
}

interface AnalyticsResults {
  totalRequests: number;
  uniqueIPs: number;
  avgResponseTime: number;
  errorRate: number;
  topPaths: { path: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
  hourlyTraffic: TimeSeriesData[];
  forecast: ForecastData[];
  seasonality: {
    hourly: number[];
    daily: number[];
  };
}

interface LoadBalanceStatus {
  status: "idle" | "pending" | "active";
  endpoint?: string;
  peakRpm?: number;
  threshold: number;
  assignedPort?: number;
  detectedAt?: string;
}

const normalizeEndpoint = (path: string): string => {
  const match = path.match(/^\/[^/]+/);
  return match ? match[0] : "/";
};

const getPeakRpmByEndpoint = (logs: LogEntry[]): { endpoint?: string; peakRpm: number } => {
  const endpointMinuteCounts = new Map<string, Map<string, number>>();

  logs.forEach((log) => {
    const endpoint = normalizeEndpoint(log.path);
    const minuteKey = log.timestamp.toISOString().slice(0, 16);

    if (!endpointMinuteCounts.has(endpoint)) {
      endpointMinuteCounts.set(endpoint, new Map());
    }

    const minuteMap = endpointMinuteCounts.get(endpoint)!;
    minuteMap.set(minuteKey, (minuteMap.get(minuteKey) || 0) + 1);
  });

  let topEndpoint: string | undefined;
  let topPeak = 0;

  for (const [endpoint, minuteMap] of endpointMinuteCounts.entries()) {
    for (const count of minuteMap.values()) {
      if (count > topPeak) {
        topPeak = count;
        topEndpoint = endpoint;
      }
    }
  }

  return { endpoint: topEndpoint, peakRpm: topPeak };
};

function LogAnalytics() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [steps, setSteps] = useState<AnalyticsStep[]>([
    { id: "fetch", name: "Fetching Logs", status: "pending", description: "Retrieving runtime logs from database" },
    { id: "parse", name: "Parsing Data", status: "pending", description: "Converting raw logs to structured format" },
    { id: "clean", name: "Cleaning Data", status: "pending", description: "Removing outliers and invalid entries" },
    { id: "aggregate", name: "Aggregating", status: "pending", description: "Grouping data by time intervals" },
    { id: "decompose", name: "Decomposition", status: "pending", description: "Extracting trend, seasonality, residuals" },
    { id: "sarima", name: "SARIMA Fitting", status: "pending", description: "Training forecasting model" },
    { id: "forecast", name: "Forecasting", status: "pending", description: "Predicting future traffic" },
    { id: "visualize", name: "Visualization", status: "pending", description: "Rendering charts and metrics" },
  ]);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AnalyticsResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadBalanceStatus, setLoadBalanceStatus] = useState<LoadBalanceStatus | null>(null);
  const [isolatedEndpoints, setIsolatedEndpoints] = useState<Record<string, number>>({});

  const updateStepStatus = useCallback((stepId: string, status: AnalyticsStep["status"], result?: Record<string, string | number>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, result } : step
    ));
  }, []);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  useEffect(() => {
    if (!projectId) return;

    let isActive = true;

    const fetchIsolationState = async () => {
      try {
        const response = await fetch(`${HOST_SERVICE_URL}/api/projects/${projectId}`);
        if (!response.ok) return;
        const data = await response.json();
        const endpoints = data?.isolatedEndpoints || {};
        if (isActive) {
          setIsolatedEndpoints(endpoints);
        }
      } catch (err) {
        // Silently ignore polling errors to avoid UI noise
      }
    };

    fetchIsolationState();
    const intervalId = setInterval(fetchIsolationState, 10000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [projectId]);

  useEffect(() => {
    if (Object.keys(isolatedEndpoints).length === 0) return;

    setLoadBalanceStatus((prev) => {
      const preferredEndpoint = prev?.endpoint && isolatedEndpoints[prev.endpoint]
        ? prev.endpoint
        : Object.keys(isolatedEndpoints)[0];

      return {
        status: "active",
        endpoint: preferredEndpoint,
        peakRpm: prev?.peakRpm,
        threshold: prev?.threshold ?? ISOLATION_THRESHOLD_RPM,
        assignedPort: isolatedEndpoints[preferredEndpoint],
        detectedAt: prev?.detectedAt ?? new Date().toISOString(),
      };
    });
  }, [isolatedEndpoints]);

  // Step 1: Fetch logs from build service API
  const fetchLogs = async (): Promise<LogEntry[]> => {
    updateStepStatus("fetch", "processing");
    
    const response = await fetch(`${BUILD_SERVICE_URL}/api/logs/${projectId}?limit=1000`);

    if (!response.ok) throw new Error("Failed to fetch logs");
    
    const data = await response.json();
    const logs = data.logs.map((log: Record<string, unknown>) => ({
      timestamp: new Date(log.timestamp as string),
      method: log.method as string,
      path: log.path as string,
      statusCode: log.statusCode as number,
      responseTime: log.responseTime as number,
      ip: log.ip as string
    }));

    updateStepStatus("fetch", "complete", { count: logs.length });
    return logs;
  };

  // Step 2: Parse and validate data
  const parseData = async (logs: LogEntry[]): Promise<LogEntry[]> => {
    updateStepStatus("parse", "processing");
    await delay(500);

    const parsed = logs.filter(log => 
      log.timestamp instanceof Date && 
      !isNaN(log.timestamp.getTime()) &&
      typeof log.statusCode === "number" &&
      typeof log.responseTime === "number"
    );

    updateStepStatus("parse", "complete", { 
      valid: parsed.length, 
      invalid: logs.length - parsed.length 
    });
    return parsed;
  };

  // Step 3: Clean data (remove outliers)
  const cleanData = async (logs: LogEntry[]): Promise<LogEntry[]> => {
    updateStepStatus("clean", "processing");
    await delay(500);

    if (logs.length === 0) {
      updateStepStatus("clean", "complete", { removed: 0, remaining: 0 });
      return logs;
    }

    const responseTimes = logs.map(l => l.responseTime);
    const mean = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const std = Math.sqrt(
      responseTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / responseTimes.length
    );

    const cleaned = logs.filter(log => 
      Math.abs(log.responseTime - mean) <= 3 * std
    );

    updateStepStatus("clean", "complete", { 
      removed: logs.length - cleaned.length,
      remaining: cleaned.length 
    });
    return cleaned;
  };

  // Step 4: Aggregate data by hour
  const aggregateData = async (logs: LogEntry[]): Promise<TimeSeriesData[]> => {
    updateStepStatus("aggregate", "processing");
    await delay(600);

    const hourlyMap = new Map<string, number>();
    
    logs.forEach(log => {
      const hour = new Date(log.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      hourlyMap.set(key, (hourlyMap.get(key) || 0) + 1);
    });

    const hourlyData: TimeSeriesData[] = Array.from(hourlyMap.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    updateStepStatus("aggregate", "complete", { intervals: hourlyData.length });
    return hourlyData;
  };

  // Step 5: Decompose time series
  const decomposeTimeSeries = async (data: TimeSeriesData[]): Promise<{
    trend: number[];
    seasonal: number[];
    residual: number[];
    hourlyPattern: number[];
    dailyPattern: number[];
  }> => {
    updateStepStatus("decompose", "processing");
    await delay(800);

    const values = data.map(d => d.count);
    const n = values.length;

    if (n === 0) {
      return {
        trend: [],
        seasonal: [],
        residual: [],
        hourlyPattern: new Array(24).fill(0),
        dailyPattern: new Array(7).fill(0)
      };
    }

    const windowSize = Math.min(24, Math.max(1, Math.floor(n / 3)));
    const trend: number[] = [];
    
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(n, i + Math.floor(windowSize / 2) + 1);
      const window = values.slice(start, end);
      trend.push(window.reduce((a, b) => a + b, 0) / window.length);
    }

    const hourlyPattern = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    data.forEach((d, i) => {
      const hour = new Date(d.timestamp).getHours();
      hourlyPattern[hour] += values[i] - trend[i];
      hourlyCounts[hour]++;
    });
    
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyPattern[i] /= hourlyCounts[i];
      }
    }

    const dailyPattern = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);
    
    data.forEach((d, i) => {
      const day = new Date(d.timestamp).getDay();
      dailyPattern[day] += values[i] - trend[i];
      dailyCounts[day]++;
    });
    
    for (let i = 0; i < 7; i++) {
      if (dailyCounts[i] > 0) {
        dailyPattern[i] /= dailyCounts[i];
      }
    }

    const seasonal = data.map(d => {
      const hour = new Date(d.timestamp).getHours();
      return hourlyPattern[hour];
    });

    const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

    updateStepStatus("decompose", "complete", { 
      trendPoints: trend.length,
      seasonalPeriod: 24 
    });

    return { trend, seasonal, residual, hourlyPattern, dailyPattern };
  };

  // Step 6: Fit SARIMA model
  const fitSARIMA = async (
    data: TimeSeriesData[], 
    decomposition: { trend: number[]; seasonal: number[]; residual: number[] }
  ): Promise<{ phi: number[]; theta: number[]; sigma: number }> => {
    updateStepStatus("sarima", "processing");
    await delay(1000);

    const values = data.map(d => d.count);
    const n = values.length;

    if (n < 2) {
      updateStepStatus("sarima", "complete", { order: "SARIMA(1,0,0)(1,0,0)[24]", phi: "0.5" });
      return { phi: [0.5], theta: [], sigma: 1 };
    }

    let autocorr = 0;
    let variance = 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    
    for (let i = 1; i < n; i++) {
      autocorr += (values[i] - mean) * (values[i - 1] - mean);
    }
    for (let i = 0; i < n; i++) {
      variance += Math.pow(values[i] - mean, 2);
    }
    
    const phi1 = variance > 0 ? autocorr / variance : 0.5;
    
    const residuals = decomposition.residual;
    const sigma = residuals.length > 0 
      ? Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length)
      : 1;

    updateStepStatus("sarima", "complete", { 
      order: "SARIMA(1,0,0)(1,0,0)[24]",
      phi: phi1.toFixed(4) 
    });

    return { phi: [phi1], theta: [], sigma };
  };

  // Step 7: Generate forecast
  const generateForecast = async (
    data: TimeSeriesData[],
    model: { phi: number[]; theta: number[]; sigma: number },
    decomposition: { trend: number[]; hourlyPattern: number[] }
  ): Promise<ForecastData[]> => {
    updateStepStatus("forecast", "processing");
    await delay(800);

    const forecast: ForecastData[] = [];
    
    if (data.length === 0) {
      updateStepStatus("forecast", "complete", { horizon: "24 hours", points: 0 });
      return forecast;
    }

    const lastTimestamp = new Date(data[data.length - 1].timestamp);
    const lastValue = data[data.length - 1].count;
    const mean = data.reduce((sum, d) => sum + d.count, 0) / data.length;
    
    for (let h = 1; h <= 24; h++) {
      const forecastTime = new Date(lastTimestamp.getTime() + h * 60 * 60 * 1000);
      const hour = forecastTime.getHours();
      
      const arForecast = mean + model.phi[0] * (lastValue - mean);
      const seasonalAdj = decomposition.hourlyPattern[hour] || 0;
      const predicted = Math.max(0, arForecast + seasonalAdj);
      
      const ci = 1.96 * model.sigma * Math.sqrt(h);
      
      forecast.push({
        timestamp: forecastTime.toISOString(),
        predicted: Math.round(predicted),
        lower: Math.max(0, Math.round(predicted - ci)),
        upper: Math.round(predicted + ci)
      });
    }

    updateStepStatus("forecast", "complete", { 
      horizon: "24 hours",
      points: forecast.length 
    });

    return forecast;
  };

  // Step 8: Generate final visualization data
  const generateVisualization = async (
    logs: LogEntry[],
    hourlyData: TimeSeriesData[],
    forecast: ForecastData[],
    decomposition: { hourlyPattern: number[]; dailyPattern: number[] }
  ): Promise<AnalyticsResults> => {
    updateStepStatus("visualize", "processing");
    await delay(500);

    const totalRequests = logs.length;
    const uniqueIPs = new Set(logs.map(l => l.ip)).size;
    const avgResponseTime = logs.length > 0 
      ? logs.reduce((sum, l) => sum + l.responseTime, 0) / logs.length 
      : 0;
    const errorCount = logs.filter(l => l.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const pathCounts = new Map<string, number>();
    logs.forEach(log => {
      pathCounts.set(log.path, (pathCounts.get(log.path) || 0) + 1);
    });
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const statusCounts = new Map<string, number>();
    logs.forEach(log => {
      const status = `${Math.floor(log.statusCode / 100)}xx`;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    const statusDistribution = Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }));

    const analyticsResults: AnalyticsResults = {
      totalRequests,
      uniqueIPs,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Number(errorRate.toFixed(2)),
      topPaths,
      statusDistribution,
      hourlyTraffic: hourlyData,
      forecast,
      seasonality: {
        hourly: decomposition.hourlyPattern,
        daily: decomposition.dailyPattern
      }
    };

    updateStepStatus("visualize", "complete");
    return analyticsResults;
  };

  const runAnalytics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    setResults(null);
    setProgress(0);
    setLoadBalanceStatus(null);

    setSteps(prev => prev.map(step => ({ ...step, status: "pending", result: undefined })));

    try {
      setCurrentStep(0);
      setProgress(12.5);
      const logs = await fetchLogs();

      if (logs.length === 0) {
        setError("No logs found for this project. Visit your deployed site to generate logs.");
        return;
      }

      const { endpoint, peakRpm } = getPeakRpmByEndpoint(logs);
      const threshold = ISOLATION_THRESHOLD_RPM;
      if (endpoint && peakRpm >= threshold) {
        const assignedPort = isolatedEndpoints[endpoint];
        setLoadBalanceStatus({
          status: assignedPort ? "active" : "pending",
          endpoint,
          peakRpm,
          threshold,
          assignedPort,
          detectedAt: new Date().toISOString(),
        });
      } else {
        setLoadBalanceStatus({
          status: "idle",
          endpoint,
          peakRpm,
          threshold,
        });
      }

      setCurrentStep(1);
      setProgress(25);
      const parsed = await parseData(logs);

      setCurrentStep(2);
      setProgress(37.5);
      const cleaned = await cleanData(parsed);

      setCurrentStep(3);
      setProgress(50);
      const hourlyData = await aggregateData(cleaned);

      if (hourlyData.length < 2) {
        setError("Insufficient data for time series analysis. Need at least 2 hours of data.");
      }

      setCurrentStep(4);
      setProgress(62.5);
      const decomposition = await decomposeTimeSeries(hourlyData);

      setCurrentStep(5);
      setProgress(75);
      const model = await fitSARIMA(hourlyData, decomposition);

      setCurrentStep(6);
      setProgress(87.5);
      const forecast = await generateForecast(hourlyData, model, decomposition);

      setCurrentStep(7);
      setProgress(100);
      const analyticsResults = await generateVisualization(
        cleaned, 
        hourlyData, 
        forecast, 
        decomposition
      );

      setResults(analyticsResults);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during analysis";
      setError(errorMessage);
      const currentStepId = steps[currentStep]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, "error");
      }
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;

    runAnalytics();
    const intervalId = setInterval(() => {
      runAnalytics();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [projectId]);

  return (
    <div className="analytics-wrapper">
      <div className="analytics-nav">
        <button onClick={() => navigate(`/dashboard/${projectId}`)} className="nav-back">
          ← Back to Dashboard
        </button>
        <h1 className="nav-title">Log Analytics</h1>
        <div className="nav-project">{projectId}</div>
      </div>

      <div className="analytics-container">
        <div className="pipeline-section">
          <div className="section-header">
            <h2>Analysis Pipeline</h2>
            <div className="auto-status">
              <span className={`auto-indicator ${isRunning ? "running" : "idle"}`} />
              <span>{isRunning ? "Auto-detecting traffic..." : "Auto-detect enabled"}</span>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(progress)}%</span>
          </div>

          <div className="pipeline-steps">
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className={`pipeline-step ${step.status}`}
              >
                <div className="step-indicator">
                  <div className={`step-icon ${step.status}`}>
                    {step.status === "complete" && "✓"}
                    {step.status === "error" && "✕"}
                    {step.status === "processing" && (
                      <div className="pulse-ring" />
                    )}
                    {step.status === "pending" && (index + 1)}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`step-connector ${
                      step.status === "complete" ? "complete" : ""
                    }`} />
                  )}
                </div>
                <div className="step-content">
                  <div className="step-name">{step.name}</div>
                  <div className="step-description">{step.description}</div>
                  {step.result && (
                    <div className="step-result">
                      {Object.entries(step.result).map(([key, value]) => (
                        <span key={key} className="result-item">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}
        </div>

        {loadBalanceStatus && loadBalanceStatus.status !== "idle" && (
          <div className={`load-balance-card ${loadBalanceStatus.status}`}>
            <div className="load-balance-header">
              <div className="load-balance-title">Auto-Scaling Alert</div>
              <span className={`load-balance-badge ${loadBalanceStatus.status}`}>
                {loadBalanceStatus.status === "active" ? "Active" : "Pending"}
              </span>
            </div>
            <div className="load-balance-body">
              <div className="load-balance-row">
                <span className="load-balance-label">Endpoint</span>
                <span className="load-balance-value">{loadBalanceStatus.endpoint}</span>
              </div>
              <div className="load-balance-row">
                <span className="load-balance-label">Peak Requests/min</span>
                <span className="load-balance-value">
                  {loadBalanceStatus.peakRpm?.toLocaleString() ?? "—"}
                </span>
              </div>
              <div className="load-balance-row">
                <span className="load-balance-label">Threshold</span>
                <span className="load-balance-value">{loadBalanceStatus.threshold.toLocaleString()}</span>
              </div>
              <div className="load-balance-row">
                <span className="load-balance-label">New Port</span>
                <span className="load-balance-value">
                  {loadBalanceStatus.assignedPort ? loadBalanceStatus.assignedPort : "Allocating..."}
                </span>
              </div>
            </div>
            <div className="load-balance-footer">
              {loadBalanceStatus.status === "active"
                ? `Traffic is now routed to a dedicated server on port ${loadBalanceStatus.assignedPort}.`
                : "High traffic detected. This endpoint will be moved to a new server at a new port once allocation completes."}
            </div>
          </div>
        )}

        {results && (
          <div className="results-section">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Requests</div>
                <div className="metric-value">{results.totalRequests.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Unique IPs</div>
                <div className="metric-value">{results.uniqueIPs.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Avg Response Time</div>
                <div className="metric-value">{results.avgResponseTime}ms</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Error Rate</div>
                <div className="metric-value">{results.errorRate}%</div>
              </div>
            </div>

            <div className="chart-card">
              <h3>Traffic Over Time & Forecast</h3>
              <div className="chart-container">
                <TrafficChart 
                  historical={results.hourlyTraffic}
                  forecast={results.forecast}
                />
              </div>
              <div className="chart-legend">
                <span className="legend-item">
                  <span className="legend-color historical" />
                  Historical
                </span>
                <span className="legend-item">
                  <span className="legend-color forecast" />
                  Forecast
                </span>
                <span className="legend-item">
                  <span className="legend-color confidence" />
                  95% CI
                </span>
              </div>
            </div>

            <div className="charts-row">
              <div className="chart-card half">
                <h3>Hourly Pattern</h3>
                <div className="bar-chart">
                  {results.seasonality.hourly.map((val, hour) => {
                    const minVal = Math.min(...results.seasonality.hourly);
                    const maxVal = Math.max(...results.seasonality.hourly);
                    const range = maxVal - minVal || 1;
                    const height = Math.max(5, ((val - minVal) / range) * 100);
                    return (
                      <div key={hour} className="bar-item">
                        <div className="bar" style={{ height: `${height}%` }} />
                        <span className="bar-label">{hour}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="chart-card half">
                <h3>Daily Pattern</h3>
                <div className="bar-chart daily">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                    const minVal = Math.min(...results.seasonality.daily);
                    const maxVal = Math.max(...results.seasonality.daily);
                    const range = maxVal - minVal || 1;
                    const height = Math.max(5, ((results.seasonality.daily[i] - minVal) / range) * 100);
                    return (
                      <div key={day} className="bar-item">
                        <div className="bar" style={{ height: `${height}%` }} />
                        <span className="bar-label">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="charts-row">
              <div className="chart-card half">
                <h3>Status Distribution</h3>
                <div className="status-bars">
                  {results.statusDistribution.map(({ status, count }) => (
                    <div key={status} className="status-row">
                      <span className="status-label">{status}</span>
                      <div className="status-bar-container">
                        <div 
                          className={`status-bar status-${status.replace('xx', '')}`}
                          style={{ width: `${(count / results.totalRequests) * 100}%` }}
                        />
                      </div>
                      <span className="status-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-card half">
                <h3>Top Paths</h3>
                <div className="top-paths">
                  {results.topPaths.slice(0, 5).map(({ path, count }) => (
                    <div key={path} className="path-row">
                      <span className="path-name" title={path}>
                        {path.length > 30 ? path.substring(0, 30) + "..." : path}
                      </span>
                      <span className="path-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <h3>24-Hour Forecast</h3>
              <div className="forecast-table">
                <div className="forecast-header">
                  <span>Time</span>
                  <span>Predicted</span>
                  <span>Lower (95%)</span>
                  <span>Upper (95%)</span>
                </div>
                <div className="forecast-body">
                  {results.forecast.map((f, i) => (
                    <div key={i} className="forecast-row">
                      <span>{new Date(f.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</span>
                      <span className="predicted">{f.predicted}</span>
                      <span className="lower">{f.lower}</span>
                      <span className="upper">{f.upper}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrafficChart({ 
  historical, 
  forecast 
}: { 
  historical: TimeSeriesData[]; 
  forecast: ForecastData[];
}) {
  if (historical.length === 0) {
    return <div className="no-data">No data available</div>;
  }

  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const allValues = [
    ...historical.map(d => d.count),
    ...forecast.map(d => d.upper)
  ];
  const maxValue = Math.max(...allValues) * 1.1 || 10;
  const minValue = 0;

  const totalPoints = historical.length + forecast.length;
  const xScale = (i: number) => padding.left + (i / Math.max(1, totalPoints - 1)) * (width - padding.left - padding.right);
  const yScale = (v: number) => height - padding.bottom - ((v - minValue) / (maxValue - minValue)) * (height - padding.top - padding.bottom);

  const historicalPath = historical.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.count)}`
  ).join(' ');

  const forecastStartIndex = historical.length - 1;
  const forecastPath = forecast.length > 0 
    ? forecast.map((d, i) => 
        `${i === 0 ? 'M' : 'L'} ${xScale(forecastStartIndex + i + 1)} ${yScale(d.predicted)}`
      ).join(' ')
    : '';

  const connectionPath = forecast.length > 0 
    ? `M ${xScale(historical.length - 1)} ${yScale(historical[historical.length - 1].count)} L ${xScale(historical.length)} ${yScale(forecast[0].predicted)}`
    : '';

  const ciPath = forecast.length > 0 
    ? `
      M ${xScale(forecastStartIndex + 1)} ${yScale(forecast[0].upper)}
      ${forecast.map((d, i) => `L ${xScale(forecastStartIndex + i + 1)} ${yScale(d.upper)}`).join(' ')}
      ${forecast.slice().reverse().map((d, i) => `L ${xScale(forecastStartIndex + forecast.length - i)} ${yScale(d.lower)}`).join(' ')}
      Z
    `
    : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="traffic-svg">
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = padding.top + ratio * (height - padding.top - padding.bottom);
        const value = Math.round(maxValue - ratio * (maxValue - minValue));
        return (
          <g key={ratio}>
            <line 
              x1={padding.left} 
              y1={y} 
              x2={width - padding.right} 
              y2={y} 
              className="grid-line"
            />
            <text x={padding.left - 10} y={y + 4} className="axis-label">
              {value}
            </text>
          </g>
        );
      })}

      {ciPath && <path d={ciPath} className="confidence-area" />}
      <path d={historicalPath} className="line-historical" />
      {connectionPath && <path d={connectionPath} className="line-connection" />}
      {forecastPath && <path d={forecastPath} className="line-forecast" />}

      {forecast.length > 0 && (
        <>
          <line 
            x1={xScale(historical.length - 0.5)} 
            y1={padding.top} 
            x2={xScale(historical.length - 0.5)} 
            y2={height - padding.bottom}
            className="forecast-divider"
          />
          <text 
            x={xScale(historical.length - 0.5)} 
            y={height - padding.bottom + 20} 
            className="divider-label"
          >
            Now
          </text>
        </>
      )}
    </svg>
  );
}

export default LogAnalytics;
