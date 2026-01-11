import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth';

/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Course Relevance:
 * - CO2: Access control matrix implementation
 * - Syllabus: Access control matrix, Protection policies
 */

// Define permissions for each role (Access Control Matrix)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'project:create',
    'project:read:own',
    'project:read:all',
    'project:delete:own',
    'project:delete:all',
    'user:manage'
  ],
  developer: [
    'project:create',
    'project:read:own',
    'project:delete:own'
  ],
  viewer: [
    'project:read:own'
  ]
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Middleware factory to require specific permission
 * Usage: app.delete('/project', authMiddleware, requirePermission('project:delete:own'), handler)
 */
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.role;
    
    if (!userRole) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(userRole, permission)) {
      res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        required: permission,
        yourRole: userRole
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require one of multiple roles
 * Usage: app.get('/admin', authMiddleware, requireRole(['admin']), handler)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.role;
    
    if (!userRole) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ 
        error: 'Forbidden: Role not authorized',
        allowedRoles,
        yourRole: userRole
      });
      return;
    }

    next();
  };
}

/**
 * Check if user can access a specific project
 * Admins can access all, others only their own
 */
export function canAccessProject(req: AuthRequest, projectUserId: string): boolean {
  if (!req.id) return false;
  
  // Admins can access all projects
  if (req.role === 'admin') return true;
  
  // Others can only access their own
  return req.id === projectUserId.toString();
}

/**
 * Middleware to check project ownership
 * Requires project data to be fetched first and attached to req.project
 */
export function requireProjectAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  const project = (req as any).project;
  
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (!canAccessProject(req, project.userId)) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this project' });
    return;
  }

  next();
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Export role constants
 */
export const ROLES = {
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer'
} as const;
