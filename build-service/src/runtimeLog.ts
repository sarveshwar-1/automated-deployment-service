import mongoose from "mongoose";

/**
 * Runtime Log Schema
 * 
 * Purpose: Track all HTTP requests to deployed websites
 * Used for: Analytics, debugging, monitoring traffic
 * 
 * Key Features:
 * - TTL index: Auto-deletes logs older than 30 days
 * - Compound index: Fast queries by projectId + timestamp
 * - Error filtering: Separate index for error logs
 */

const runtimeLogSchema = new mongoose.Schema({
  // === IDENTIFICATION ===
  timestamp: { 
    type: Date, 
    default: Date.now,
    required: true
  },
  projectId: { 
    type: String, 
    required: true,
    index: true  // Fast lookup by project
  },
  requestId: { 
    type: String,  // UUID for request tracing
    required: true 
  },
  
  // === REQUEST DETAILS ===
  method: { 
    type: String,  // GET, POST, etc.
    required: true 
  },
  path: { 
    type: String,  // /index.html, /assets/app.js
    required: true 
  },
  statusCode: { 
    type: Number,  // 200, 404, 500
    required: true,
    index: true    // Filter by status
  },
  
  // === PERFORMANCE METRICS ===
  responseTime: { 
    type: Number,  // Milliseconds
    required: true 
  },
  fileSize: { 
    type: Number,  // Bytes served
    default: 0 
  },
  
  // === CLIENT INFORMATION ===
  ip: { 
    type: String,  // Client IP address
    required: true 
  },
  userAgent: { 
    type: String,  // Browser/device info
    default: '' 
  },
  referer: { 
    type: String,  // Where they came from
    default: '' 
  },
  
  // === RESPONSE DETAILS ===
  contentType: { 
    type: String,  // text/html, application/javascript
    default: '' 
  },
  
  // === ERROR INFORMATION ===
  isError: { 
    type: Boolean, 
    default: false,
    index: true    // Fast error filtering
  },
  error: { 
    type: String,  // Error message
    default: '' 
  },
  errorType: { 
    type: String,  // NotFound, MinIOTimeout, StreamError
    default: '' 
  },
  errorStack: { 
    type: String,  // Stack trace for debugging
    default: '' 
  }
});

// === INDEXES FOR PERFORMANCE ===

/**
 * Compound Index: projectId + timestamp (descending)
 * 
 * Why: Most common query is "get recent logs for a specific project"
 * Example: db.runtimeLogs.find({ projectId: "abc-123" }).sort({ timestamp: -1 })
 * 
 * Without this index: O(n) - scans entire collection
 * With this index: O(log n) - direct lookup
 */
runtimeLogSchema.index({ projectId: 1, timestamp: -1 });

/**
 * TTL Index: Auto-delete old logs after 30 days
 * 
 * Why: Prevent infinite log growth
 * How: MongoDB checks every 60 seconds, deletes expired documents
 * 
 * 2592000 seconds = 30 days
 */
runtimeLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

/**
 * Error Filtering Index: projectId + isError + timestamp
 * 
 * Why: Quickly find error logs for a project
 * Example: db.runtimeLogs.find({ projectId: "abc-123", isError: true })
 */
runtimeLogSchema.index({ projectId: 1, isError: 1, timestamp: -1 });

// Create and export the model
export const RuntimeLogModel = mongoose.model('RuntimeLog', runtimeLogSchema);

/**
 * Interface for TypeScript type safety
 */
export interface RuntimeLog {
  timestamp: Date;
  projectId: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  fileSize: number;
  ip: string;
  userAgent: string;
  referer: string;
  contentType: string;
  isError: boolean;
  error?: string;
  errorType?: string;
  errorStack?: string;
}
