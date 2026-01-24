# Security Policy

## Supported Versions

We are committed to maintaining the security of the PDF Editor project. The following versions are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Security Updates

### Recent Security Fixes

**2026-01-24**: Updated dependencies to address security vulnerabilities:
- Updated `fastapi` from 0.104.1 to 0.109.1 (fixes ReDoS vulnerability in Content-Type Header)
- Updated `python-multipart` from 0.0.6 to 0.0.18 (fixes multiple vulnerabilities including ReDoS and DoS via malformed multipart/form-data)

## Reporting a Vulnerability

If you discover a security vulnerability within the PDF Editor project, please follow these steps:

1. **Do Not** disclose the vulnerability publicly until it has been addressed
2. Email the details to the repository maintainer
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Investigation**: We will investigate and validate the reported vulnerability
- **Fix**: If confirmed, we will work on a fix and release it as soon as possible
- **Credit**: We will credit you for the discovery (unless you prefer to remain anonymous)

## Security Best Practices

When deploying this application, please follow these security best practices:

### Production Deployment

1. **Environment Variables**: Never commit sensitive data to the repository
   - Use environment variables for all configuration
   - Store secrets securely (e.g., AWS Secrets Manager, HashiCorp Vault)

2. **CORS Configuration**: Update CORS settings for production
   - Restrict `allow_origins` to your actual domain(s)
   - Remove wildcard origins in production

3. **File Upload Security**:
   - Implement file size limits
   - Validate file types thoroughly
   - Scan uploaded files for malware
   - Store uploaded files securely

4. **Database Security**:
   - Use parameterized queries (when implementing database)
   - Implement proper access controls
   - Encrypt sensitive data at rest
   - Use SSL/TLS for database connections

5. **API Security**:
   - Implement authentication and authorization
   - Use rate limiting to prevent abuse
   - Implement input validation on all endpoints
   - Use HTTPS in production
   - Implement proper session management

6. **Dependencies**:
   - Regularly update dependencies to latest secure versions
   - Use tools like `pip-audit` or `safety` to scan for vulnerabilities
   - Monitor security advisories for used packages

7. **Logging and Monitoring**:
   - Implement comprehensive logging
   - Monitor for suspicious activities
   - Set up alerts for security events
   - Never log sensitive information

### Development Security

1. Keep dependencies up to date: `pip install --upgrade -r requirements.txt`
2. Run security scans regularly: `pip-audit` or `safety check`
3. Use pre-commit hooks for security checks
4. Follow the principle of least privilege
5. Use secure coding practices as outlined in OWASP guidelines

## Dependency Security

We use automated tools to monitor our dependencies for security vulnerabilities:

- **GitHub Dependabot**: Automatically creates pull requests for dependency updates
- **CodeQL**: Automated code scanning for vulnerabilities
- **pip-audit**: Python dependency vulnerability scanner

To check for vulnerabilities manually:

```bash
# Install pip-audit
pip install pip-audit

# Scan dependencies
cd backend
pip-audit
```

## Known Security Considerations

### Current Implementation

The current implementation uses in-memory storage which means:
- ✅ No SQL injection vulnerabilities
- ✅ No database connection security concerns
- ⚠️ Data is lost on restart (by design for development)

When migrating to a database:
- Use parameterized queries
- Implement proper connection pooling
- Use encrypted connections
- Follow database security best practices

### File Upload

The application accepts PDF uploads. Security considerations:
- ✅ File type validation (extension and pypdf parsing)
- ✅ Error handling for malformed PDFs
- ⚠️ No file size limits (should be added in production)
- ⚠️ No malware scanning (should be added in production)

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
- [Python Security Best Practices](https://python.readthedocs.io/en/latest/library/security_warnings.html)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

## Contact

For security concerns, please contact the repository maintainer through GitHub.

---

**Last Updated**: 2026-01-24
