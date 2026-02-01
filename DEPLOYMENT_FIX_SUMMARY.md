# Deployment Fix Summary

## Problem Statement

The deployment script was failing with two main issues:

1. **Permission Errors**: The `chmod -R 755 "$DEPLOY_PATH"` command was attempting to change permissions on all files in the deployment directory, including:
   - `.git` directory files (causing "Operation not permitted" errors)
   - Backup directories (e.g., `backend_backup_*`, `frontend_backup_*`)
   - Hundreds of files that didn't need permission changes

2. **Missing Service**: The deployment script was trying to stop/restart `pdfmerger.service`, but the service was not configured, causing errors like:
   - `Failed to stop pdfmerger.service: Unit pdfmerger.service not loaded.`

## Changes Made

### 1. Fixed Permission Issues (`.github/workflows/deploy.yml`)

**Before:**
```bash
chmod -R 755 "$DEPLOY_PATH"
```

**After:**
```bash
chmod -R 755 "$DEPLOY_PATH/backend"
chmod -R 755 "$DEPLOY_PATH/frontend"
```

**Impact**: 
- Only changes permissions on the deployed backend and frontend directories
- Leaves .git, backup directories, and other files untouched
- Eliminates hundreds of "Operation not permitted" errors
- More secure and focused approach

### 2. Added Service Existence Checks

**Service Stop (Before):**
```bash
systemctl --user stop pdfmerger || true
```

**Service Stop (After):**
```bash
if systemctl --user list-unit-files pdfmerger.service &>/dev/null; then
  systemctl --user stop pdfmerger || echo "Warning: Could not stop pdfmerger service"
else
  echo "Note: pdfmerger.service not yet configured (this is expected on first deployment)"
fi
```

**Service Restart (Before):**
```bash
systemctl --user restart pdfmerger || {
  echo "Warning: Could not restart pdfmerger service"
  echo "Check service status with: systemctl --user status pdfmerger"
  echo "Check logs with: journalctl --user -u pdfmerger"
}
```

**Service Restart (After):**
- Checks if service exists before attempting restart
- If service doesn't exist, displays comprehensive setup instructions including:
  - How to create the service directory
  - Complete service file configuration
  - Commands to enable and start the service
  - How to enable linger for persistence
  - Reference to DEPLOYMENT.md for more details

**Service Verification (Before):**
```bash
if systemctl --user is-active --quiet pdfmerger; then
  echo "✓ Backend service is running"
else
  echo "✗ Backend service failed to start"
  systemctl --user status pdfmerger || true
  exit 1
fi
```

**Service Verification (After):**
- Only checks service status if it exists
- Provides friendly warning if service is not configured
- Doesn't fail the deployment when service is missing

### 3. Added Automated Service Setup Script

Created `scripts/setup-service.sh`:
- Automated script for setting up systemd user service
- Validates deployment path exists
- Creates service directory and file
- Enables and starts the service
- Provides next steps for enabling linger
- Error handling and status verification

### 4. Enhanced Documentation

**Updated `DEPLOYMENT.md`:**
- Added "Quick Start" section at the top
- Documented both automated and manual service setup
- Clear instructions for enabling linger
- Referenced the new setup script

**Updated `.github/workflows/README.md`:**
- Added reference to main DEPLOYMENT.md at the top
- Documented recent improvements
- Updated systemd section for user services
- Removed outdated system service instructions
- Explained benefits of user services

**Created `scripts/README.md`:**
- Documentation for setup-service.sh script
- Usage instructions
- Troubleshooting guide
- Common issues and solutions

## Benefits

1. **Cleaner Deployments**: No more hundreds of permission errors in logs
2. **Better Security**: Only modifies permissions where needed
3. **Graceful Degradation**: Deployment succeeds even without service configured
4. **Clear Guidance**: Provides step-by-step instructions when service is missing
5. **Easier Setup**: Automated script for service configuration
6. **Better Documentation**: Comprehensive guides for all scenarios

## Testing

The changes were tested with:
1. Mock deployment directory structure
2. Verified selective chmod only affects intended directories
3. Bash syntax validation on setup script
4. Tested deploy script with missing service scenario

## Next Steps for Users

If you're deploying for the first time:

1. Run the deployment (it will succeed and provide instructions)
2. SSH into your server as the deployment user
3. Run the setup script:
   ```bash
   cd /home/pdfmerger/pdf-editor
   ./scripts/setup-service.sh
   sudo loginctl enable-linger $USER
   ```
4. Future deployments will now automatically restart the service

## Files Changed

- `.github/workflows/deploy.yml` - Fixed chmod and added service checks
- `DEPLOYMENT.md` - Added quick start guide and setup options
- `.github/workflows/README.md` - Updated with recent changes and user service info
- `scripts/setup-service.sh` - New automated setup script (created)
- `scripts/README.md` - Documentation for setup script (created)
