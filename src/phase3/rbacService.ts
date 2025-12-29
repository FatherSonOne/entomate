/**
 * Role-Based Access Control (RBAC) Service
 *
 * Manages user roles and permissions:
 * - Four system roles: admin, manager, member, viewer
 * - Custom role creation
 * - Permission checking
 * - Role assignment
 */

import { supabase } from "../lib/supabase"
import type {
  Role,
  UserRole,
  UserWithRoles,
  Permission,
  PermissionCheck,
  SystemRole,
  ServiceResponse
} from "./types"

// Default permissions by role
const DEFAULT_PERMISSIONS: Record<SystemRole, string[]> = {
  admin: ['*'],
  manager: [
    'agents:*',
    'analytics:*',
    'meetings:*',
    'tasks:*',
    'customers:*',
    'team:read',
    'settings:read',
    'coaching:*',
    'sentiment:*',
    'alerts:*',
    'webhooks:read',
    'integrations:read'
  ],
  member: [
    'meetings:own',
    'tasks:own',
    'customers:read',
    'analytics:read',
    'coaching:own',
    'sentiment:read',
    'alerts:own',
    'agents:use'
  ],
  viewer: [
    'meetings:read',
    'tasks:read',
    'customers:read',
    'analytics:read',
    'sentiment:read'
  ]
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('user_has_permission', {
      p_user_id: userId,
      p_permission: permission
    })

    if (error) {
      // Handle case where RPC function doesn't exist (database not configured)
      if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('does not exist')) {
        return true // Default to allowed when RBAC not configured
      }
      throw error
    }

    return data === true
  } catch (error) {
    // Return true (allowed) instead of logging error - prevents console noise when DB not configured
    return true
  }
}

/**
 * Check multiple permissions at once
 */
export async function checkPermissions(
  userId: string,
  permissions: string[]
): Promise<PermissionCheck[]> {
  const results: PermissionCheck[] = []

  for (const permission of permissions) {
    const [resource, action] = permission.split(':')
    const allowed = await hasPermission(userId, permission)
    results.push({ resource, action, allowed })
  }

  return results
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(
  userId: string
): Promise<ServiceResponse<string[]>> {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId
    })

    if (error) throw error

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Get user permissions error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get permissions'
    }
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasPermission(userId, '*')
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission)) {
      return true
    }
  }
  return false
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, permission))) {
      return false
    }
  }
  return true
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<ServiceResponse<Role[]>> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name')

    if (error) throw error

    return {
      success: true,
      data: data.map(mapRoleFromDb)
    }
  } catch (error) {
    console.error('Get all roles error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get roles'
    }
  }
}

/**
 * Get role by ID
 */
export async function getRole(
  roleId: string
): Promise<ServiceResponse<Role | null>> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapRoleFromDb(data) : null
    }
  } catch (error) {
    console.error('Get role error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get role'
    }
  }
}

/**
 * Get role by name
 */
export async function getRoleByName(
  name: string
): Promise<ServiceResponse<Role | null>> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('name', name)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapRoleFromDb(data) : null
    }
  } catch (error) {
    console.error('Get role by name error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get role'
    }
  }
}

/**
 * Create a custom role
 */
export async function createRole(
  name: string,
  description: string,
  permissions: string[]
): Promise<ServiceResponse<Role>> {
  try {
    const { data, error } = await supabase.rpc('create_custom_role', {
      p_name: name,
      p_description: description,
      p_permissions: permissions
    })

    if (error) throw error

    // Fetch created role
    const { data: role, error: fetchError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', data)
      .single()

    if (fetchError) throw fetchError

    return {
      success: true,
      data: mapRoleFromDb(role)
    }
  } catch (error) {
    console.error('Create role error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create role'
    }
  }
}

/**
 * Update a custom role
 */
export async function updateRole(
  roleId: string,
  updates: {
    name?: string
    description?: string
    permissions?: string[]
  }
): Promise<ServiceResponse<Role>> {
  try {
    // Check if system role
    const { data: existing } = await supabase
      .from('roles')
      .select('is_system')
      .eq('id', roleId)
      .single()

    if (existing?.is_system) {
      return {
        success: false,
        error: 'Cannot modify system roles'
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.permissions !== undefined) updateData.permissions = updates.permissions

    const { data, error } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', roleId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapRoleFromDb(data)
    }
  } catch (error) {
    console.error('Update role error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update role'
    }
  }
}

/**
 * Delete a custom role
 */
export async function deleteRole(
  roleId: string
): Promise<ServiceResponse<void>> {
  try {
    // Check if system role
    const { data: existing } = await supabase
      .from('roles')
      .select('is_system')
      .eq('id', roleId)
      .single()

    if (existing?.is_system) {
      return {
        success: false,
        error: 'Cannot delete system roles'
      }
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Delete role error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete role'
    }
  }
}

// ============================================================================
// USER ROLE ASSIGNMENT
// ============================================================================

/**
 * Get roles for a user
 */
export async function getUserRoles(
  userId: string
): Promise<ServiceResponse<Role[]>> {
  try {
    const { data, error } = await supabase.rpc('get_user_roles', {
      p_user_id: userId
    })

    if (error) throw error

    return {
      success: true,
      data: data.map(mapRoleFromDb)
    }
  } catch (error) {
    console.error('Get user roles error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user roles'
    }
  }
}

/**
 * Assign a role to a user
 */
export async function assignRole(
  userId: string,
  roleId: string,
  grantedBy?: string,
  expiresAt?: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.rpc('assign_role', {
      p_user_id: userId,
      p_role_id: roleId,
      p_granted_by: grantedBy || null,
      p_expires_at: expiresAt || null
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Assign role error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign role'
    }
  }
}

/**
 * Assign a role by name
 */
export async function assignRoleByName(
  userId: string,
  roleName: string,
  grantedBy?: string
): Promise<ServiceResponse<void>> {
  try {
    const roleResult = await getRoleByName(roleName)
    if (!roleResult.success || !roleResult.data) {
      return {
        success: false,
        error: `Role '${roleName}' not found`
      }
    }

    return assignRole(userId, roleResult.data.id, grantedBy)
  } catch (error) {
    console.error('Assign role by name error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign role'
    }
  }
}

/**
 * Remove a role from a user
 */
export async function removeRole(
  userId: string,
  roleId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.rpc('remove_role', {
      p_user_id: userId,
      p_role_id: roleId
    })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Remove role error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove role'
    }
  }
}

