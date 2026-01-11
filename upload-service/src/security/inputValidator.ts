import validator from 'validator';

/**
 * Input Validation & Sanitization Module
 * Prevents injection attacks and validates user inputs
 */

// Allowed GitHub URL pattern
const GITHUB_HTTPS_PATTERN = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/;

/**
 * Validate repository URL
 * Only allows valid GitHub HTTPS URLs
 */
export function validateRepoUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Repository URL is required' };
  }

  const trimmedUrl = url.trim();

  // Check basic URL format
  if (!validator.isURL(trimmedUrl, {
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true
  })) {
    return { valid: false, error: 'Invalid URL format. Must be a valid HTTPS URL' };
  }

  // Check if it's a GitHub URL
  if (!GITHUB_HTTPS_PATTERN.test(trimmedUrl)) {
    return { valid: false, error: 'Only GitHub HTTPS repository URLs are allowed (e.g., https://github.com/user/repo.git)' };
  }

  // Check for suspicious patterns that could indicate SSRF attempts
  const suspiciousPatterns = [
    /localhost/i,
    /127\.0\.0\.1/,
    /0\.0\.0\.0/,
    /\[::1\]/,
    /internal/i,
    /@/,  // Credentials in URL
    /\.\./, // Path traversal
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedUrl)) {
      return { valid: false, error: 'URL contains suspicious patterns' };
    }
  }

  return { valid: true };
}

/**
 * Sanitize project ID - only allow alphanumeric and hyphens
 */
export function sanitizeProjectId(id: string): string {
  if (!id || typeof id !== 'string') {
    return '';
  }
  return id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 50);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  if (!validator.isEmail(email.trim())) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate username
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }

  if (trimmed.length > 30) {
    return { valid: false, error: 'Username must be at most 30 characters long' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 * Requirements: 8+ chars, uppercase, lowercase, number, special char
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must be at most 128 characters long' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return validator.escape(input.trim());
}

/**
 * Validation middleware factory
 */
export function createValidationMiddleware(validators: {
  body?: Record<string, (value: any) => { valid: boolean; error?: string }>;
}) {
  return (req: any, res: any, next: any) => {
    if (validators.body) {
      for (const [field, validate] of Object.entries(validators.body)) {
        const result = validate(req.body[field]);
        if (!result.valid) {
          return res.status(400).json({ error: result.error });
        }
      }
    }
    next();
  };
}
