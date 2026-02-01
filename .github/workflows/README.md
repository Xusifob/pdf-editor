# GitHub Actions Deployment

This directory contains the GitHub Actions workflow for automated deployment.

## Important Note

**For comprehensive deployment documentation, see [DEPLOYMENT.md](../../DEPLOYMENT.md)** in the root directory, which includes:
- Complete server setup instructions
- Service configuration (systemd user services)
- Automated setup scripts
- Troubleshooting guides
- Security best practices

This README provides workflow-specific details.

## Workflow: Deploy to Server

The `deploy.yml` workflow automatically deploys the PDF Editor application to a remote server whenever code is pushed to the `master` branch.

### How It Works

1. **Triggers**: Automatically runs on push to `master` or `main` branch
2. **Validates**: Checks that required SSH configuration variables are set
3. **Builds**: Compiles TypeScript and creates production build of the React frontend
4. **Type Checks**: Runs TypeScript type checking to catch errors before deployment
5. **Packages**: Bundles backend and frontend with deployment scripts
6. **Transfers**: Securely copies package to the remote server via SSH using a secure temporary directory
7. **Deploys**: Runs the deployment script which:
   - Stops the backend service (if it exists)
   - Creates timestamped backups of existing backend and frontend
   - Copies new files to the deployment directory
   - Sets permissions on backend and frontend directories only (not .git or backups)
   - Installs Python dependencies in a virtual environment
   - Deploys frontend to Apache web directory (if accessible)
   - Restarts the backend service (if configured)
   - Provides setup instructions if service is not yet configured

### Recent Improvements

**Fixed Deployment Issues (Feb 2026)**:
- **Permission errors resolved**: chmod now only applies to backend and frontend directories, not .git or backup directories
- **Service handling improved**: Gracefully handles missing systemd service with clear setup instructions
- **Better error messages**: Deployment script now provides step-by-step guidance when service is not configured
- **Automated setup script**: New `scripts/setup-service.sh` for easy service configuration

### Required Configuration

#### Secrets (Repository Settings → Secrets → Actions)

The following secret must be configured in your GitHub repository:

- `SSH_PRIVATE_KEY`: The private SSH key for authentication to the deployment server
  - Generate a new SSH key pair: `ssh-keygen -t ed25519 -C "github-actions" -f deploy_key`
  - Add the public key (`deploy_key.pub`) to `~/.ssh/authorized_keys` on your server
  - Add the private key (`deploy_key`) content to GitHub Secrets as `SSH_PRIVATE_KEY`

#### Repository Variables (Repository Settings → Secrets and variables → Actions → Variables)

The following variables must be configured in your GitHub repository:

- `SSH_HOST`: The hostname or IP address of your deployment server (e.g., `example.com` or `192.168.1.100`)
- `SSH_USER`: The username to use for SSH connection (e.g., `deploy` or `ubuntu`)
- `DEPLOY_PATH` (optional): The directory path on the server where the application will be deployed (defaults to `/opt/pdf-editor` if not specified)
- `PYTHON_VERSION` (optional): Python version to use (defaults to `3.11` if not specified)

### Setup Instructions

1. **Generate SSH Key Pair**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key
   ```

2. **Add Public Key to Server**
   ```bash
   # Copy the public key
   cat deploy_key.pub
   
   # On your server, add it to authorized_keys
   mkdir -p ~/.ssh
   echo "PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   ```

