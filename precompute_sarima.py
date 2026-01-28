"""
Pre-compute SARIMA results and save to JSON
Run this script locally to generate results that will be served by the API
"""

import os
import re
import json
from datetime import datetime
import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.metrics import mean_squared_error
import warnings

warnings.filterwarnings('ignore')

ACCESS_LOG_PATH = './access.log'
OUTPUT_PATH = './analytics-service/precomputed_results.json'


def parse_access_log_line(line: str):
    try:
        regex = r'^(\S+) - - \[(.*?)\] "(\S+) (\S+) \S+" (\d+) (\d+) "(.*?)" "(.*?)"'
        match = re.match(regex, line)
        
        if not match:
            return None
        
        ip, date_str, method, path, status, size, referer, user_agent = match.groups()
        
        date_regex = r'(\d+)/(\w+)/(\d+):(\d+):(\d+):(\d+) ([+-]\d{4})'
        date_match = re.match(date_regex, date_str)
        
        if not date_match:
            return None
        
        day, month_str, year, hour, minute, second, tz = date_match.groups()
        
        months = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        }
        
        month = months.get(month_str)
        if month is None:
            return None
        
        timestamp = datetime(int(year), month, int(day), int(hour), int(minute), int(second))
        
        return {
            'timestamp': timestamp,
            'method': method,
            'path': path,
            'status_code': int(status),
            'ip': ip
        }
    except Exception:
        return None


