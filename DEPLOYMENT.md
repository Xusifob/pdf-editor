# Production Deployment Guide

This guide explains how to set up and deploy the PDF Editor application to a production server.

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

# Add user to sudo group (if needed)
sudo usermod -aG sudo pdfmerger
```

### 2. Configure Passwordless Sudo (Required)

The deployment script requires passwordless sudo access for specific commands. This is necessary because the GitHub Actions CI/CD pipeline runs in a non-interactive environment where password prompts cannot be handled.

**Important**: Only grant passwordless sudo for the specific commands needed by the deployment script.

Create a sudoers configuration file for the deployment user:

```bash
sudo visudo -f /etc/sudoers.d/pdfmerger-deploy
```

Add the following content (replace `pdfmerger` with your deployment username):

```sudoers
# PDF Editor Deployment - Passwordless sudo commands
# This file grants specific sudo privileges without password for deployment automation

# Allow systemctl commands for PDF merger service
pdfmerger ALL=(ALL) NOPASSWD: /bin/systemctl stop pdfmerger
pdfmerger ALL=(ALL) NOPASSWD: /bin/systemctl start pdfmerger
pdfmerger ALL=(ALL) NOPASSWD: /bin/systemctl restart pdfmerger
pdfmerger ALL=(ALL) NOPASSWD: /bin/systemctl status pdfmerger

# Allow systemctl commands for Apache service
pdfmerger ALL=(ALL) NOPASSWD: /bin/systemctl restart apache2
pdfmerger ALL=(ALL) NOPASSWD: /bin/systemctl status apache2

# Allow file operations in deployment directory
# Note: Commands must be run from /tmp/tmp.* directory created by deployment script
pdfmerger ALL=(ALL) NOPASSWD: /bin/mv /home/pdfmerger/pdf-editor/backend /home/pdfmerger/pdf-editor/backend_backup_*
pdfmerger ALL=(ALL) NOPASSWD: /bin/mv /home/pdfmerger/pdf-editor/frontend /home/pdfmerger/pdf-editor/frontend_backup_*
pdfmerger ALL=(ALL) NOPASSWD: /bin/cp -r /tmp/tmp.*/backend /home/pdfmerger/pdf-editor/
pdfmerger ALL=(ALL) NOPASSWD: /bin/cp -r /tmp/tmp.*/frontend /home/pdfmerger/pdf-editor/
pdfmerger ALL=(ALL) NOPASSWD: /bin/chown -R www-data\:www-data /home/pdfmerger/pdf-editor/backend
pdfmerger ALL=(ALL) NOPASSWD: /bin/chown -R www-data\:www-data /home/pdfmerger/pdf-editor/frontend
pdfmerger ALL=(ALL) NOPASSWD: /bin/chmod -R 755 /home/pdfmerger/pdf-editor

# Allow file operations in Apache web directory
# Restrict source to deployment directory only
pdfmerger ALL=(ALL) NOPASSWD: /bin/rm -rf /var/www/pdf.malahieude.net/frontend/*
pdfmerger ALL=(ALL) NOPASSWD: /bin/cp -r /home/pdfmerger/pdf-editor/frontend/build/* /var/www/pdf.malahieude.net/frontend/

# Allow journalctl for debugging with specific flags only
pdfmerger ALL=(ALL) NOPASSWD: /bin/journalctl -u pdfmerger -n *
pdfmerger ALL=(ALL) NOPASSWD: /bin/journalctl -u pdfmerger --lines=*
pdfmerger ALL=(ALL) NOPASSWD: /bin/journalctl -u apache2 -n *
pdfmerger ALL=(ALL) NOPASSWD: /bin/journalctl -u apache2 --lines=*
```

Set proper permissions on the sudoers file:

```bash
sudo chmod 0440 /etc/sudoers.d/pdfmerger-deploy
```

**Verify the configuration**:

```bash
# Test without password prompt (should work)
sudo -n systemctl status pdfmerger
```

**Security Notes**:
- Only grant passwordless sudo for the specific commands needed
- Use full paths to executables (e.g., `/bin/systemctl` not `systemctl`)
- Restrict file paths where possible
- Regularly review and audit sudo privileges
- Consider using a dedicated deployment user with limited system access

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

### 5. Create systemd Service for Backend

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/pdfmerger.service
```

Add the following content:

```ini
[Unit]
Description=PDF Editor Backend API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/home/pdfmerger/pdf-editor/backend
Environment="PATH=/home/pdfmerger/pdf-editor/backend/venv/bin"
ExecStart=/home/pdfmerger/pdf-editor/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pdfmerger
```

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

1. **Stop Backend Service**: Stops the running backend service
2. **Backup Existing Files**: Creates timestamped backups of current backend and frontend
3. **Copy New Files**: Copies new backend and frontend files to deployment directory
4. **Set Permissions**: Sets proper ownership and permissions
5. **Install Dependencies**: Updates Python virtual environment with new dependencies
6. **Deploy Frontend**: Copies built frontend files to Apache web directory
7. **Restart Services**: Restarts backend and Apache services
8. **Verify Services**: Checks that services are running correctly

## Troubleshooting

### Sudo Password Errors

If you see errors like:
```
sudo: a terminal is required to read the password
```

This means passwordless sudo is not configured correctly. Review the "Configure Passwordless Sudo" section above.

### Service Fails to Start

Check service logs:

```bash
# Backend service logs
sudo journalctl -u pdfmerger -n 50

# Apache logs
sudo journalctl -u apache2 -n 50
sudo tail -f /var/log/apache2/error.log
```

### Permission Denied Errors

Ensure proper ownership and permissions:

```bash
# For deployment directory
sudo chown -R pdfmerger:pdfmerger /home/pdfmerger/pdf-editor

# For web directory
sudo chown -R www-data:www-data /var/www/pdf.malahieude.net
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
2. **Limit Sudo Access**: Only grant passwordless sudo for specific commands
3. **Regular Updates**: Keep server software up to date
4. **Monitor Logs**: Regularly review deployment and application logs
5. **Backup Strategy**: Maintain regular backups of application data
6. **SSL/TLS**: Always use HTTPS in production
7. **Firewall**: Configure firewall to only allow necessary ports

## Monitoring

### Health Check Endpoints

- Frontend: `https://pdf.malahieude.net`
- Backend: `https://pdf-api.malahieude.net`
- API Docs: `https://pdf-api.malahieude.net/docs`

### Service Status

Check service status:

```bash
# Backend service
sudo systemctl status pdfmerger

# Apache service
sudo systemctl status apache2
```

## Rollback Procedure

If a deployment fails, you can rollback to the previous version:

```bash
# Stop services
sudo systemctl stop pdfmerger

# Restore from backup (use the latest timestamp)
cd /home/pdfmerger/pdf-editor
sudo rm -rf backend frontend
sudo mv backend_backup_YYYYMMDD_HHMMSS backend
sudo mv frontend_backup_YYYYMMDD_HHMMSS frontend

# Restore frontend to Apache
sudo rm -rf /var/www/pdf.malahieude.net/frontend/*
sudo cp -r /home/pdfmerger/pdf-editor/frontend/build/* /var/www/pdf.malahieude.net/frontend/

# Restart services
sudo systemctl start pdfmerger
sudo systemctl restart apache2
```

## Support

For issues or questions:
- Check the logs first
- Review this deployment guide
- Open an issue on the GitHub repository
