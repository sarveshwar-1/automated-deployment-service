import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/LogAnalytics.css";
import { BUILD_SERVICE_URL } from "../config";

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

function TestLogAnalytics() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AnalyticsResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Fetch logs from access.log via API
  const fetchLogs = async (): Promise<LogEntry[]> => {
    const response = await fetch(
      `${BUILD_SERVICE_URL}/api/test-logs/access?limit=5000`,
    );
    if (!response.ok) throw new Error("Failed to fetch logs");

    const data = await response.json();
    const logs = data.logs.map((log: Record<string, unknown>) => ({
      timestamp: new Date(log.timestamp as string),
      method: log.method as string,
      path: log.path as string,
      statusCode: log.statusCode as number,
      responseTime: log.responseTime as number,
      ip: log.ip as string,
    }));

    return logs;
  };

  // Step 2: Parse and validate data
  const parseData = async (logs: LogEntry[]): Promise<LogEntry[]> => {
    const parsed = logs.filter(
      (log) =>
        log.timestamp instanceof Date &&
        !isNaN(log.timestamp.getTime()) &&
        typeof log.statusCode === "number" &&
        typeof log.responseTime === "number",
    );
    return parsed;
  };

  // Step 3: Clean data (remove outliers)
  const cleanData = async (logs: LogEntry[]): Promise<LogEntry[]> => {
    if (logs.length === 0) return logs;

    const responseTimes = logs.map((l) => l.responseTime);
    const mean =
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const std = Math.sqrt(
      responseTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        responseTimes.length,
    );

    const cleaned = logs.filter(
      (log) => Math.abs(log.responseTime - mean) <= 3 * std,
    );
    return cleaned;
  };

  // Step 4: Aggregate data by hour
  const aggregateData = async (logs: LogEntry[]): Promise<TimeSeriesData[]> => {
    const hourlyMap = new Map<string, number>();

    logs.forEach((log) => {
      const hour = new Date(log.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      hourlyMap.set(key, (hourlyMap.get(key) || 0) + 1);
    });

    const hourlyData: TimeSeriesData[] = Array.from(hourlyMap.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    return hourlyData;
  };

  // Step 5: Decompose time series
  const decomposeTimeSeries = async (
    data: TimeSeriesData[],
  ): Promise<{
    trend: number[];
    seasonal: number[];
    residual: number[];
    hourlyPattern: number[];
    dailyPattern: number[];
  }> => {
    const values = data.map((d) => d.count);
    const n = values.length;

    if (n === 0) {
      return {
        trend: [],
        seasonal: [],
        residual: [],
        hourlyPattern: new Array(24).fill(0),
        dailyPattern: new Array(7).fill(0),
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

    const seasonal = data.map((d) => {
      const hour = new Date(d.timestamp).getHours();
      return hourlyPattern[hour];
    });

    const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

    return { trend, seasonal, residual, hourlyPattern, dailyPattern };
  };

  // Step 6: Fit SARIMA model
  const fitSARIMA = async (
    data: TimeSeriesData[],
    decomposition: { trend: number[]; seasonal: number[]; residual: number[] },
  ): Promise<{ phi: number[]; theta: number[]; sigma: number }> => {
    const values = data.map((d) => d.count);
    const n = values.length;

    if (n < 2) {
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
    const sigma =
      residuals.length > 0
        ? Math.sqrt(
            residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length,
          )
        : 1;

    return { phi: [phi1], theta: [], sigma };
  };

  // Step 7: Generate forecast
  const generateForecast = async (
    data: TimeSeriesData[],
    model: { phi: number[]; theta: number[]; sigma: number },
    decomposition: { trend: number[]; hourlyPattern: number[] },
  ): Promise<ForecastData[]> => {
    const forecast: ForecastData[] = [];

    if (data.length === 0) {
      return forecast;
    }

    const lastTimestamp = new Date(data[data.length - 1].timestamp);
    const lastValue = data[data.length - 1].count;
    const mean = data.reduce((sum, d) => sum + d.count, 0) / data.length;

    for (let h = 1; h <= 24; h++) {
      const forecastTime = new Date(
        lastTimestamp.getTime() + h * 60 * 60 * 1000,
      );
      const hour = forecastTime.getHours();

      const arForecast = mean + model.phi[0] * (lastValue - mean);
      const seasonalAdj = decomposition.hourlyPattern[hour] || 0;
      const predicted = Math.max(0, arForecast + seasonalAdj);

      const ci = 1.96 * model.sigma * Math.sqrt(h);

      forecast.push({
        timestamp: forecastTime.toISOString(),
        predicted: Math.round(predicted),
        lower: Math.max(0, Math.round(predicted - ci)),
        upper: Math.round(predicted + ci),
      });
    }

    return forecast;
  };

  // Step 8: Generate final visualization data
  const generateVisualization = async (
    logs: LogEntry[],
    hourlyData: TimeSeriesData[],
    forecast: ForecastData[],
    decomposition: { hourlyPattern: number[]; dailyPattern: number[] },
  ): Promise<AnalyticsResults> => {
    const totalRequests = logs.length;
    const uniqueIPs = new Set(logs.map((l) => l.ip)).size;
    const avgResponseTime =
      logs.length > 0
        ? logs.reduce((sum, l) => sum + l.responseTime, 0) / logs.length
        : 0;
    const errorCount = logs.filter((l) => l.statusCode >= 400).length;
    const errorRate =
      totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const pathCounts = new Map<string, number>();
    logs.forEach((log) => {
      pathCounts.set(log.path, (pathCounts.get(log.path) || 0) + 1);
    });
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const statusCounts = new Map<string, number>();
    logs.forEach((log) => {
      const status = `${Math.floor(log.statusCode / 100)}xx`;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    const statusDistribution = Array.from(statusCounts.entries()).map(
      ([status, count]) => ({ status, count }),
    );

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
        daily: decomposition.dailyPattern,
      },
    };

    return analyticsResults;
  };

  const runAnalytics = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const logs = await fetchLogs();

      if (logs.length === 0) {
        throw new Error("No logs found in access.log file.");
      }

      const parsed = await parseData(logs);
      const cleaned = await cleanData(parsed);
      const hourlyData = await aggregateData(cleaned);

      if (hourlyData.length < 2) {
        throw new Error(
          "Insufficient data for time series analysis. Need at least 2 hours of data.",
        );
      }

      const decomposition = await decomposeTimeSeries(hourlyData);
      const model = await fitSARIMA(hourlyData, decomposition);
      const forecast = await generateForecast(hourlyData, model, decomposition);
      const analyticsResults = await generateVisualization(
        cleaned,
        hourlyData,
        forecast,
        decomposition,
      );

      setResults(analyticsResults);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred during analysis";
      setError(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="analytics-wrapper">
      <div className="analytics-nav">
        <button onClick={() => navigate("/projects")} className="nav-back">
          ← Back to Projects
        </button>
        <h1 className="nav-title">Test Log Analytics</h1>
        <div className="nav-project">access.log</div>
      </div>

      <div className="analytics-container">
        <div className="pipeline-section">
          <div className="section-header">
            <h2>Log Analytics</h2>
            <button
              className="run-btn"
              onClick={runAnalytics}
              disabled={isRunning}
            >
              {isRunning ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>

          {isRunning && (
            <div className="loading-message">Analyzing log data...</div>
          )}

          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}
        </div>

        {results && (
          <div className="results-section">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Requests</div>
                <div className="metric-value">
                  {results.totalRequests.toLocaleString()}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Unique IPs</div>
                <div className="metric-value">
                  {results.uniqueIPs.toLocaleString()}
                </div>
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
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, i) => {
                      const minVal = Math.min(...results.seasonality.daily);
                      const maxVal = Math.max(...results.seasonality.daily);
                      const range = maxVal - minVal || 1;
                      const height = Math.max(
                        5,
                        ((results.seasonality.daily[i] - minVal) / range) * 100,
                      );
                      return (
                        <div key={day} className="bar-item">
                          <div
                            className="bar"
                            style={{ height: `${height}%` }}
                          />
                          <span className="bar-label">{day}</span>
                        </div>
                      );
                    },
                  )}
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
                          className={`status-bar status-${status.replace("xx", "")}`}
                          style={{
                            width: `${(count / results.totalRequests) * 100}%`,
                          }}
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
                        {path.length > 30
                          ? path.substring(0, 30) + "..."
                          : path}
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
                      <span>
                        {new Date(f.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
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
  forecast,
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
    ...historical.map((d) => d.count),
    ...forecast.map((d) => d.upper),
  ];
  const maxValue = Math.max(...allValues) * 1.1 || 10;
  const minValue = 0;

  const totalPoints = historical.length + forecast.length;
  const xScale = (i: number) =>
    padding.left +
    (i / Math.max(1, totalPoints - 1)) * (width - padding.left - padding.right);
  const yScale = (v: number) =>
    height -
    padding.bottom -
    ((v - minValue) / (maxValue - minValue)) *
      (height - padding.top - padding.bottom);

  const historicalPath = historical
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.count)}`)
    .join(" ");

  const forecastStartIndex = historical.length - 1;
  const forecastPath =
    forecast.length > 0
      ? forecast
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(forecastStartIndex + i + 1)} ${yScale(d.predicted)}`,
          )
          .join(" ")
      : "";

  const connectionPath =
    forecast.length > 0
      ? `M ${xScale(historical.length - 1)} ${yScale(historical[historical.length - 1].count)} L ${xScale(historical.length)} ${yScale(forecast[0].predicted)}`
      : "";

  const ciPath =
    forecast.length > 0
      ? `
      M ${xScale(forecastStartIndex + 1)} ${yScale(forecast[0].upper)}
      ${forecast.map((d, i) => `L ${xScale(forecastStartIndex + i + 1)} ${yScale(d.upper)}`).join(" ")}
      ${forecast
        .slice()
        .reverse()
        .map(
          (d, i) =>
            `L ${xScale(forecastStartIndex + forecast.length - i)} ${yScale(d.lower)}`,
        )
        .join(" ")}
      Z
    `
      : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="traffic-svg">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
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
      {connectionPath && (
        <path d={connectionPath} className="line-connection" />
      )}
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

export default TestLogAnalytics;
