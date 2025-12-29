# Enterprise Features Specification

**Phase 3 - Weeks 5-6**
**Priority:** High (enterprise sales requirement)

---

## Overview

Enterprise Features prepare Entomate for enterprise customers with security, compliance, and access control requirements. This includes RBAC, SSO, audit logs, and data retention policies.

### Business Value
- Enable enterprise sales (SOC 2, GDPR requirements)
- Reduce security review friction
- Support larger team deployments (100+ users)
- Meet compliance requirements

---

## Feature Requirements

### Week 5: RBAC

| Feature | Description | Priority |
|---------|-------------|----------|
| Role definitions | Admin, Manager, Member, Viewer | P0 |
| Permission system | Resource + action permissions | P0 |
| Role assignment | Assign roles to users | P0 |
| Permission checks | Middleware for all routes | P0 |
| Custom roles | Create custom roles (enterprise) | P2 |

### Week 6: SSO + Compliance

| Feature | Description | Priority |
|---------|-------------|----------|
| SAML 2.0 | Enterprise SSO standard | P0 |
| OAuth 2.0 | Fallback SSO method | P1 |
| Audit logs | Comprehensive action logging | P0 |
| Data retention | Configurable retention policies | P1 |
| GDPR tools | Export and delete user data | P1 |
| Multi-tenant | Tenant isolation | P0 |

---

## Role-Based Access Control (RBAC)

### Role Definitions

| Role | Description | Typical Users |
|------|-------------|---------------|
| **Admin** | Full system access, manage all settings | IT Admin, Owner |
| **Manager** | Team management, all member permissions | Team Lead, Sales Manager |
| **Member** | Standard user, own resources | Sales Rep, CSM |
| **Viewer** | Read-only access | Executive, External Auditor |

### Permission Structure

```typescript
// Permission format: resource:action or resource:scope
// Examples:
// "meetings:create" - can create meetings
// "meetings:own" - can access own meetings only
// "meetings:team" - can access team's meetings
// "meetings:*" - full access to meetings
// "*" - superadmin access

type Permission =
  | '*'  // Superadmin
  | 'agents:*' | 'agents:create' | 'agents:read' | 'agents:update' | 'agents:delete' | 'agents:run'
  | 'meetings:*' | 'meetings:own' | 'meetings:team' | 'meetings:read' | 'meetings:create'
  | 'tasks:*' | 'tasks:own' | 'tasks:team' | 'tasks:read' | 'tasks:create' | 'tasks:update'
  | 'customers:*' | 'customers:read' | 'customers:create' | 'customers:update'
  | 'analytics:*' | 'analytics:read' | 'analytics:team'
  | 'team:*' | 'team:read' | 'team:manage'
  | 'settings:*' | 'settings:read' | 'settings:update'
  | 'audit:*' | 'audit:read';
```

### Default Role Permissions

```typescript
const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['*'],

  manager: [
    'agents:*',
    'meetings:team',
    'tasks:team',
    'customers:*',
    'analytics:*',
    'team:read',
    'settings:read'
  ],

  member: [
    'agents:read',
    'meetings:own',
    'tasks:own',
    'customers:read',
    'analytics:read',
    'settings:read'
  ],

  viewer: [
    'meetings:read',
    'tasks:read',
    'customers:read',
    'analytics:read'
  ]
};
```

### Database Schema

```sql
-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,  -- Cannot delete system roles
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- User-role assignments
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Optional expiration
  UNIQUE(tenant_id, user_id, role_id)
);

-- Insert default system roles (per tenant)
CREATE OR REPLACE FUNCTION create_default_roles(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO roles (tenant_id, name, display_name, description, permissions, is_system)
  VALUES
    (p_tenant_id, 'admin', 'Administrator', 'Full system access', '["*"]', true),
    (p_tenant_id, 'manager', 'Manager', 'Team management access',
      '["agents:*", "meetings:team", "tasks:team", "customers:*", "analytics:*", "team:read", "settings:read"]', true),
    (p_tenant_id, 'member', 'Member', 'Standard user access',
      '["agents:read", "meetings:own", "tasks:own", "customers:read", "analytics:read", "settings:read"]', true),
    (p_tenant_id, 'viewer', 'Viewer', 'Read-only access',
      '["meetings:read", "tasks:read", "customers:read", "analytics:read"]', true);
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX idx_user_roles_user ON user_roles (user_id);
CREATE INDEX idx_user_roles_tenant ON user_roles (tenant_id);
CREATE INDEX idx_roles_tenant ON roles (tenant_id);
```

