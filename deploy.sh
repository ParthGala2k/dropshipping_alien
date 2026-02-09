#!/bin/bash

# Build the application
echo "Building application..."
npm run build

# Create a deployment directory
echo "Creating deployment directory..."
mkdir -p deploy
cp -r client/dist/* deploy/

# Create a simple server for GitHub Pages
echo "Creating server configuration..."
cat > deploy/_redirects << 'EOF'
/*    /index.html   200
EOF

echo "Deployment files ready in deploy/ directory"
echo "To deploy to GitHub Pages:"
echo "1. Push to main branch"
echo "2. Go to repository settings"
echo "3. Enable GitHub Pages from /docs folder"
echo "4. Copy deploy/ contents to docs/ folder"