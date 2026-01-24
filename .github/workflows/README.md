# GitHub Actions Deployment

This directory contains the GitHub Actions workflow for automated deployment.

## Workflow: Deploy to Server

The `deploy.yml` workflow automatically deploys the PDF Editor application to a remote server whenever code is pushed to the `master` branch.

### How It Works

1. **Triggers**: Automatically runs on push to `master` branch
2. **Builds**: Creates Docker images for both backend and frontend
3. **Transfers**: Securely copies images to the remote server via SSH
4. **Deploys**: Loads images and starts containers on the server

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

5. **Server Prerequisites**
   - Docker and Docker Compose must be installed on the deployment server
   - The deployment user must have permission to run Docker commands
   - Directory `/opt/pdf-editor` will be created for the application

### Deployment Process

When you push to `master`, the workflow will:

1. Check out the code
2. Build Docker images using docker-compose
3. Save the built images as tar files
4. Transfer images and docker-compose.yml to the server via SCP
5. SSH into the server and:
   - Load the Docker images
   - Stop any existing containers
   - Start the new containers
   - Clean up temporary files
   - Display container status

### Troubleshooting

**SSH Connection Issues**
- Verify `SSH_HOST` and `SSH_USER` are correct
- Ensure the private key matches the public key on the server
- Check that the server allows SSH connections from GitHub Actions IPs

**Docker Issues on Server**
- Ensure Docker is installed: `docker --version`
- Ensure Docker Compose is installed: `docker-compose --version`
- Verify the user has Docker permissions: `docker ps`

**Build Failures**
- Check the workflow logs in GitHub Actions tab
- Verify docker-compose.yml is valid
- Ensure all dependencies are properly specified

### Security Notes

- The SSH private key is stored securely in GitHub Secrets and never exposed in logs
- The key is removed from the runner after deployment
- Use a dedicated deployment key with minimal permissions
- Consider setting up a dedicated deployment user on your server
- Review firewall rules to ensure proper access control

### Customization

To deploy to a different directory on the server, modify the `Deploy on server` step in `deploy.yml`:

```yaml
mkdir -p /your/custom/path && cd /your/custom/path
```

To deploy to a different branch, modify the `on.push.branches` section:

```yaml
on:
  push:
    branches:
      - main  # or your preferred branch
```
