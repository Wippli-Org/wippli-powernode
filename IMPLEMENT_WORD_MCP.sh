#!/bin/bash
# Complete Word MCP Implementation Script
set -e

echo "=== Completing Word MCP Implementation ==="

# Update Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Install Python and build dependencies for Word MCP
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    gcc \
    musl-dev \
    libffi-dev

# Copy the pre-built standalone output
COPY ./build ./

# Install PM2 for process management
RUN npm install -g pm2

# Install Python MCP dependencies (only if directory exists)
COPY mcp-servers/word/requirements.txt /app/mcp-servers/word/requirements.txt 2>/dev/null || true
RUN if [ -f /app/mcp-servers/word/requirements.txt ]; then \
      pip3 install --break-system-packages --no-cache-dir -r /app/mcp-servers/word/requirements.txt; \
    fi

# Copy Python MCP server
COPY mcp-servers /app/mcp-servers 2>/dev/null || true

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pm2-runtime", "start", "server.js"]
EOF
echo "✓ Updated Dockerfile"

# Update .gitignore
cat >> .gitignore << 'EOF'

# Python (Word MCP)
mcp-servers/**/__pycache__/
mcp-servers/**/*.pyc
mcp-servers/**/*.pyo
mcp-servers/**/.Python
*.py[cod]
EOF
echo "✓ Updated .gitignore"

# Make server.py executable
chmod +x mcp-servers/word/server.py
echo "✓ Made server.py executable"

echo ""
echo "=== Implementation Complete! ==="
echo "Files created:"
echo "  ✓ mcp-servers/word/requirements.txt"
echo "  ✓ mcp-servers/word/server.py"
echo "  ✓ mcp-servers/word/tools/__init__.py"
echo "  ✓ pages/api/mcp-server/word.ts"
echo "  ✓ Dockerfile (updated)"
echo "  ✓ .gitignore (updated)"
echo ""
echo "Next step: git add, commit and push"
