# Production Deployment Guide

This guide explains how to set up and deploy the PDF Editor application to a production server.

## Quick Start: Backend Service Setup

If you've just deployed and see a message about the backend service not being configured, you have two options:

### Option 1: Automated Setup (Recommended)

Use the provided setup script:

```bash
# As the deployment user (e.g., pdfmerger)
cd /home/pdfmerger/pdf-editor
./scripts/setup-service.sh

# Then enable linger (requires sudo)
sudo loginctl enable-linger $USER
```

### Option 2: Manual Setup

```bash
# As the deployment user (e.g., pdfmerger)

# 1. Create service directory
mkdir -p ~/.config/systemd/user

# 2. Create service file
cat > ~/.config/systemd/user/pdfmerger.service << 'EOF'
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
EOF

# 3. Enable and start the service
systemctl --user daemon-reload
systemctl --user enable pdfmerger
systemctl --user start pdfmerger

# 4. Enable linger to keep service running after logout (requires sudo)
sudo loginctl enable-linger $USER

# 5. Verify the service is running
systemctl --user status pdfmerger
```

For detailed setup instructions, continue reading below.

## Prerequisites

### Server Requirements

- **Operating System**: Ubuntu 20.04+ or Debian 11+
- **Python**: Version 3.9 or higher
- **Apache**: Version 2.4+
- **systemd**: For service management
- **SSH Access**: For deployment automation

### Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install Apache
sudo apt install apache2 -y

# Install Git (if not already installed)
sudo apt install git -y
```

## Server Setup

### 1. Create Deployment User

It's recommended to create a dedicated user for deployments:

```bash
# Create deployment user
sudo adduser pdfmerger
```

### 2. Configure User Permissions

The deployment script runs without sudo, so the deployment user needs proper permissions:

```bash
# Create deployment directory owned by the deployment user
sudo mkdir -p /home/pdfmerger/pdf-editor
sudo chown -R pdfmerger:pdfmerger /home/pdfmerger/pdf-editor

# If using Apache, ensure the deployment user can write to the web directory
# Option 1: Make the deployment user owner of the web directory
sudo mkdir -p /var/www/pdf.malahieude.net/frontend
sudo chown -R pdfmerger:pdfmerger /var/www/pdf.malahieude.net

# Option 2: Add deployment user to www-data group and set group write permissions
# sudo usermod -aG www-data pdfmerger
# sudo chown -R www-data:www-data /var/www/pdf.malahieude.net
# sudo chmod -R 775 /var/www/pdf.malahieude.net
```

### 3. Create Deployment Directory

```bash
# Create deployment directory
sudo mkdir -p /home/pdfmerger/pdf-editor
sudo chown pdfmerger:pdfmerger /home/pdfmerger/pdf-editor
```

### 4. Configure Apache

Create Apache virtual host configuration:

```bash
sudo nano /etc/apache2/sites-available/pdf-editor.conf
```

Add the following configuration:

```apache
<VirtualHost *:80>
    ServerName pdf.malahieude.net
    DocumentRoot /var/www/pdf.malahieude.net/frontend

    <Directory /var/www/pdf.malahieude.net/frontend>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/pdf-editor-error.log
    CustomLog ${APACHE_LOG_DIR}/pdf-editor-access.log combined
</VirtualHost>
```

Enable the site and required modules:

```bash
# Create web directory
sudo mkdir -p /var/www/pdf.malahieude.net/frontend
sudo chown -R www-data:www-data /var/www/pdf.malahieude.net

# Enable site and modules
sudo a2ensite pdf-editor
sudo a2enmod rewrite
sudo systemctl restart apache2
```

### 5. Create User systemd Service for Backend

The backend service runs as a user service (not a system service), which allows the deployment user to manage it without sudo. The deployment script uses `systemctl --user` commands to control the service, requiring no sudo privileges.

Create a user systemd service directory:

```bash
# As the deployment user (pdfmerger)
mkdir -p ~/.config/systemd/user
```

Create a systemd user service file:

```bash
nano ~/.config/systemd/user/pdfmerger.service
```

Add the following content:

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

Enable and start the user service:

```bash
# Reload user systemd daemon
systemctl --user daemon-reload

# Enable the service to start on login
systemctl --user enable pdfmerger

# Start the service
systemctl --user start pdfmerger

# Check service status
systemctl --user status pdfmerger
```

**Enable Linger** (to keep user services running after logout):

```bash
# As root or with sudo
sudo loginctl enable-linger pdfmerger
```

This ensures the user's systemd services continue running even when the user is not logged in.

### 6. Configure SSL (Recommended)

Install Certbot for Let's Encrypt SSL:

```bash
sudo apt install certbot python3-certbot-apache -y
sudo certbot --apache -d pdf.malahieude.net
```

## GitHub Actions Configuration

### 1. Repository Variables

Configure the following variables in your GitHub repository settings:

Go to: **Settings → Secrets and variables → Actions → Variables**

Create these repository variables:

- `SSH_HOST`: Your server hostname or IP address (e.g., `example.com`)
- `SSH_USER`: SSH username for deployment (e.g., `pdfmerger`)
- `DEPLOY_PATH`: Deployment directory path (default: `/home/pdfmerger/pdf-editor`)
- `PYTHON_VERSION`: Python version to use (default: `3.9`)

### 2. Repository Secrets

Configure the following secrets in your GitHub repository settings:

Go to: **Settings → Secrets and variables → Actions → Secrets**

Create this repository secret:

- `SSH_PRIVATE_KEY`: SSH private key for authentication

**To generate SSH key pair:**

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/pdf-editor-deploy

# Copy the public key to the server
ssh-copy-id -i ~/.ssh/pdf-editor-deploy.pub pdfmerger@your-server.com

# Copy the private key content for GitHub secret
cat ~/.ssh/pdf-editor-deploy
```

