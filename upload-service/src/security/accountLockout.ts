/**
 * Account Lockout Module
 * Prevents brute-force attacks by locking accounts after failed attempts
 */

/**
 * Middleware to handle account lockout after failed login attempts
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutCheckResult {
  isLocked: boolean;
  remainingTime?: number; // in seconds
  message?: string;
}

/**
 * Check if user account is currently locked out
 */
export function checkLockout(user: any): LockoutCheckResult {
  if (!user.lockoutUntil) {
    return { isLocked: false };
  }

  const now = new Date();
  if (user.lockoutUntil > now) {
    const remainingTime = Math.ceil((user.lockoutUntil.getTime() - now.getTime()) / 1000);
    return {
      isLocked: true,
      remainingTime,
      message: `Account is locked. Try again in ${Math.ceil(remainingTime / 60)} minutes`
    };
  }

  return { isLocked: false };
}

/**
 * Record failed login attempt and lock account if threshold reached
 */
export async function recordFailedAttempt(user: any): Promise<LockoutCheckResult> {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  user.lastFailedLogin = new Date();

  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await user.save();
    return {
      isLocked: true,
      remainingTime: LOCKOUT_DURATION_MS / 1000,
      message: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts. Try again in 15 minutes`
    };
  }

  await user.save();
  const attemptsRemaining = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
  return {
    isLocked: false,
    message: `Invalid credentials. ${attemptsRemaining} attempts remaining before lockout`
  };
}

/**
 * Reset failed attempts on successful login
 */
export async function resetFailedAttempts(user: any): Promise<void> {
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  user.lastSuccessfulLogin = new Date();
  await user.save();
}

/**
 * Get lockout status summary
 */
export function getLockoutInfo(user: any): {
  failedAttempts: number;
  isLocked: boolean;
  lockoutEnds?: Date;
} {
  const lockoutCheck = checkLockout(user);
  return {
    failedAttempts: user.failedLoginAttempts || 0,
    isLocked: lockoutCheck.isLocked,
    lockoutEnds: user.lockoutUntil && user.lockoutUntil > new Date() ? user.lockoutUntil : undefined
  };
}
