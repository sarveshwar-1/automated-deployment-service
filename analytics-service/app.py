"""
Access Log Analytics Service
Serves pre-computed SARIMA results for instant loading
"""

import os
import json
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PRECOMPUTED_PATH = '/app/precomputed_results.json'

# Load precomputed results at startup
precomputed_results = None

def load_precomputed():
    global precomputed_results
    if os.path.exists(PRECOMPUTED_PATH):
        with open(PRECOMPUTED_PATH, 'r') as f:
            precomputed_results = json.load(f)
        print(f"✅ Loaded precomputed results from {PRECOMPUTED_PATH}")
    else:
        print(f"⚠️ No precomputed results found at {PRECOMPUTED_PATH}")
        precomputed_results = None


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'analytics'})


@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """
    Returns pre-computed SARIMA analysis results.
    No computation is done here - just serves the saved JSON.
    """
    if precomputed_results is None:
        return jsonify({
            'success': False,
            'error': 'No precomputed results',
            'message': 'SARIMA results have not been precomputed yet.'
        }), 404
    
    # Ensure all required fields exist for frontend compatibility
    result = dict(precomputed_results)
    
    # Add avg_response_time if missing (not available in access.log)
    if 'stats' in result and 'avg_response_time' not in result['stats']:
        result['stats']['avg_response_time'] = 0
    
    # Add future_forecast if missing (empty array is fine)
    if 'future_forecast' not in result:
        result['future_forecast'] = []
    
    return jsonify(result)


# Load results when app starts
load_precomputed()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