def read_access_log_sampled(target_samples: int = 500000):
    print(f"Reading access.log with target {target_samples} samples...")
    
    file_size = os.path.getsize(ACCESS_LOG_PATH)
    estimated_lines = file_size // 350
    sample_rate = max(1, estimated_lines // target_samples)
    
    print(f"File size: {file_size / (1024*1024*1024):.2f} GB")
    print(f"Estimated lines: {estimated_lines:,}")
    print(f"Sample rate: every {sample_rate} lines")
    
    logs = []
    line_count = 0
    
    with open(ACCESS_LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line_count += 1
            if line_count % sample_rate == 0:
                parsed = parse_access_log_line(line.strip())
                if parsed:
                    logs.append(parsed)
                    if len(logs) >= target_samples:
                        break
            if line_count % 1000000 == 0:
                print(f"  Processed {line_count:,} lines, collected {len(logs):,} samples...")
    
    print(f"Collected {len(logs):,} log entries")
    return logs


def aggregate_hourly(logs):
    print("Aggregating by hour...")
    df = pd.DataFrame(logs)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.floor('H')
    
    hourly = df.groupby('hour').agg({
        'ip': 'count',
        'status_code': lambda x: (x >= 400).sum()
    }).reset_index()
    
    hourly.columns = ['timestamp', 'request_count', 'error_count']
    hourly = hourly.sort_values('timestamp').reset_index(drop=True)
    
    # Fill gaps
    full_range = pd.date_range(
        start=hourly['timestamp'].min(),
        end=hourly['timestamp'].max(),
        freq='H'
    )
    hourly = hourly.set_index('timestamp').reindex(full_range, fill_value=0).reset_index()
    hourly.columns = ['timestamp', 'request_count', 'error_count']
    
    print(f"Created {len(hourly)} hourly data points")
    return hourly


def run_sarima(hourly_data):
    print("Running SARIMA analysis...")
    
    ts = hourly_data.set_index('timestamp')['request_count']
    
    # 80/20 split
    n = len(ts)
    split_idx = int(n * 0.8)
    train_ts = ts.iloc[:split_idx]
    test_ts = ts.iloc[split_idx:]
    
    print(f"Training: {len(train_ts)} hours, Test: {len(test_ts)} hours")
    
    # Fit SARIMA
    print("Fitting SARIMA(1,1,1)(1,1,1,24)...")
    model = SARIMAX(
        train_ts,
        order=(1, 1, 1),
        seasonal_order=(1, 1, 1, 24),
        enforce_stationarity=False,
        enforce_invertibility=False
    )
    
    fitted = model.fit(disp=False, maxiter=200)
    print(f"Model fitted. AIC: {fitted.aic:.2f}, BIC: {fitted.bic:.2f}")
    
    # Predict
    forecast = fitted.get_forecast(steps=len(test_ts))
    predictions = forecast.predicted_mean
    conf_int = forecast.conf_int(alpha=0.05)
    
    predictions.index = test_ts.index
    conf_int.index = test_ts.index
    
    # Metrics
    rmse = np.sqrt(mean_squared_error(test_ts, predictions))
    non_zero = test_ts != 0
    if non_zero.sum() > 0:
        mape = np.mean(np.abs((test_ts[non_zero] - predictions[non_zero]) / test_ts[non_zero])) * 100
    else:
        mape = 0
    mae = np.mean(np.abs(test_ts - predictions))
    
    print(f"RMSE: {rmse:.2f}, MAPE: {mape:.2f}%, MAE: {mae:.2f}")
    
    # Format training data (show 2x test length)
    train_display = train_ts.tail(len(test_ts) * 2)
    training_data = [
        {'timestamp': t.isoformat(), 'count': max(0, int(v))}
        for t, v in train_display.items()
    ]
    
    # Format actual test data
    actual_data = [
        {'timestamp': t.isoformat(), 'count': max(0, int(v))}
        for t, v in test_ts.items()
    ]
    
    # Format predictions
    sarima_predictions = []
    for i, (t, pred) in enumerate(predictions.items()):
        sarima_predictions.append({
            'timestamp': t.isoformat(),
            'predicted': max(0, int(pred)),
            'lower': max(0, int(conf_int.iloc[i, 0])),
            'upper': max(0, int(conf_int.iloc[i, 1]))
        })
    
    return {
        'training_data': training_data,
        'actual_data': actual_data,
        'sarima_predictions': sarima_predictions,
        'model_info': {
            'aic': round(fitted.aic, 2),
            'bic': round(fitted.bic, 2),
            'order': '(1, 1, 1)',
            'seasonal_order': '(1, 1, 1, 24)'
        },
        'metrics': {
            'RMSE': round(rmse, 2),
            'MAPE': round(mape, 2),
            'MAE': round(mae, 2)
        },
        'data_info': {
            'total_hours': n,
            'training_hours': len(train_ts),
            'test_hours': len(test_ts)
        }
    }


def compute_stats(logs):
    print("Computing statistics...")
    df = pd.DataFrame(logs)
    
    total = len(df)
    unique_ips = df['ip'].nunique()
    errors = (df['status_code'] >= 400).sum()
    error_rate = round((errors / total) * 100, 2)
    
    top_paths = df['path'].value_counts().head(10).reset_index()
    top_paths.columns = ['path', 'count']
    
    df['status_group'] = (df['status_code'] // 100).astype(str) + 'xx'
    status_dist = df['status_group'].value_counts().reset_index()
    status_dist.columns = ['status', 'count']
    
    return {
        'total_requests': total,
        'unique_ips': unique_ips,
        'error_rate': error_rate,
        'top_paths': top_paths.to_dict('records'),
        'status_distribution': status_dist.to_dict('records')
    }


def compute_seasonality(hourly_data):
    ts = hourly_data.set_index('timestamp')['request_count']
    
    hourly = ts.groupby(ts.index.hour).mean().reindex(range(24), fill_value=0).tolist()
    daily = ts.groupby(ts.index.dayofweek).mean().reindex(range(7), fill_value=0).tolist()
    
    return {
        'hourly': [round(x, 2) for x in hourly],
        'daily': [round(x, 2) for x in daily]
    }


def main():
    print("=" * 60)
    print("SARIMA Pre-computation Script")
    print("=" * 60)
    
    # Read logs
    logs = read_access_log_sampled(500000)
    
    # Aggregate
    hourly_data = aggregate_hourly(logs)
    
    # Run SARIMA
    sarima_result = run_sarima(hourly_data)
    
    # Stats
    stats = compute_stats(logs)
    
    # Seasonality
    seasonality = compute_seasonality(hourly_data)
    
    # Combine results
    results = {
        'success': True,
        'stats': stats,
        'training_data': sarima_result['training_data'],
        'actual_data': sarima_result['actual_data'],
        'sarima_predictions': sarima_result['sarima_predictions'],
        'model_info': sarima_result['model_info'],
        'metrics': sarima_result['metrics'],
        'data_info': sarima_result['data_info'],
        'seasonality': seasonality
    }
    
    # Save
    print(f"\nSaving results to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(results, f, indent=2)
    
    print("Done!")
    print(f"\nSummary:")
    print(f"  Total hours: {sarima_result['data_info']['total_hours']}")
    print(f"  Training: {sarima_result['data_info']['training_hours']} hours")
    print(f"  Test: {sarima_result['data_info']['test_hours']} hours")
    print(f"  RMSE: {sarima_result['metrics']['RMSE']}")
    print(f"  MAPE: {sarima_result['metrics']['MAPE']}%")


if __name__ == '__main__':
    main()
