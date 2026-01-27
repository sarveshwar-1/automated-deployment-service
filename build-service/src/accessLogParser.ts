import fs from 'fs';
import readline from 'readline';

/**
 * Access Log Parser
 * Parses standard Apache/Nginx access.log format
 * Format: IP - - [Date] "METHOD PATH HTTP/VERSION" STATUS SIZE "REFERER" "USER_AGENT" "-"
 */

export interface ParsedLogEntry {
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  ip: string;
  userAgent?: string;
  referer?: string;
}

/**
 * Parse a single log line
 * Example: 54.36.149.41 - - [22/Jan/2019:03:56:14 +0330] "GET /filter/27 HTTP/1.1" 200 30577 "-" "Mozilla/5.0..." "-"
 */
export function parseLogLine(line: string): ParsedLogEntry | null {
  try {
    // Regex to match standard access log format
    const regex = /^(\S+) - - \[(.*?)\] "(\S+) (\S+) \S+" (\d+) (\d+) "(.*?)" "(.*?)" "-"$/;
    const match = line.match(regex);

    if (!match) return null;

    const [, ip, dateStr, method, path, statusStr, sizeStr, referer, userAgent] = match;

    // Parse date: [22/Jan/2019:03:56:14 +0330]
    const timestamp = parseAccessLogDate(dateStr);
    if (!timestamp) return null;

    const statusCode = parseInt(statusStr, 10);
    const size = parseInt(sizeStr, 10);

    // Estimate response time based on file size (very rough approximation)
    // Assume ~100ms for small files, more for larger
    const responseTime = Math.max(10, Math.min(5000, 50 + Math.floor(size / 1000)));

    return {
      timestamp,
      method,
      path: decodeURIComponent(path),
      statusCode,
      responseTime,
      ip,
      userAgent: userAgent !== '-' ? userAgent : undefined,
      referer: referer !== '-' ? referer : undefined
    };
  } catch (error) {
    console.error('Error parsing log line:', error);
    return null;
  }
}

/**
 * Parse access log date format: 22/Jan/2019:03:56:14 +0330
 */
function parseAccessLogDate(dateStr: string): Date | null {
  try {
    // Format: 22/Jan/2019:03:56:14 +0330
    const regex = /^(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+) ([+-]\d{4})$/;
    const match = dateStr.match(regex);

    if (!match) return null;

    const [, day, month, year, hour, minute, second, timezone] = match;

    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const monthNum = months[month];
    if (monthNum === undefined) return null;

    // Create date in UTC
    const date = new Date(Date.UTC(
      parseInt(year),
      monthNum,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ));

    // Adjust for timezone offset
    const tzHours = parseInt(timezone.slice(1, 3));
    const tzMinutes = parseInt(timezone.slice(3));
    const tzOffsetMinutes = (timezone[0] === '+' ? -1 : 1) * (tzHours * 60 + tzMinutes);
    
    date.setMinutes(date.getMinutes() + tzOffsetMinutes);

    return date;
  } catch (error) {
    return null;
  }
}

/**
 * Parse access log file and return array of entries
 * @param filePath Path to access.log file
 * @param limit Maximum number of entries to return (default: 10000)
 */
export async function parseAccessLog(filePath: string, limit: number = 10000): Promise<ParsedLogEntry[]> {
  const entries: ParsedLogEntry[] = [];

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if (entries.length >= limit) {
        rl.close();
        fileStream.destroy();
        return;
      }

      const entry = parseLogLine(line);
      if (entry) {
        entries.push(entry);
      }
    });

    rl.on('close', () => {
      resolve(entries);
    });

    rl.on('error', (err) => {
      reject(err);
    });

    fileStream.on('error', (err) => {
      reject(err);
    });
  });
}
