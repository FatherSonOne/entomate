import React, { useState } from 'react'
import { useAllRoles, useUserRoles, usePermission } from '../hooks'
import * as rbacService from '../rbacService'
import type { Role, SystemRole } from '../types'

interface RolesManagementProps {
  currentUserId: string
}

export const RolesManagement: React.FC<RolesManagementProps> = ({ currentUserId }) => {
  const { roles, isLoading } = useAllRoles()
  const { hasPermission: isAdmin } = usePermission(currentUserId, '*')
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [viewMode, setViewMode] = useState<'roles' | 'create'>('roles')
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availablePermissions = rbacService.getPermissionsByResource()

  const getRoleIcon = (name: string) => {
    switch (name) {
      case 'admin':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
        )
      case 'manager':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
        )
      case 'member':
        return (
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        )
      case 'viewer':
        return (
          <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        )
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      setError('Role name is required')
      return
    }
    if (newRole.permissions.length === 0) {
      setError('At least one permission is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await rbacService.createRole(
        newRole.name,
        newRole.description,
        newRole.permissions
      )

      if (result.success) {
        setNewRole({ name: '', description: '', permissions: [] })
        setViewMode('roles')
        // Refetch roles (in a real app, use a mutation/refetch pattern)
        window.location.reload()
      } else {
        setError(result.error || 'Failed to create role')
      }
    } catch (err) {
      setError('Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = (permission: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Roles & Permissions</h2>
          <p className="text-gray-500 text-sm mt-1">Manage user access levels</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setViewMode(viewMode === 'roles' ? 'create' : 'roles')}
            className="px-4 py-2 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-full text-sm font-bold transition-colors"
          >
            {viewMode === 'roles' ? 'Create Role' : 'Back to Roles'}
          </button>
        )}
      </div>

      {viewMode === 'roles' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="col-span-2 flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`bg-white border rounded-2xl p-6 cursor-pointer transition-all hover:shadow-md ${
                  selectedRole?.id === role.id ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  {getRoleIcon(role.name)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg capitalize">{role.name}</h3>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono uppercase">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      {role.description || 'No description'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {role.permissions.slice(0, 4).map((perm, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                          {perm}
                        </span>
                      ))}
                      {role.permissions.length > 4 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
                          +{role.permissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Create Role Form */
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-6">Create Custom Role</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Role Name</label>
              <input
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="e.g., sales_lead"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Description</label>
              <input
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Brief description of this role"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Permissions</label>
              <div className="border border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto space-y-4">
                {Object.entries(availablePermissions).map(([resource, perms]) => (
                  <div key={resource}>
                    <div className="font-mono text-xs uppercase text-gray-400 mb-2">{resource}</div>
                    <div className="flex flex-wrap gap-2">
                      {perms.map((perm) => (
                        <button
                          key={perm}
                          onClick={() => togglePermission(perm)}
                          className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                            newRole.permissions.includes(perm)
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {perm.split(':')[1]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setViewMode('roles')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                disabled={saving}
                className="flex-1 py-3 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Role Detail */}
      {selectedRole && viewMode === 'roles' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              {getRoleIcon(selectedRole.name)}
              <div>
                <h3 className="font-bold text-xl capitalize">{selectedRole.name}</h3>
                <p className="text-gray-500 text-sm">{selectedRole.description || 'No description'}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedRole(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div>
            <span className="font-mono text-xs uppercase text-gray-400 block mb-3">
              Permissions ({selectedRole.permissions.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedRole.permissions.map((perm, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-mono"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>

          {!selectedRole.isSystem && isAdmin && (
            <div className="mt-6 pt-6 border-t flex gap-3">
              <button className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors">
                Edit Role
              </button>
              <button className="flex-1 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl text-sm font-medium transition-colors">
                Delete Role
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RolesManagement