### RBAC Service

```typescript
// src/rbac/service.ts

import { supabase } from '../lib/supabase';

export class RBACService {
  async getUserPermissions(userId: string, tenantId: string): Promise<Permission[]> {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('roles(permissions)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .or('expires_at.is.null,expires_at.gt.now()');

    if (!userRoles || userRoles.length === 0) {
      return []; // No permissions
    }

    // Merge all role permissions
    const allPermissions = new Set<Permission>();
    for (const ur of userRoles) {
      const perms = ur.roles?.permissions as Permission[] || [];
      perms.forEach(p => allPermissions.add(p));
    }

    return Array.from(allPermissions);
  }

  hasPermission(
    userPermissions: Permission[],
    requiredPermission: Permission
  ): boolean {
    // Superadmin check
    if (userPermissions.includes('*')) {
      return true;
    }

    // Direct match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Wildcard match (e.g., "meetings:*" covers "meetings:read")
    const [resource, action] = requiredPermission.split(':');
    if (userPermissions.includes(`${resource}:*` as Permission)) {
      return true;
    }

    return false;
  }

  async assignRole(
    userId: string,
    roleId: string,
    tenantId: string,
    grantedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    await supabase.from('user_roles').upsert({
      user_id: userId,
      role_id: roleId,
      tenant_id: tenantId,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt?.toISOString() || null
    });
  }

  async removeRole(userId: string, roleId: string, tenantId: string): Promise<void> {
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('tenant_id', tenantId);
  }

  async getUserRoles(userId: string, tenantId: string): Promise<Role[]> {
    const { data } = await supabase
      .from('user_roles')
      .select('roles(*)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    return data?.map(ur => ur.roles) || [];
  }
}
```

### RBAC Middleware

```typescript
// src/rbac/middleware.ts

import { Request, Response, NextFunction } from 'express';
import { RBACService } from './service';

const rbacService = new RBACService();

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userPermissions = await rbacService.getUserPermissions(userId, tenantId);

    if (!rbacService.hasPermission(userPermissions, permission)) {
      // Log access denial
      await logAuditEvent({
        tenantId,
        userId,
        action: 'access_denied',
        resourceType: permission.split(':')[0],
        details: { requiredPermission: permission }
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing permission: ${permission}`
      });
    }

    // Attach permissions to request for downstream use
    req.userPermissions = userPermissions;
    next();
  };
}

// Usage in routes:
// router.post('/agents', requirePermission('agents:create'), createAgentHandler);
// router.get('/meetings', requirePermission('meetings:read'), listMeetingsHandler);
```

---

## Single Sign-On (SSO)

### Supported Providers

| Provider | Protocol | Priority |
|----------|----------|----------|
| Okta | SAML 2.0 | P0 |
| Azure AD | SAML 2.0 / OAuth | P0 |
| Google Workspace | OAuth 2.0 | P1 |
| OneLogin | SAML 2.0 | P2 |

### Database Schema

```sql
-- SSO configurations (per tenant)
CREATE TABLE sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL,  -- okta, azure_ad, google, onelogin
  protocol TEXT NOT NULL,  -- saml, oauth
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- SAML settings
  saml_entry_point TEXT,
  saml_issuer TEXT,
  saml_certificate TEXT,
  saml_signature_algorithm TEXT DEFAULT 'sha256',

  -- OAuth settings
  oauth_client_id TEXT,
  oauth_client_secret TEXT,
  oauth_authorization_url TEXT,
  oauth_token_url TEXT,
  oauth_userinfo_url TEXT,

  -- Common settings
  auto_provision_users BOOLEAN NOT NULL DEFAULT TRUE,
  default_role_id UUID REFERENCES roles(id),
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SSO login sessions (for debugging)
CREATE TABLE sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  provider TEXT NOT NULL,
  session_index TEXT,
  name_id TEXT,
  attributes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_sso_sessions_tenant ON sso_sessions (tenant_id);
