# Deployment Scripts

This directory contains utility scripts for deployment and server management.

## setup-service.sh

Sets up the systemd user service for the PDF Editor backend.

### Usage

Run this script **as the deployment user** (not root) after the first deployment:

```bash
# Default setup (uses /home/pdfmerger/pdf-editor)
./scripts/setup-service.sh

# Custom deployment path
DEPLOY_PATH=/custom/path/to/pdf-editor ./scripts/setup-service.sh
```

### What it does

1. Creates `~/.config/systemd/user/` directory if it doesn't exist
2. Creates the `pdfmerger.service` systemd user service file
3. Reloads the systemd daemon
4. Enables the service to start automatically
5. Starts the service
6. Verifies the service is running

### After running

Remember to enable linger so the service persists after logout:

```bash
sudo loginctl enable-linger $USER
```

### Troubleshooting

If the service fails to start, check the logs:

```bash
# View recent logs
journalctl --user -u pdfmerger -n 50

# Follow logs in real-time
journalctl --user -u pdfmerger -f

# Check service status
systemctl --user status pdfmerger
```

Common issues:
- **Python not found**: Ensure Python 3.9+ is installed
- **Permission denied**: Check that the deployment path is owned by the deployment user
- **Port already in use**: Another service may be using port 8000
- **Missing dependencies**: Run deployment again to reinstall Python packages