Copy the entire private key content (including `-----BEGIN` and `-----END` lines) and paste it into the `SSH_PRIVATE_KEY` secret in GitHub.

## Deployment Process

The deployment is automated via GitHub Actions and triggers on push to `main` or `master` branch.

### Manual Deployment

To manually trigger a deployment:

1. Push changes to the `main` or `master` branch
2. GitHub Actions will automatically:
   - Build the frontend
   - Create a deployment package
   - Copy files to the server
   - Run the deployment script
   - Restart services

### Deployment Script Actions

The deployment script (`deploy.sh`) performs the following steps:

1. **Stop Backend Service**: Stops the running user backend service with `systemctl --user stop`
2. **Backup Existing Files**: Creates timestamped backups of current backend and frontend
3. **Copy New Files**: Copies new backend and frontend files to deployment directory
4. **Set Permissions**: Sets proper file permissions (755)
5. **Install Dependencies**: Updates Python virtual environment with new dependencies
6. **Deploy Frontend**: Copies built frontend files to web-accessible directory (if writable)
7. **Restart Services**: Restarts the user backend service with `systemctl --user restart`
8. **Verify Services**: Checks that the backend service is running correctly

**Note**: All operations run without sudo. The deployment user must have proper file permissions.

## Troubleshooting

### Permission Denied Errors

If you see permission errors, ensure proper ownership:

```bash
# For deployment directory (as root)
sudo chown -R pdfmerger:pdfmerger /home/pdfmerger/pdf-editor

# For web directory (as root) - choose one option:
# Option 1: User ownership
sudo chown -R pdfmerger:pdfmerger /var/www/pdf.malahieude.net

# Option 2: Group permissions
sudo chown -R www-data:www-data /var/www/pdf.malahieude.net
sudo usermod -aG www-data pdfmerger
sudo chmod -R 775 /var/www/pdf.malahieude.net
```

### Service Fails to Start

Check user service logs:

```bash
# As the deployment user
systemctl --user status pdfmerger
journalctl --user -u pdfmerger -n 50

# Check if linger is enabled (should show pdfmerger)
loginctl show-user pdfmerger | grep Linger
```

If the service doesn't persist after logout:

```bash
# Enable linger (as root)
sudo loginctl enable-linger pdfmerger
```

### Apache Logs

Check Apache logs (as root):

```bash
sudo journalctl -u apache2 -n 50
sudo tail -f /var/log/apache2/error.log
```

### SSH Connection Issues

Test SSH connection manually:

```bash
ssh -i ~/.ssh/pdf-editor-deploy pdfmerger@your-server.com
```

Verify the SSH key has proper permissions:

```bash
chmod 600 ~/.ssh/pdf-editor-deploy
```

## Security Best Practices

1. **Use SSH Key Authentication**: Never use password authentication for automated deployments
2. **Principle of Least Privilege**: The deployment user runs without sudo, minimizing security risks
3. **User Services**: Backend runs as a user service, not as root
4. **Regular Updates**: Keep server software up to date
5. **Monitor Logs**: Regularly review deployment and application logs
6. **Backup Strategy**: Maintain regular backups of application data
7. **SSL/TLS**: Always use HTTPS in production
8. **Firewall**: Configure firewall to only allow necessary ports
9. **File Permissions**: Ensure deployment directories have appropriate permissions

## Monitoring

### Health Check Endpoints

- Frontend: `https://pdf.malahieude.net`
- Backend: `https://pdf-api.malahieude.net`
- API Docs: `https://pdf-api.malahieude.net/docs`

### Service Status

Check service status:

```bash
# Backend user service (as deployment user)
systemctl --user status pdfmerger

# Apache service (as root)
sudo systemctl status apache2
```

## Rollback Procedure

If a deployment fails, you can rollback to the previous version:

```bash
# As deployment user (pdfmerger)

# Stop service
systemctl --user stop pdfmerger

# Restore from backup (use the latest timestamp)
cd /home/pdfmerger/pdf-editor
rm -rf backend frontend
mv backend_backup_YYYYMMDD_HHMMSS backend
mv frontend_backup_YYYYMMDD_HHMMSS frontend

# Restore frontend (if you have write access)
rm -rf /var/www/pdf.malahieude.net/frontend/*
cp -r /home/pdfmerger/pdf-editor/frontend/build/* /var/www/pdf.malahieude.net/frontend/

# Restart service
systemctl --user start pdfmerger
```

**Note**: Apache restart requires root access. If needed, contact your system administrator.

## Support

For issues or questions:
- Check the logs first
- Review this deployment guide
- Open an issue on the GitHub repository