CREATE INDEX idx_sso_sessions_user ON sso_sessions (user_id);
```

### SAML Implementation

```typescript
// src/sso/saml.ts

import * as saml2 from 'saml2-js';
import { supabase } from '../lib/supabase';

export class SAMLService {
  private serviceProviders: Map<string, saml2.ServiceProvider> = new Map();

  async getServiceProvider(tenantId: string): Promise<saml2.ServiceProvider> {
    if (this.serviceProviders.has(tenantId)) {
      return this.serviceProviders.get(tenantId)!;
    }

    const { data: config } = await supabase
      .from('sso_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('protocol', 'saml')
      .single();

    if (!config) {
      throw new Error('SAML not configured for this tenant');
    }

    const sp = new saml2.ServiceProvider({
      entity_id: `${process.env.APP_URL}/saml/metadata/${tenantId}`,
      private_key: process.env.SAML_PRIVATE_KEY!,
      certificate: process.env.SAML_CERTIFICATE!,
      assert_endpoint: `${process.env.APP_URL}/saml/acs/${tenantId}`
    });

    this.serviceProviders.set(tenantId, sp);
    return sp;
  }

  async getIdentityProvider(tenantId: string): Promise<saml2.IdentityProvider> {
    const { data: config } = await supabase
      .from('sso_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!config) {
      throw new Error('SSO not configured for this tenant');
    }

    return new saml2.IdentityProvider({
      sso_login_url: config.saml_entry_point,
      sso_logout_url: config.saml_entry_point,
      certificates: [config.saml_certificate]
    });
  }

  async initiateLogin(tenantId: string): Promise<string> {
    const sp = await this.getServiceProvider(tenantId);
    const idp = await this.getIdentityProvider(tenantId);

    return new Promise((resolve, reject) => {
      sp.create_login_request_url(idp, {}, (err, loginUrl) => {
        if (err) reject(err);
        else resolve(loginUrl);
      });
    });
  }

  async handleCallback(
    tenantId: string,
    samlResponse: string
  ): Promise<{ user: User; isNewUser: boolean }> {
    const sp = await this.getServiceProvider(tenantId);
    const idp = await this.getIdentityProvider(tenantId);

    const assertion = await new Promise<any>((resolve, reject) => {
      sp.post_assert(idp, { request_body: { SAMLResponse: samlResponse } },
        (err, response) => {
          if (err) reject(err);
          else resolve(response);
        }
      );
    });

    // Extract user info from SAML assertion
    const email = assertion.user.email ||
      assertion.user.attributes?.email?.[0];
    const firstName = assertion.user.attributes?.firstName?.[0] ||
      assertion.user.name_id?.split('@')[0];
    const lastName = assertion.user.attributes?.lastName?.[0] || '';

    // Find or create user
    const { user, isNewUser } = await this.findOrCreateUser({
      tenantId,
      email,
      firstName,
      lastName,
      ssoProvider: 'saml',
      ssoNameId: assertion.user.name_id
    });

    // Store SSO session
    await supabase.from('sso_sessions').insert({
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'saml',
      session_index: assertion.user.session_index,
      name_id: assertion.user.name_id,
      attributes: assertion.user.attributes
    });

    return { user, isNewUser };
  }

  private async findOrCreateUser(params: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    ssoProvider: string;
    ssoNameId: string;
  }): Promise<{ user: User; isNewUser: boolean }> {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', params.email)
      .eq('tenant_id', params.tenantId)
      .single();

    if (existingUser) {
      return { user: existingUser, isNewUser: false };
    }

    // Check if auto-provisioning is enabled
    const { data: config } = await supabase
      .from('sso_configs')
      .select('auto_provision_users, default_role_id')
      .eq('tenant_id', params.tenantId)
      .single();

    if (!config?.auto_provision_users) {
      throw new Error('User not found and auto-provisioning is disabled');
    }

    // Create new user
    const { data: newUser } = await supabase
      .from('users')
      .insert({
        tenant_id: params.tenantId,
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        sso_provider: params.ssoProvider,
        sso_name_id: params.ssoNameId
      })
      .select()
      .single();

    // Assign default role
    if (config.default_role_id) {
      await supabase.from('user_roles').insert({
        tenant_id: params.tenantId,
        user_id: newUser.id,
        role_id: config.default_role_id,
        granted_by: null  // System
      });
    }

    return { user: newUser, isNewUser: true };
  }
}
```

### SSO Routes

```typescript
// src/routes/sso.ts

