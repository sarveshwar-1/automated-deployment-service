// Traffic Monitor - Detects high-traffic endpoints and triggers isolation
import Redis from 'ioredis';
import { portRegistry } from './port-registry';
import { projectManager } from './project-manager';
import { REDIS_HOST, REDIS_PORT, ISOLATION_THRESHOLD_RPM } from './config/env';

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
});

// Keys for traffic tracking (matches nginx/lua/traffic.lua format)
const TRAFFIC_KEY_PREFIX = 'traffic:';

/**
 * Get request count for an endpoint in the current minute
 */
async function getTrafficCount(projectId: string, endpoint: string): Promise<number> {
  const minute = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const key = `${projectId}:${endpoint}:${minute}`;
  
  // Also check previous minute for smoothing
  const prevMinute = new Date(Date.now() - 60000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const prevKey = `${projectId}:${endpoint}:${prevMinute}`;

  const [current, prev] = await Promise.all([
    redis.get(key),
    redis.get(prevKey),
  ]);

  // Use max of current and previous for more accurate detection
  return Math.max(parseInt(current || '0'), parseInt(prev || '0'));
}

/**
 * Check all endpoints and isolate if needed
 */
async function checkAndIsolate(): Promise<void> {
  const projects = portRegistry.getAllProjects();

  for (const [projectId, config] of Object.entries(projects)) {
    if (config.status !== 'running') continue;

    // Get all traffic keys for this project
    const pattern = `${projectId}:*`;
    const keys = await scanKeys(pattern);
    
    // Group by endpoint
    const endpointCounts: Record<string, number> = {};
    
    for (const key of keys) {
      // Key format: projectId:endpoint:minute
      const parts = key.split(':');
      if (parts.length >= 2) {
        const endpoint = parts[1];
        const count = parseInt(await redis.get(key) || '0');
        endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + count;
      }
    }

    // Check for endpoints exceeding threshold
    for (const [endpoint, count] of Object.entries(endpointCounts)) {
      // Skip already isolated endpoints
      if (config.isolatedEndpoints[endpoint]) continue;

      if (count > ISOLATION_THRESHOLD_RPM) {
        console.log(`🔥 High traffic detected: ${projectId}${endpoint} (${count} req/min)`);
        
        try {
          // Isolate the endpoint
          const isolatedPort = portRegistry.isolateEndpoint(projectId, endpoint);
          
          // Start a dedicated server for this endpoint
          await projectManager.startProject(projectId, config.type, config.outputDir);
          
          console.log(`✅ Isolated ${projectId}${endpoint} to port ${isolatedPort}`);
        } catch (err: any) {
          console.error(`❌ Failed to isolate ${projectId}${endpoint}: ${err.message}`);
        }
      }
    }
  }
}

/**
 * Scan Redis keys matching pattern
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [newCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');

  return keys;
}

// Traffic monitoring interval (check every 30 seconds)
let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Start traffic monitoring
 */
export function startTrafficMonitor(): void {
  if (monitorInterval) return;

  console.log(`📊 Starting traffic monitor (threshold: ${ISOLATION_THRESHOLD_RPM} req/min)`);
  
  monitorInterval = setInterval(() => {
    checkAndIsolate().catch(err => {
      console.error('❌ Traffic monitor error:', err);
    });
  }, 30000); // Every 30 seconds
}

/**
 * Stop traffic monitoring
 */
export function stopTrafficMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export default { startTrafficMonitor, stopTrafficMonitor };
