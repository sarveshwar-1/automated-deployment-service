import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import '../styles/SecurityDemo.css';

/* ─── helpers ─── */
function decodeJwtPart(part: string) {
  try {
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function statusClass(code: number) {
  if (code >= 200 && code < 300) return `s${code}`;
  if (code === 400) return 's400';
  if (code === 401) return 's401';
  if (code === 403) return 's403';
  if (code === 423) return 's423';
  if (code === 429) return 's429';
  return 's400';
}

/* ─── types ─── */
interface LogEntry { attempt: number; status: number; message: string; ts: string; }
interface UrlResult { url: string; status: number; ok: boolean; message: string; }

/* ─── Demo 1: Auth & Crypto ─── */
function AuthCryptoDemo() {
  const [open, setOpen] = useState(true);
  const token = localStorage.getItem('token') || '';
  const parts = token.split('.');
  const header = parts[0] ? decodeJwtPart(parts[0]) : null;
  const payload = parts[0] ? decodeJwtPart(parts[1]) : null;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!payload?.exp) return;
    const update = () => {
      const left = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
      setSecondsLeft(left);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [payload?.exp]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg('');
    const rt = localStorage.getItem('refreshToken');
    try {
      const res = await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt })
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setRefreshMsg(`✅ New token received (expires in ${data.expiresIn}s)`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setRefreshMsg(`❌ ${data.error}`);
      }
    } catch { setRefreshMsg('❌ Network error'); }
    setRefreshing(false);
  };

  const pct = payload?.exp ? Math.min(100, (secondsLeft / 900) * 100) : 0;

  return (
    <div className="demo-panel">
      <div className="demo-panel-header" onClick={() => setOpen(o => !o)}>
        <div className="demo-panel-icon">🔐</div>
        <div className="demo-panel-title">
          <h2>Authentication & Cryptography <span className="co-badge co1">CO1</span><span className="co-badge co2">CO2</span></h2>
          <p>RS256 JWT · Token Expiration · Token Refresh</p>
        </div>
        <span className={`demo-panel-toggle ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="demo-panel-body">
          {!token ? (
            <p style={{ color: '#94a3b8' }}>Sign in to see your JWT token.</p>
          ) : (
            <div className="jwt-viewer">
              {/* Raw Token */}
              <div className="jwt-raw">
                <span className="jwt-header">{parts[0]}</span>
                <span className="jwt-dot">.</span>
                <span className="jwt-payload">{parts[1]}</span>
                <span className="jwt-dot">.</span>
                <span className="jwt-signature">{parts[2]?.substring(0, 40)}…</span>
              </div>

              {/* Decoded Sections */}
              <div className="jwt-decoded">
                <div className="jwt-section header">
                  <h4>Header</h4>
                  <pre>{JSON.stringify(header, null, 2)}</pre>
                </div>
                <div className="jwt-section payload">
                  <h4>Payload</h4>
                  <pre>{JSON.stringify(payload, null, 2)}</pre>
                </div>
                <div className="jwt-section signature">
                  <h4>Signature</h4>
                  <pre>{parts[2]?.substring(0, 60)}…{'\n\n'}Algorithm: RS256{'\n'}Key: RSA-2048</pre>
                </div>
              </div>

              {/* Timer */}
              <div className="token-timer">
                <span>⏱ Expires in: <strong>{Math.floor(secondsLeft / 60)}m {secondsLeft % 60}s</strong></span>
                <div className="timer-bar"><div className="timer-fill" style={{ width: `${pct}%` }} /></div>
              </div>

              {/* Refresh */}
              <div className="demo-btn-row">
                <button className="demo-btn primary" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? '⏳ Refreshing…' : '🔄 Refresh Token'}
                </button>
              </div>
              {refreshMsg && <p style={{ fontSize: 13, marginTop: 8 }}>{refreshMsg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Demo 2: Brute-Force Protection ─── */
function BruteForceDemo() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [attacking, setAttacking] = useState(false);

  const rules = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase (A-Z)', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase (a-z)', pass: /[a-z]/.test(password) },
    { label: 'Number (0-9)', pass: /\d/.test(password) },
    { label: 'Special char (!@#$)', pass: /[^A-Za-z0-9]/.test(password) },
    { label: 'Overall strength', pass: password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) }
  ];

  const simulateAttack = useCallback(async () => {
    setAttacking(true);
    setLogs([]);
    const email = `bruteforce-demo-${Date.now()}@test.com`;

    // Create test account first
    try {
      await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `demo${Date.now()}`, email, password: 'Demo@123!Secure' })
      });
    } catch { /* ignore */ }

    // Attempt wrong passwords
    for (let i = 1; i <= 8; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        const res = await fetch(`${API_URL}/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: `wrong${i}` })
        });
        const data = await res.json();
        const entry: LogEntry = {
          attempt: i,
          status: res.status,
          message: data.error || data.message || 'Unknown',
          ts: new Date().toLocaleTimeString()
        };
        setLogs(prev => [...prev, entry]);

        if (res.status === 429 || res.status === 423) break;
      } catch {
        setLogs(prev => [...prev, { attempt: i, status: 0, message: 'Network error', ts: new Date().toLocaleTimeString() }]);
        break;
      }
    }
    setAttacking(false);
  }, []);

  return (
    <div className="demo-panel">
      <div className="demo-panel-header" onClick={() => setOpen(o => !o)}>
        <div className="demo-panel-icon">🛡️</div>
        <div className="demo-panel-title">
          <h2>Brute-Force Protection <span className="co-badge co2">CO2</span><span className="co-badge co3">CO3</span></h2>
          <p>Password Validation · Account Lockout · Rate Limiting</p>
        </div>
        <span className={`demo-panel-toggle ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="demo-panel-body">
          {/* Password Strength */}
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#cbd5e1' }}>Password Strength Checker</h3>
          <div className="password-demo">
            <input
              type="text"
              placeholder="Type a password to test strength…"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <div className="password-rules">
              {rules.map((r, i) => (
                <div key={i} className={`password-rule ${r.pass ? 'pass' : 'fail'}`}>
                  {r.pass ? '✅' : '⬜'} {r.label}
                </div>
              ))}
            </div>
          </div>

          {/* Attack Simulator */}
          <h3 style={{ margin: '24px 0 12px', fontSize: 15, color: '#cbd5e1' }}>Brute-Force Attack Simulator</h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
            Creates a test account and fires rapid wrong-password attempts. Watch the system block the attack.
          </p>
          <div className="demo-btn-row">
            <button className="demo-btn danger" onClick={simulateAttack} disabled={attacking}>
              {attacking ? '⚡ Attacking…' : '⚡ Simulate Brute-Force Attack'}
            </button>
          </div>
          {logs.length > 0 && (
            <div className="attack-log" style={{ marginTop: 12 }}>
              {logs.map((l, i) => (
                <div key={i} className="attack-log-entry">
                  <span style={{ color: '#64748b', width: 20 }}>#{l.attempt}</span>
                  <span className={`status-badge ${statusClass(l.status)}`}>{l.status}</span>
                  <span style={{ color: '#cbd5e1', flex: 1 }}>{l.message}</span>
                  <span style={{ color: '#475569', fontSize: 11 }}>{l.ts}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Demo 3: Input Validation ─── */
function InputValidationDemo() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<UrlResult | null>(null);
  const [testing, setTesting] = useState(false);

  const examples = [
    { label: 'github.com/user/repo', url: 'https://github.com/user/repo', safe: true },
    { label: 'malicious-site.com', url: 'http://malicious-site.com/hack', safe: false },
    { label: 'localhost (SSRF)', url: 'https://github.com/localhost/repo', safe: false },
    { label: '../../etc/passwd', url: 'https://github.com/../../etc/passwd', safe: false },
  ];

  const testUrl = async (testUrlValue: string) => {
    setTesting(true);
    setUrl(testUrlValue);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repoUrl: testUrlValue })
      });
      const data = await res.json();
      setResult({
        url: testUrlValue,
        status: res.status,
        ok: res.ok,
        message: data.error || data.message || 'Accepted'
      });
    } catch {
      setResult({ url: testUrlValue, status: 0, ok: false, message: 'Network error' });
    }
    setTesting(false);
  };

  return (
    <div className="demo-panel">
      <div className="demo-panel-header" onClick={() => setOpen(o => !o)}>
        <div className="demo-panel-icon">🔍</div>
        <div className="demo-panel-title">
          <h2>Input Validation & SSRF Prevention <span className="co-badge co3">CO3</span></h2>
          <p>URL Whitelisting · Injection Prevention · SSRF Blocking</p>
        </div>
        <span className={`demo-panel-toggle ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="demo-panel-body">
          <div className="url-tester">
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Try deploying with different URLs. Only HTTPS GitHub repository URLs are accepted.
            </p>
            <div className="url-examples">
              {examples.map((e, i) => (
                <button
                  key={i}
                  className={`url-example-btn ${e.safe ? 'safe' : 'malicious'}`}
                  onClick={() => testUrl(e.url)}
                  disabled={testing}
                >
                  {e.safe ? '✅' : '❌'} {e.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Or type a custom URL…"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && url && testUrl(url)}
              />
              <button className="demo-btn primary" onClick={() => testUrl(url)} disabled={testing || !url}>
                Test
              </button>
            </div>
            {result && (
              <div className={`url-result ${result.status === 400 || !result.ok ? 'blocked' : 'accepted'}`}>
                {result.status === 400 || !result.ok ? (
                  <><span className="shield-icon">🛡️</span> <strong>BLOCKED ({result.status}):</strong> {result.message}</>
                ) : (
                  <><span>✅</span> <strong>ACCEPTED ({result.status}):</strong> {result.message}</>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Demo 4: RBAC ─── */
function RBACDemo() {
  const [open, setOpen] = useState(false);
  const [secInfo, setSecInfo] = useState<any>(null);
  const [rbacLogs, setRbacLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/security/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(setSecInfo).catch(() => { });
  }, [open]);

  const tryForbidden = async (label: string, method: string, path: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setRbacLogs(prev => [...prev, {
        attempt: prev.length + 1,
        status: res.status,
        message: `${label}: ${data.error || data.message || 'OK'}`,
        ts: new Date().toLocaleTimeString()
      }]);
    } catch {
      setRbacLogs(prev => [...prev, { attempt: prev.length + 1, status: 0, message: `${label}: Network error`, ts: new Date().toLocaleTimeString() }]);
    }
  };

  const matrix = secInfo?.rbac;
  const userRole = secInfo?.user?.role;
  const allPerms = matrix?.allPermissions || [];
  const roles = matrix?.roles || [];

  return (
    <div className="demo-panel">
      <div className="demo-panel-header" onClick={() => setOpen(o => !o)}>
        <div className="demo-panel-icon">👥</div>
        <div className="demo-panel-title">
          <h2>Access Control (RBAC) <span className="co-badge co2">CO2</span></h2>
          <p>Role-Based Permissions · Access Control Matrix</p>
        </div>
        <span className={`demo-panel-toggle ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="demo-panel-body">
          {secInfo && (
            <>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 16px' }}>
                Your role: <strong style={{ color: '#60a5fa' }}>{userRole}</strong>
              </p>

              {/* Permission Matrix Table */}
              <div className="rbac-table-wrap">
                <table className="rbac-table">
                  <thead>
                    <tr>
                      <th>Permission</th>
                      {roles.map((r: string) => (
                        <th key={r} style={r === userRole ? { color: '#60a5fa' } : {}}>
                          {r} {r === userRole && '(you)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allPerms.map((perm: string) => (
                      <tr key={perm} className={matrix.permissionMatrix[userRole]?.includes(perm) ? 'current-role' : ''}>
                        <td>{perm}</td>
                        {roles.map((r: string) => (
                          <td key={r}>
                            {matrix.permissionMatrix[r]?.includes(perm) ? (
                              <span className={r === userRole ? 'perm-your' : 'perm-granted'}>✓</span>
                            ) : (
                              <span className="perm-denied">✗</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Try Forbidden Actions */}
              <h3 style={{ margin: '24px 0 10px', fontSize: 15, color: '#cbd5e1' }}>Try Forbidden Actions</h3>
              <div className="demo-btn-row">
                <button className="demo-btn danger" onClick={() => tryForbidden('Admin Users', 'GET', '/admin/users')}>
                  🚫 Access Admin Panel
                </button>
                <button className="demo-btn danger" onClick={() => tryForbidden('Delete Other Project', 'DELETE', '/deleteProject')}>
                  🚫 Delete Without Project ID
                </button>
                <button className="demo-btn success" onClick={() => tryForbidden('View Projects', 'GET', '/viewProjects')}>
                  ✅ View My Projects
                </button>
              </div>
              {rbacLogs.length > 0 && (
                <div className="attack-log" style={{ marginTop: 12 }}>
                  {rbacLogs.map((l, i) => (
                    <div key={i} className="attack-log-entry">
                      <span className={`status-badge ${statusClass(l.status)}`}>{l.status}</span>
                      <span style={{ color: '#cbd5e1', flex: 1 }}>{l.message}</span>
                      <span style={{ color: '#475569', fontSize: 11 }}>{l.ts}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {!secInfo && <p style={{ color: '#64748b' }}>Loading security info…</p>}
        </div>
      )}
    </div>
  );
}

/* ─── Demo 5: Network Security ─── */
function NetworkSecurityDemo() {
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Static header info (browsers block reading security headers cross-origin)
  const securityHeaders = [
    { name: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'", protection: 'Prevents XSS by controlling allowed script sources' },
    { name: 'X-Content-Type-Options', value: 'nosniff', protection: 'Prevents MIME-sniffing attacks' },
    { name: 'X-Frame-Options', value: 'SAMEORIGIN', protection: 'Prevents clickjacking by blocking iframes' },
    { name: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains', protection: 'Forces HTTPS connections for 1 year' },
    { name: 'Referrer-Policy', value: 'no-referrer', protection: 'Prevents leaking URL info in Referer header' },
    { name: 'X-DNS-Prefetch-Control', value: 'off', protection: 'Controls DNS prefetching behavior' },
    { name: 'X-Download-Options', value: 'noopen', protection: 'Prevents IE from executing downloads' },
    { name: 'X-Permitted-Cross-Domain-Policies', value: 'none', protection: 'Blocks Flash/PDF cross-domain access' },
    { name: 'Cross-Origin-Opener-Policy', value: 'same-origin', protection: 'Isolates browsing context for security' },
    { name: 'Cross-Origin-Resource-Policy', value: 'same-origin', protection: 'Controls cross-origin resource loading' },
  ];

  useEffect(() => {
    if (!open || loaded) return;

    const token = localStorage.getItem('token');
    fetch(`${API_URL}/security/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      setFeatures(d.activeFeatures || []);
      setLoaded(true);
    }).catch(() => { });
  }, [open, loaded]);

  return (
    <div className="demo-panel">
      <div className="demo-panel-header" onClick={() => setOpen(o => !o)}>
        <div className="demo-panel-icon">🌐</div>
        <div className="demo-panel-title">
          <h2>Network Security & Headers <span className="co-badge co4">CO4</span></h2>
          <p>Security Headers · CORS · Docker Hardening</p>
        </div>
        <span className={`demo-panel-toggle ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && (
        <div className="demo-panel-body">
          {/* Headers Inspector */}
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#cbd5e1' }}>Security Headers (Helmet.js)</h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
            These headers are injected by Helmet.js middleware on every API response.
          </p>
          <table className="headers-table">
            <thead>
              <tr><th>Header</th><th>Value</th><th>Protection</th></tr>
            </thead>
            <tbody>
              {securityHeaders.map((h, i) => (
                <tr key={i}>
                  <td className="header-name">{h.name}</td>
                  <td className="header-value" title={h.value}>{h.value}</td>
                  <td style={{ color: '#94a3b8', fontSize: 12 }}>{h.protection}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Active Features */}
          <h3 style={{ margin: '28px 0 12px', fontSize: 15, color: '#cbd5e1' }}>All Active Security Features</h3>
          <div className="feature-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-item">
                <span className="check">✓</span>
                <span>{f.name}</span>
                <span className={`co-badge ${f.co.toLowerCase()}`}>{f.co}</span>
              </div>
            ))}
          </div>

          {/* Docker Info */}
          <h3 style={{ margin: '28px 0 12px', fontSize: 15, color: '#cbd5e1' }}>Container Security</h3>
          <div className="feature-grid">
            {[
              { icon: '🐳', text: 'Non-root user (UID 1001)' },
              { icon: '🏔️', text: 'Alpine Linux (minimal attack surface)' },
              { icon: '💓', text: 'Health checks every 30s' },
              { icon: '📦', text: 'COPY --chown (no recursive chown)' }
            ].map((item, i) => (
              <div key={i} className="feature-item">
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function SecurityDemo() {
  return (
    <div className="security-demo">
      <h1>🔒 Security Demo Dashboard</h1>
      <p className="subtitle">Interactive visualization of all security features — click each panel to explore</p>

      <AuthCryptoDemo />
      <BruteForceDemo />
      <InputValidationDemo />
      <RBACDemo />
      <NetworkSecurityDemo />
    </div>
  );
}