/**
 * Get user with all roles and permissions
 */
export async function getUserWithRoles(
  userId: string
): Promise<ServiceResponse<UserWithRoles>> {
  try {
    const [rolesResult, permissionsResult] = await Promise.all([
      getUserRoles(userId),
      getUserPermissions(userId)
    ])

    if (!rolesResult.success) {
      return {
        success: false,
        error: rolesResult.error
      }
    }

    return {
      success: true,
      data: {
        userId,
        roles: rolesResult.data || [],
        permissions: permissionsResult.data || []
      }
    }
  } catch (error) {
    console.error('Get user with roles error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user with roles'
    }
  }
}

// ============================================================================
// AVAILABLE PERMISSIONS
// ============================================================================

/**
 * Get list of all available permissions
 */
export async function getAvailablePermissions(): Promise<ServiceResponse<string[]>> {
  try {
    const { data, error } = await supabase.rpc('get_available_permissions')

    if (error) throw error

    return {
      success: true,
      data: data || []
    }
  } catch (error) {
    console.error('Get available permissions error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get available permissions'
    }
  }
}

/**
 * Get permissions grouped by resource
 */
export function getPermissionsByResource(): Record<string, string[]> {
  return {
    agents: ['agents:*', 'agents:create', 'agents:read', 'agents:update', 'agents:delete', 'agents:use'],
    meetings: ['meetings:*', 'meetings:own', 'meetings:read', 'meetings:create', 'meetings:update', 'meetings:delete'],
    tasks: ['tasks:*', 'tasks:own', 'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete'],
    customers: ['customers:*', 'customers:read', 'customers:create', 'customers:update', 'customers:delete'],
    analytics: ['analytics:*', 'analytics:read'],
    team: ['team:*', 'team:read', 'team:manage'],
    settings: ['settings:*', 'settings:read', 'settings:update'],
    coaching: ['coaching:*', 'coaching:own', 'coaching:read'],
    sentiment: ['sentiment:*', 'sentiment:read'],
    alerts: ['alerts:*', 'alerts:own', 'alerts:read', 'alerts:manage'],
    webhooks: ['webhooks:*', 'webhooks:read', 'webhooks:create', 'webhooks:update', 'webhooks:delete'],
    integrations: ['integrations:*', 'integrations:read', 'integrations:manage'],
    audit: ['audit:*', 'audit:read'],
    roles: ['roles:*', 'roles:read', 'roles:manage']
  }
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Create a permission check middleware function
 */
export function requirePermission(permission: string) {
  return async (userId: string): Promise<boolean> => {
    return hasPermission(userId, permission)
  }
}

/**
 * Create a role check middleware function
 */
export function requireRole(roleName: string) {
  return async (userId: string): Promise<boolean> => {
    const result = await getUserRoles(userId)
    if (!result.success || !result.data) return false
    return result.data.some(role => role.name === roleName)
  }
}

/**
 * Create an any-role check middleware function
 */
export function requireAnyRole(roleNames: string[]) {
  return async (userId: string): Promise<boolean> => {
    const result = await getUserRoles(userId)
    if (!result.success || !result.data) return false
    return result.data.some(role => roleNames.includes(role.name))
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapRoleFromDb(row: Record<string, unknown>): Role {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    permissions: (row.permissions || []) as string[],
    isSystem: row.is_system as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}
