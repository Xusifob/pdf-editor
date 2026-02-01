#!/bin/bash
# Quick setup script for the pdfmerger systemd user service
# Run this script as the deployment user (e.g., pdfmerger)

set -e

# Configuration
DEPLOY_PATH="${DEPLOY_PATH:-/home/pdfmerger/pdf-editor}"
SERVICE_NAME="pdfmerger"

echo "=== PDF Editor Backend Service Setup ==="
echo "Deployment path: $DEPLOY_PATH"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "Error: Do not run this script as root!"
  echo "Run as the deployment user instead."
  exit 1
fi

# Check if deployment path exists
if [ ! -d "$DEPLOY_PATH/backend" ]; then
  echo "Error: Backend directory not found at $DEPLOY_PATH/backend"
  echo "Please ensure the application has been deployed first."
  exit 1
fi

# Create systemd user directory
echo "Creating systemd user directory..."
mkdir -p ~/.config/systemd/user

# Create service file
echo "Creating service file..."
cat > ~/.config/systemd/user/$SERVICE_NAME.service << EOF
[Unit]
Description=PDF Editor Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=$DEPLOY_PATH/backend
Environment="PATH=$DEPLOY_PATH/backend/venv/bin"
ExecStart=$DEPLOY_PATH/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

echo "✓ Service file created at ~/.config/systemd/user/$SERVICE_NAME.service"

# Reload systemd
echo ""
echo "Reloading systemd daemon..."
systemctl --user daemon-reload

# Enable service
echo "Enabling service..."
systemctl --user enable $SERVICE_NAME

# Start service
echo "Starting service..."
systemctl --user start $SERVICE_NAME

# Wait a moment for service to start
sleep 2

# Check status
echo ""
echo "Checking service status..."
if systemctl --user is-active --quiet $SERVICE_NAME; then
  echo "✓ Service is running successfully!"
  systemctl --user status $SERVICE_NAME --no-pager
else
  echo "✗ Service failed to start. Check logs with:"
  echo "   journalctl --user -u $SERVICE_NAME -n 50"
  systemctl --user status $SERVICE_NAME --no-pager || true
  exit 1
fi

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Enable linger to keep service running after logout:"
echo "   sudo loginctl enable-linger \$USER"
echo ""
echo "2. Verify service persists after logout:"
echo "   loginctl show-user \$USER | grep Linger"
echo ""
echo "3. Check service status:"
echo "   systemctl --user status $SERVICE_NAME"
echo ""
echo "4. View service logs:"
echo "   journalctl --user -u $SERVICE_NAME -f"
echo ""
echo "✓ Setup completed successfully!"