import { Router } from 'express';
import { SAMLService } from '../sso/saml';

const router = Router();
const samlService = new SAMLService();

// Initiate SSO login
router.get('/sso/login/:tenantId', async (req, res) => {
  try {
    const loginUrl = await samlService.initiateLogin(req.params.tenantId);
    res.redirect(loginUrl);
  } catch (error) {
    res.status(400).json({ error: 'SSO login failed' });
  }
});

// SAML Assertion Consumer Service (ACS)
router.post('/saml/acs/:tenantId', async (req, res) => {
  try {
    const { user, isNewUser } = await samlService.handleCallback(
      req.params.tenantId,
      req.body.SAMLResponse
    );

    // Create session token
    const token = await createSessionToken(user);

    // Redirect to app with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('SAML callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=sso_failed`);
  }
});

// SAML metadata endpoint (for IdP configuration)
router.get('/saml/metadata/:tenantId', async (req, res) => {
  const sp = await samlService.getServiceProvider(req.params.tenantId);
  res.type('application/xml');
  res.send(sp.create_metadata());
});

export default router;
```

---

## Audit Logs

### What to Log

| Category | Events |
|----------|--------|
| Authentication | Login, logout, failed login, password change, SSO |
| Authorization | Access denied, permission change, role change |
| Data Access | View, export, bulk operations |
| Data Modification | Create, update, delete |
| Admin Actions | Settings change, user management, integration config |
| Agent Activity | Agent run, action executed |

### Database Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  session_id TEXT,

  -- What happened
  action TEXT NOT NULL,
  category TEXT NOT NULL,  -- auth, access, modification, admin, agent
  resource_type TEXT,
  resource_id TEXT,

  -- Details
  details JSONB NOT NULL DEFAULT '{}',
  changes JSONB,  -- For modifications: { before: {...}, after: {...} }

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'success',  -- success, failure, warning
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance (optional but recommended)
-- CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
--   FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Indexes
CREATE INDEX idx_audit_logs_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_category ON audit_logs (category, created_at DESC);
```

### Audit Service

```typescript
// src/audit/service.ts

import { supabase } from '../lib/supabase';
import { Request } from 'express';

interface AuditEvent {
  tenantId: string;
  userId?: string;
  action: string;
  category: 'auth' | 'access' | 'modification' | 'admin' | 'agent';
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  changes?: { before: any; after: any };
  status?: 'success' | 'failure' | 'warning';
  errorMessage?: string;
}

export class AuditService {
  async log(event: AuditEvent, req?: Request): Promise<void> {
    const logEntry = {
      tenant_id: event.tenantId,
      user_id: event.userId || null,
      session_id: req?.sessionID || null,
      action: event.action,
      category: event.category,
      resource_type: event.resourceType || null,
      resource_id: event.resourceId || null,
      details: event.details || {},
      changes: event.changes || null,
      ip_address: req?.ip || null,
      user_agent: req?.get('user-agent') || null,
      request_id: req?.get('x-request-id') || null,
      status: event.status || 'success',
      error_message: event.errorMessage || null
    };

    await supabase.from('audit_logs').insert(logEntry);
  }

  async query(params: {
    tenantId: string;
    userId?: string;
    action?: string;
    category?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', params.tenantId)
      .order('created_at', { ascending: false });

    if (params.userId) query = query.eq('user_id', params.userId);
    if (params.action) query = query.eq('action', params.action);
    if (params.category) query = query.eq('category', params.category);
    if (params.resourceType) query = query.eq('resource_type', params.resourceType);
    if (params.startDate) query = query.gte('created_at', params.startDate.toISOString());
    if (params.endDate) query = query.lte('created_at', params.endDate.toISOString());

    query = query.range(
      params.offset || 0,
      (params.offset || 0) + (params.limit || 50) - 1
    );

    const { data, count, error } = await query;

    if (error) throw error;

    return { logs: data || [], total: count || 0 };
  }

  async export(tenantId: string, startDate: Date, endDate: Date): Promise<string> {
    const { logs } = await this.query({
      tenantId,
      startDate,
      endDate,
      limit: 100000  // Max export size
    });

    // Convert to CSV
    const csv = this.toCSV(logs);
    return csv;
  }

  private toCSV(logs: AuditLog[]): string {
    const headers = [
      'timestamp', 'user_id', 'action', 'category',
      'resource_type', 'resource_id', 'status', 'ip_address'
    ];

    const rows = logs.map(log => [
      log.created_at,
      log.user_id || '',
      log.action,
      log.category,
      log.resource_type || '',
      log.resource_id || '',
      log.status,
      log.ip_address || ''
    ].map(v => `"${v}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}

