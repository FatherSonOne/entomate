# Security Checklist

## Entomate Production Security Audit
**Version:** 1.0
**Last Updated:** Week 8 - Production Deployment

---

## Pre-Deployment Security Checklist

### Authentication & Authorization

- [ ] **JWT/Session Security**
  - [ ] JWT secret is strong (256+ bits)
  - [ ] Token expiration is configured (recommended: 1 hour)
  - [ ] Refresh token rotation is implemented
  - [ ] Sessions are invalidated on logout

- [ ] **Password Security**
  - [ ] Passwords hashed with bcrypt (cost factor 10+)
  - [ ] Password complexity requirements enforced
  - [ ] Password reset tokens expire quickly (1 hour max)
  - [ ] Account lockout after failed attempts

- [ ] **Role-Based Access Control**
  - [ ] User roles defined and enforced
  - [ ] API endpoints check authorization
  - [ ] Supabase RLS policies enabled
  - [ ] No privilege escalation vulnerabilities

### API Security

- [ ] **Rate Limiting**
  - [ ] Global API rate limit configured (100 req/min)
  - [ ] Auth endpoints have stricter limits (10 req/15min)
  - [ ] AI endpoints have separate limits (10 req/min)
  - [ ] Rate limit headers returned (X-RateLimit-*)

- [ ] **Input Validation**
  - [ ] All inputs validated on server
  - [ ] Request body size limited (50MB max)
  - [ ] File upload types restricted
  - [ ] Query parameters sanitized

- [ ] **SQL Injection Prevention**
  - [ ] Parameterized queries used (Supabase SDK)
  - [ ] No raw SQL with user input
  - [ ] Database user has minimal permissions

- [ ] **XSS Prevention**
  - [ ] Output encoding in templates
  - [ ] Content-Security-Policy header set
  - [ ] X-XSS-Protection header set
  - [ ] User input sanitized before storage

- [ ] **CSRF Protection**
  - [ ] CSRF tokens for state-changing operations
  - [ ] SameSite cookie attribute set
  - [ ] Origin header validation

### Network Security

- [ ] **HTTPS/TLS**
  - [ ] SSL certificate valid and not expired
  - [ ] TLS 1.2+ enforced
  - [ ] HSTS header enabled
  - [ ] HTTP redirects to HTTPS

- [ ] **CORS Configuration**
  - [ ] Allowed origins explicitly listed
  - [ ] No wildcard (*) in production
  - [ ] Credentials mode properly configured

- [ ] **Security Headers (Helmet)**
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Referrer-Policy: strict-origin-when-cross-origin
  - [ ] Permissions-Policy configured

### Data Protection

- [ ] **Sensitive Data Encryption**
  - [ ] Database encrypted at rest
  - [ ] Backups encrypted
  - [ ] API keys encrypted in storage
  - [ ] PII encrypted in database

- [ ] **Secrets Management**
  - [ ] All secrets in environment variables
  - [ ] No secrets in code or git history
  - [ ] .env files in .gitignore
  - [ ] Secret rotation process documented

- [ ] **Logging & Audit**
  - [ ] Sensitive data NOT logged
  - [ ] Failed login attempts logged
  - [ ] API access logged
  - [ ] Audit trail for data changes

### Infrastructure Security

- [ ] **Server Hardening**
  - [ ] Unnecessary ports closed
  - [ ] Firewall rules configured
  - [ ] SSH key-only authentication
  - [ ] Non-root user for application

- [ ] **Container Security**
  - [ ] Non-root container user
  - [ ] Image vulnerability scan passed
  - [ ] No sensitive data in image
  - [ ] Read-only file system where possible

- [ ] **Dependency Security**
  - [ ] npm audit shows no high/critical vulnerabilities
  - [ ] Dependencies up to date
  - [ ] Lock file committed (package-lock.json)
  - [ ] Snyk or similar scanning configured

### Error Handling

- [ ] **Error Responses**
  - [ ] No stack traces in production
  - [ ] Generic error messages to users
  - [ ] Detailed errors in logs only
  - [ ] Sentry configured for error tracking

### Third-Party Integrations

- [ ] **API Keys**
  - [ ] Each integration has separate keys
  - [ ] Keys have minimal required permissions
  - [ ] Key rotation schedule defined
  - [ ] Unused keys revoked

- [ ] **OAuth Security**
  - [ ] State parameter used
  - [ ] Redirect URIs validated
  - [ ] Tokens stored securely
  - [ ] Refresh tokens encrypted

---

## Security Verification Commands

```bash
# Check for known vulnerabilities
npm audit --audit-level=moderate

# Run Snyk security scan
npx snyk test

# Check ESLint security rules
npx eslint . --ext .js --plugin security

# Verify SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check security headers
curl -I https://yourdomain.com
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Lead | | | |
| Tech Lead | | | |
| DevOps Lead | | | |

---

## Incident Response

In case of security incident:

1. **Contain** - Isolate affected systems
2. **Assess** - Determine scope and impact
3. **Notify** - Alert security team and stakeholders
4. **Remediate** - Fix vulnerability
5. **Review** - Post-incident analysis
6. **Document** - Update procedures

**Security Contact:** security@yourdomain.com
**On-Call:** [See on-call rotation schedule]
