# GitHub Actions Deployment

This directory contains the GitHub Actions workflow for automated deployment.

## Workflow: Deploy to Server

The `deploy.yml` workflow automatically deploys the PDF Editor application to a remote server whenever code is pushed to the `master` branch.

### How It Works

1. **Triggers**: Automatically runs on push to `master` branch
2. **Builds**: Creates production build of the React frontend
3. **Packages**: Bundles backend and frontend with deployment scripts
4. **Transfers**: Securely copies package to the remote server via SSH
5. **Deploys**: Installs dependencies and starts Python server

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
   - User has permission to install Python packages (pip)

### Deployment Process

When you push to `master`, the workflow will:

1. Check out the code
2. Build the React frontend for production (`npm run build`)
3. Create a deployment package with:
   - Backend Python code and dependencies
   - Built frontend static files
   - Start/stop scripts for server management
4. Transfer the package to the server via SCP
5. SSH into the server and:
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
- Try `python3 -m pip install --user -r requirements.txt` manually

**Backend Startup Failures**
- Check `backend.log` for error messages
- Verify port 8000 is not already in use: `netstat -tuln | grep 8000`
- Check if uvicorn is installed: `python3.11 -m pip list | grep uvicorn`
- Manually test: `cd backend && python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000`

**Build Failures**
- Check the workflow logs in GitHub Actions tab
- Verify `package.json` and `requirements.txt` are up to date
- Ensure all dependencies are properly specified

### Security Notes

- The SSH private key is stored securely in GitHub Secrets and never exposed in logs
- The key is removed from the runner after deployment
- Use a dedicated deployment key with minimal permissions
- Consider setting up a dedicated deployment user on your server
- Review firewall rules to ensure proper access control
- Backend runs as a background process - consider using a process manager like systemd or supervisor for production

### Using a Process Manager (Recommended for Production)

For production deployments, it's recommended to use a process manager like **systemd** to manage the backend service:

1. Create a systemd service file on your server:
```bash
sudo nano /etc/systemd/system/pdf-editor.service
```

2. Add the following content (adjust paths as needed):
```ini
[Unit]
Description=PDF Editor Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/opt/pdf-editor/backend
ExecStart=/usr/bin/python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl enable pdf-editor
sudo systemctl start pdf-editor
```

4. Update deployment script to use systemd:
Modify the start.sh to use `sudo systemctl restart pdf-editor` instead of running uvicorn directly.

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
