import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/LogAnalytics.css";
import { ANALYTICS_SERVICE_URL } from "../config";

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
  trainingData: TimeSeriesData[];
  actualData: TimeSeriesData[];
  sarimaPredictions: ForecastData[];
  futureForecast: ForecastData[];
  seasonality: {
    hourly: number[];
    daily: number[];
  };
  modelInfo: {
    aic?: number;
    bic?: number;
    order?: string;
    seasonal_order?: string;
  };
  metrics: {
    RMSE: number;
    MAPE: number;
    MAE: number;
  };
  dataInfo: {
    total_hours: number;
    training_hours: number;
    test_hours: number;
    forecast_hours: number;
  };
}

function TestLogAnalytics() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AnalyticsResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalytics = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(
        `${ANALYTICS_SERVICE_URL}/api/analytics?samples=200000`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch analytics");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Analytics failed");
      }

      const analyticsResults: AnalyticsResults = {
        totalRequests: data.stats.total_requests,
        uniqueIPs: data.stats.unique_ips,
        avgResponseTime: data.stats.avg_response_time,
        errorRate: data.stats.error_rate,
        topPaths: data.stats.top_paths,
        statusDistribution: data.stats.status_distribution,
        trainingData: data.training_data,
        actualData: data.actual_data,
        sarimaPredictions: data.sarima_predictions,
        futureForecast: data.future_forecast,
        seasonality: data.seasonality,
        modelInfo: data.model_info,
        metrics: data.metrics,
        dataInfo: data.data_info,
      };

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
        <h1 className="nav-title">SARIMA Traffic Forecast</h1>
        <div className="nav-project">access.log</div>
      </div>

      <div className="analytics-container">
        <div className="pipeline-section">
          <div className="section-header">
            <h2>SARIMA Time Series Analysis</h2>
            <button
              className="run-btn"
              onClick={runAnalytics}
              disabled={isRunning}
            >
              {isRunning ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>

          <p className="section-description">
            Fits a SARIMA model on 80% training data and evaluates predictions against 20% test data.
            Shows training data (blue), actual test values (green), SARIMA forecast (red dashed), 
            and 95% confidence intervals.
          </p>

          {isRunning && (
            <div className="loading-message">
              Fitting SARIMA model and generating forecasts...
            </div>
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
            {/* Model Info & Metrics Banner */}
            <div className="model-metrics-row">
              <div className="model-info-banner">
                <h3>Model Information</h3>
                <div className="model-info-grid">
                  {results.modelInfo.order && (
                    <>
                      <span className="info-label">ARIMA Order:</span>
                      <span className="info-value">{results.modelInfo.order}</span>
                    </>
                  )}
                  {results.modelInfo.seasonal_order && (
                    <>
                      <span className="info-label">Seasonal Order:</span>
                      <span className="info-value">{results.modelInfo.seasonal_order}</span>
                    </>
                  )}
                  {results.modelInfo.aic && (
                    <>
                      <span className="info-label">AIC:</span>
                      <span className="info-value">{results.modelInfo.aic}</span>
                    </>
                  )}
                  {results.modelInfo.bic && (
                    <>
                      <span className="info-label">BIC:</span>
                      <span className="info-value">{results.modelInfo.bic}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="metrics-banner">
                <h3>Model Evaluation</h3>
                <div className="metrics-inline">
                  <div className="metric-item">
                    <span className="metric-name">RMSE</span>
                    <span className="metric-val">{results.metrics.RMSE.toLocaleString()}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">MAPE</span>
                    <span className="metric-val">{results.metrics.MAPE}%</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-name">MAE</span>
                    <span className="metric-val">{results.metrics.MAE.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="data-info-banner">
                <h3>Data Split</h3>
                <div className="data-info-grid">
                  <span className="info-label">Total Hours:</span>
                  <span className="info-value">{results.dataInfo.total_hours}</span>
                  <span className="info-label">Training:</span>
                  <span className="info-value">{results.dataInfo.training_hours}h (80%)</span>
                  <span className="info-label">Test:</span>
                  <span className="info-value">{results.dataInfo.test_hours}h (20%)</span>
                </div>
              </div>
            </div>

            {/* Main SARIMA Chart */}
            <div className="chart-card sarima-chart">
              <h3>SARIMA Traffic Forecast vs Actual</h3>
              <div className="chart-container-large">
                <SARIMAChart
                  trainingData={results.trainingData}
                  actualData={results.actualData}
                  predictions={results.sarimaPredictions}
                />
              </div>
              <div className="chart-legend sarima-legend">
                <span className="legend-item">
                  <span className="legend-line training" />
                  Training Data
                </span>
                <span className="legend-item">
                  <span className="legend-line actual" />
                  Actual (Test)
                </span>
                <span className="legend-item">
                  <span className="legend-line forecast" />
                  SARIMA Forecast
                </span>
                <span className="legend-item">
                  <span className="legend-color confidence" />
                  95% Confidence Interval
                </span>
              </div>
            </div>

            {/* Statistics Cards */}
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

            {/* Seasonality Charts */}
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
                        ((results.seasonality.daily[i] - minVal) / range) * 100
                      );
                      return (
                        <div key={day} className="bar-item">
                          <div className="bar" style={{ height: `${height}%` }} />
                          <span className="bar-label">{day}</span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* Status & Paths */}
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
                        {path.length > 30 ? path.substring(0, 30) + "..." : path}
                      </span>
                      <span className="path-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Future Forecast Table */}
            <div className="chart-card">
              <h3>24-Hour Future Forecast</h3>
              <div className="forecast-table">
                <div className="forecast-header">
                  <span>Time</span>
                  <span>Predicted</span>
                  <span>Lower (95%)</span>
                  <span>Upper (95%)</span>
                </div>
                <div className="forecast-body">
                  {results.futureForecast.map((f, i) => (
                    <div key={i} className="forecast-row">
                      <span>
                        {new Date(f.timestamp).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="predicted">{f.predicted.toLocaleString()}</span>
                      <span className="lower">{f.lower.toLocaleString()}</span>
                      <span className="upper">{f.upper.toLocaleString()}</span>
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

/**
 * SARIMA Chart Component
 * Displays training data (blue), actual test data (green), 
 * SARIMA predictions (red dashed), and confidence intervals (red shaded)
 */
function SARIMAChart({
  trainingData,
  actualData,
  predictions,
}: {
  trainingData: TimeSeriesData[];
  actualData: TimeSeriesData[];
  predictions: ForecastData[];
}) {
  if (trainingData.length === 0 && actualData.length === 0) {
    return <div className="no-data">No data available</div>;
  }

  const width = 900;
  const height = 350;
  const padding = { top: 30, right: 30, bottom: 50, left: 70 };

  // Combine all values for y-axis scaling
  const allValues = [
    ...trainingData.map((d) => d.count),
    ...actualData.map((d) => d.count),
    ...predictions.map((d) => d.upper),
    ...predictions.map((d) => d.predicted),
  ];
  const maxValue = Math.max(...allValues) * 1.1 || 10;
  const minValue = 0;

  // Calculate total points for x-axis
  const totalPoints = trainingData.length + actualData.length;
  
  const xScale = (i: number) =>
    padding.left + (i / Math.max(1, totalPoints - 1)) * (width - padding.left - padding.right);
  
  const yScale = (v: number) =>
    height - padding.bottom - ((v - minValue) / (maxValue - minValue)) * (height - padding.top - padding.bottom);

  // Training data path (blue)
  const trainingPath = trainingData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.count)}`)
    .join(" ");

  // Actual test data path (green)
  const actualStartIdx = trainingData.length;
  const actualPath = actualData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(actualStartIdx + i)} ${yScale(d.count)}`)
    .join(" ");

  // SARIMA predictions path (red dashed)
  const predictionsPath = predictions
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(actualStartIdx + i)} ${yScale(d.predicted)}`)
    .join(" ");

  // Confidence interval area (red shaded)
  const ciPath = predictions.length > 0 ? `
    M ${xScale(actualStartIdx)} ${yScale(predictions[0].upper)}
    ${predictions.map((d, i) => `L ${xScale(actualStartIdx + i)} ${yScale(d.upper)}`).join(" ")}
    ${predictions.slice().reverse().map((d, i) => 
      `L ${xScale(actualStartIdx + predictions.length - 1 - i)} ${yScale(d.lower)}`
    ).join(" ")}
    Z
  ` : "";

  // Generate time labels for x-axis
  const getTimeLabels = () => {
    const labels: { x: number; label: string }[] = [];
    const allData = [...trainingData, ...actualData];
    const step = Math.max(1, Math.floor(allData.length / 6));
    
    for (let i = 0; i < allData.length; i += step) {
      const date = new Date(allData[i].timestamp);
      labels.push({
        x: xScale(i),
        label: date.toLocaleDateString([], { month: "short", day: "numeric" }) + 
               " " + date.toLocaleTimeString([], { hour: "2-digit" }),
      });
    }
    return labels;
  };

  const timeLabels = getTimeLabels();

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: padding.top + ratio * (height - padding.top - padding.bottom),
    value: Math.round(maxValue - ratio * (maxValue - minValue)),
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sarima-svg">
      {/* Grid lines */}
      {yLabels.map(({ y, value }) => (
        <g key={value}>
          <line
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            className="grid-line"
          />
          <text x={padding.left - 10} y={y + 4} className="axis-label" textAnchor="end">
            {value.toLocaleString()}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {timeLabels.map(({ x, label }, i) => (
        <text
          key={i}
          x={x}
          y={height - padding.bottom + 20}
          className="axis-label"
          textAnchor="middle"
          fontSize="10"
        >
          {label}
        </text>
      ))}

      {/* Confidence interval (draw first, behind lines) */}
      {ciPath && <path d={ciPath} className="ci-area" />}

      {/* Training data line (blue) */}
      <path d={trainingPath} className="line-training" />

      {/* Actual test data line (green) */}
      <path d={actualPath} className="line-actual" />

      {/* SARIMA predictions line (red dashed) */}
      <path d={predictionsPath} className="line-sarima" />

      {/* Vertical divider at train/test split */}
      <line
        x1={xScale(trainingData.length - 0.5)}
        y1={padding.top}
        x2={xScale(trainingData.length - 0.5)}
        y2={height - padding.bottom}
        className="split-divider"
      />
      <text
        x={xScale(trainingData.length - 0.5)}
        y={padding.top - 10}
        className="divider-label"
        textAnchor="middle"
      >
        Train/Test Split
      </text>

      {/* Axis labels */}
      <text
        x={width / 2}
        y={height - 5}
        className="axis-title"
        textAnchor="middle"
      >
        Time
      </text>
      <text
        x={15}
        y={height / 2}
        className="axis-title"
        textAnchor="middle"
        transform={`rotate(-90, 15, ${height / 2})`}
      >
        Requests per Hour
      </text>
    </svg>
  );
}

export default TestLogAnalytics;