// Middleware for automatic audit logging
export function auditMiddleware(action: string, category: AuditEvent['category']) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auditService = new AuditService();
    const startTime = Date.now();

    res.on('finish', async () => {
      await auditService.log({
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
        action,
        category,
        resourceType: req.params.resourceType,
        resourceId: req.params.id,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - startTime
        },
        status: res.statusCode < 400 ? 'success' : 'failure'
      }, req);
    });

    next();
  };
}
```

---

## Data Retention

### Retention Policies

```sql
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  retention_days INT NOT NULL,
  archive_before_delete BOOLEAN NOT NULL DEFAULT TRUE,
  notify_before_delete BOOLEAN NOT NULL DEFAULT TRUE,
  notify_days_before INT NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, resource_type)
);

-- Default policies
INSERT INTO retention_policies (tenant_id, resource_type, retention_days, archive_before_delete)
VALUES
  ('default', 'meeting_transcripts', 365, true),
  ('default', 'meeting_recordings', 90, true),
  ('default', 'audit_logs', 730, true),
  ('default', 'agent_runs', 90, false),
  ('default', 'analytics_snapshots', 365, true);
```

### Retention Service

```typescript
// src/retention/service.ts

export class RetentionService {
  async runRetentionJob(): Promise<RetentionResult> {
    const policies = await this.getActivePolicies();
    const results: RetentionResult = { archived: 0, deleted: 0, errors: [] };

    for (const policy of policies) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // Get items to process
        const items = await this.getExpiredItems(
          policy.tenantId,
          policy.resourceType,
          cutoffDate
        );

        // Archive if configured
        if (policy.archiveBeforeDelete && items.length > 0) {
          await this.archiveItems(policy.tenantId, policy.resourceType, items);
          results.archived += items.length;
        }

        // Delete items
        await this.deleteItems(policy.tenantId, policy.resourceType, items);
        results.deleted += items.length;

      } catch (error) {
        results.errors.push({
          policy: policy.resourceType,
          error: error.message
        });
      }
    }

    return results;
  }

  async getUpcomingDeletions(tenantId: string): Promise<UpcomingDeletion[]> {
    const policies = await this.getPoliciesForTenant(tenantId);
    const upcoming: UpcomingDeletion[] = [];

    for (const policy of policies) {
      if (!policy.notifyBeforeDelete) continue;

      const notifyDate = new Date();
      notifyDate.setDate(notifyDate.getDate() + policy.notifyDaysBefore);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const count = await this.countItemsInRange(
        tenantId,
        policy.resourceType,
        cutoffDate,
        notifyDate
      );

      if (count > 0) {
        upcoming.push({
          resourceType: policy.resourceType,
          count,
          deleteDate: cutoffDate
        });
      }
    }

    return upcoming;
  }
}
```

---

## GDPR Compliance Tools

### User Data Export

```typescript
// src/gdpr/export.ts

export async function exportUserData(userId: string, tenantId: string): Promise<Buffer> {
  const exportData: Record<string, any> = {};

  // User profile
  exportData.profile = await getUserProfile(userId);

  // Meetings
  exportData.meetings = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  // Tasks
  exportData.tasks = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .eq('tenant_id', tenantId);

  // Agent runs
  exportData.agentRuns = await supabase
    .from('agent_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  // Audit logs (user's own actions)
  exportData.auditLogs = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  // Convert to JSON and return as Buffer
  return Buffer.from(JSON.stringify(exportData, null, 2));
}
```

### User Data Deletion (Right to be Forgotten)

```typescript
// src/gdpr/delete.ts