3. **Add Private Key to GitHub Secrets**
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SSH_PRIVATE_KEY`
   - Value: Paste the entire content of the `deploy_key` file (the private key)

4. **Add Variables to GitHub**
   - Go to Settings → Secrets and variables → Actions → Variables tab
   - Add `SSH_HOST` with your server hostname/IP
   - Add `SSH_USER` with your SSH username
   - (Optional) Add `DEPLOY_PATH` to customize deployment directory (defaults to `/opt/pdf-editor`)
   - (Optional) Add `PYTHON_VERSION` to specify Python version (defaults to `3.11`)

5. **Server Prerequisites**
   - Python 3.11+ installed (or version specified in `PYTHON_VERSION`)
   - pip package manager installed
   - SSH access configured with public key authentication
   - Port 8000 (backend) accessible
   - User has permission to install Python packages with pip
   - User has write permissions to the deployment directory
   - **Recommended**: Use a dedicated deployment user with limited permissions

   **Note on DEPLOY_PATH permissions:**
   - If using `/opt/pdf-editor`, the directory should be pre-created with proper ownership:
     ```bash
     sudo mkdir -p /opt/pdf-editor
     sudo chown $USER:$USER /opt/pdf-editor
     ```
   - Alternatively, use a directory in the user's home directory (e.g., `~/pdf-editor`)

### Deployment Process

When you push to `master`, the workflow will:

1. Check out the code
2. Validate that SSH_HOST and SSH_USER are configured
3. Set up Node.js 18
4. Install frontend dependencies
5. Run TypeScript type checking (compiles .ts/.tsx files without emitting)
6. Build the React frontend for production (`npm run build`)
7. Create a deployment package with:
   - Backend Python code and dependencies
   - Built frontend static files
   - Start/stop scripts for server management
8. Transfer the package to a secure temporary directory on the server via SCP
9. SSH into the server and:
   - Verify write permissions to deployment directory
   - Stop any existing server process
   - Extract the new deployment package
   - Install Python dependencies with pip
   - Start the backend server with uvicorn
   - Verify the server started successfully
   - Clean up temporary files

### Server Management Scripts

The deployment creates two scripts in the deployment directory:

**start.sh** - Starts the application
```bash
./start.sh
```
- Stops any existing backend processes
- Starts uvicorn server on port 8000
- Logs output to `backend.log`
- Stores process ID in `backend.pid`

**stop.sh** - Stops the application
```bash
./stop.sh
```
- Gracefully stops the backend server
- Removes the PID file

### Application Structure on Server

After deployment, the structure in `DEPLOY_PATH` will be:

```
/opt/pdf-editor/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   └── (built static files)
├── start.sh
├── stop.sh
├── backend.pid (when running)
└── backend.log
```

### Accessing the Application

- **Backend API**: http://your-server:8000
- **API Documentation**: http://your-server:8000/docs
- **Frontend**: Serve the `frontend/` directory with a web server (nginx, Apache, etc.)

### Troubleshooting

**SSH Connection Issues**
- Verify `SSH_HOST` and `SSH_USER` are correct
- Ensure the private key matches the public key on the server
- Check that the server allows SSH connections from GitHub Actions IPs

**Python/pip Issues**
- Ensure Python is installed: `python3.11 --version`
- Ensure pip is available: `python3.11 -m pip --version`
- Check user has pip install permissions
- Try `python3.11 -m pip install --user -r requirements.txt` manually

**Backend Startup Failures**
- Check `backend.log` for error messages
- Verify port 8000 is not already in use: `netstat -tuln | grep 8000`
- Check if uvicorn is installed: `python3.11 -m pip list | grep uvicorn`
- Manually test: `cd backend && python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000`

**Build Failures**
- Check the workflow logs in GitHub Actions tab
- Verify `package.json` and `requirements.txt` are up to date
- Ensure all dependencies are properly specified

**TypeScript Errors**
- TypeScript type checking runs during build - check workflow logs for type errors
- Run `npx tsc --noEmit` locally in the frontend directory to check for type errors
- Ensure all TypeScript dependencies are installed: `@types/react`, `@types/react-dom`, etc.

**Configuration Validation Failures**
- Ensure `SSH_HOST` and `SSH_USER` variables are set in GitHub repository variables
- The workflow will fail early with clear error messages if these are missing

**Permission Errors**
- If deployment fails with permission errors, verify the deployment directory permissions
- For `/opt/pdf-editor`, pre-create with: `sudo mkdir -p /opt/pdf-editor && sudo chown $USER:$USER /opt/pdf-editor`
- Consider using a path in the user's home directory for simpler permissions

### Security Notes

**SSH Authentication:**
- The SSH private key is stored securely in GitHub Secrets and never exposed in logs
- The key is removed from the runner after deployment
- Use a dedicated deployment key with minimal permissions
- **SSH Host Key Verification**: The workflow uses `ssh-keyscan` to add the host key. While this is standard practice in CI/CD, it is susceptible to man-in-the-middle attacks during first connection.
  - For enhanced security, consider manually adding the server's host key to GitHub Secrets and using it directly
  - This tradeoff is acceptable for most use cases given the convenience and standard practice

**Server Security:**
- Consider setting up a dedicated deployment user on your server with limited permissions
- Review firewall rules to ensure proper access control
- Backend runs as a background process - consider using a process manager like systemd or supervisor for production
- Deployment files are transferred to a secure temporary directory (created with `mktemp -d`) rather than world-writable `/tmp`

**Production Recommendations:**
- Use a process manager (systemd, supervisor) for automatic restarts and better process management
- Implement HTTPS with a reverse proxy (nginx, Apache) for the frontend
- Set up proper logging and monitoring
- Regular security updates for all system packages

### Using systemd User Services (Recommended for Production)

The deployment now uses **systemd user services** instead of system services, which allows the deployment user to manage services without sudo privileges.

**Quick Setup (Automated)**:

Use the provided setup script after the first deployment:

```bash
# As the deployment user (e.g., pdfmerger)
cd /home/pdfmerger/pdf-editor
./scripts/setup-service.sh
sudo loginctl enable-linger $USER
```

**Manual Setup**:

1. Create the service directory:
```bash
mkdir -p ~/.config/systemd/user
```

2. Create the service file:
```bash
nano ~/.config/systemd/user/pdfmerger.service
```

Add the following content (adjust paths as needed):
```ini
[Unit]
Description=PDF Editor Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pdfmerger/pdf-editor/backend
Environment="PATH=/home/pdfmerger/pdf-editor/backend/venv/bin"
ExecStart=/home/pdfmerger/pdf-editor/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

3. Enable and start the service:
```bash
systemctl --user daemon-reload
systemctl --user enable pdfmerger
systemctl --user start pdfmerger
```

4. Enable linger (keeps service running after logout):
```bash
sudo loginctl enable-linger $USER
```

5. Check service status:
```bash
systemctl --user status pdfmerger
journalctl --user -u pdfmerger -f
```

**Benefits of User Services**:
- No sudo required for service management
- Deployment user controls their own services
- Automatic integration with deployment workflow
- Better security through privilege separation

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for complete documentation.

### Customization

**Deploy to a different directory:**

Add a `DEPLOY_PATH` variable in GitHub repository variables:
- Name: `DEPLOY_PATH`
- Value: `/your/custom/path` (e.g., `/home/deploy/apps/pdf-editor`)

**Use a different Python version:**

Add a `PYTHON_VERSION` variable in GitHub repository variables:
- Name: `PYTHON_VERSION`  
- Value: `3.10` or `3.12` (version must be installed on server)

**Deploy to a different branch:**

Modify the `on.push.branches` section in `deploy.yml`:

```yaml
on:
  push:
    branches:
      - main  # or your preferred branch
```

**Serve frontend with nginx:**

Example nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Serve frontend static files
    location / {
        root /opt/pdf-editor/frontend;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