export async function deleteUserData(
  userId: string,
  tenantId: string,
  options: { keepAuditLogs?: boolean } = {}
): Promise<DeletionResult> {
  const result: DeletionResult = { deleted: [], errors: [] };

  // Transaction for atomic deletion
  const tables = [
    'coaching_sessions',
    'coaching_prompts',
    'customer_sentiment',
    'user_roles',
    'sso_sessions'
  ];

  for (const table of tables) {
    try {
      await supabase
        .from(table)
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      result.deleted.push(table);
    } catch (error) {
      result.errors.push({ table, error: error.message });
    }
  }

  // Anonymize (don't delete) meetings and tasks
  await supabase
    .from('meetings')
    .update({ user_id: null, created_by: '[deleted]' })
    .eq('user_id', userId);

  await supabase
    .from('tasks')
    .update({ assigned_to: null })
    .eq('assigned_to', userId);

  // Optionally keep audit logs (for compliance)
  if (!options.keepAuditLogs) {
    await supabase
      .from('audit_logs')
      .update({ user_id: null, details: { anonymized: true } })
      .eq('user_id', userId);
  }

  // Finally delete user
  await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  return result;
}
```

---

## Multi-Tenant Isolation

### Tenant Middleware

```typescript
// src/middleware/tenant.ts

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  // Attach to request for all downstream queries
  req.tenantId = tenantId as string;

  // Override Supabase client with RLS context
  req.supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          'x-tenant-id': tenantId as string
        }
      }
    }
  );

  next();
}
```

### Row-Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
-- ... etc

-- RLS policy example for meetings
CREATE POLICY tenant_isolation_meetings ON meetings
  USING (tenant_id = current_setting('request.jwt.claims')::json->>'tenant_id');

CREATE POLICY tenant_isolation_tasks ON tasks
  USING (tenant_id = current_setting('request.jwt.claims')::json->>'tenant_id');
```

---

## API Endpoints

### RBAC Endpoints

```typescript
// GET /api/roles - List all roles
// POST /api/roles - Create custom role (admin only)
// PUT /api/roles/:id - Update role
// DELETE /api/roles/:id - Delete role (if not system)

// GET /api/users/:id/roles - Get user's roles
// POST /api/users/:id/roles - Assign role to user
// DELETE /api/users/:id/roles/:roleId - Remove role from user

// GET /api/permissions - List all available permissions
```

### SSO Endpoints

```typescript
// GET /api/sso/config - Get SSO configuration
// PUT /api/sso/config - Update SSO configuration
// POST /api/sso/test - Test SSO configuration
// GET /api/sso/providers - List supported providers
```

### Audit Endpoints

```typescript
// GET /api/audit/logs - Query audit logs (with filters)
// GET /api/audit/export - Export audit logs as CSV
// GET /api/audit/statistics - Audit statistics
```

### GDPR Endpoints

```typescript
// POST /api/gdpr/export/:userId - Export user data
// POST /api/gdpr/delete/:userId - Delete user data (RTBF)
// GET /api/gdpr/retention - Get retention policies
// PUT /api/gdpr/retention - Update retention policies
```

---

## Testing Plan

### RBAC Tests
- Permission inheritance (wildcard matching)
- Role assignment and removal
- Access denied scenarios
- Custom role creation

### SSO Tests
- SAML login flow (mock IdP)
- User auto-provisioning
- Session management
- Logout/SLO

### Audit Tests
- All actions logged correctly
- Query performance with large logs
- Export functionality
- Log retention

### GDPR Tests
- Data export completeness
- Data deletion completeness
- Anonymization verification

---

## Security Checklist

- [ ] All routes protected by RBAC middleware
- [ ] SSO certificates rotated regularly
- [ ] Audit logs encrypted at rest
- [ ] Tenant isolation verified (no cross-tenant access)
- [ ] Passwords hashed with bcrypt/argon2
- [ ] Session tokens have expiration
- [ ] CSRF protection enabled
- [ ] Rate limiting on auth endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)

---

## Next File

Reply: **"Show file 05"** for Advanced Integrations specification.
