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

# Copy Python MCP server files (if they exist)
COPY mcp-servers /app/mcp-servers

# Install Python MCP dependencies
RUN if [ -f /app/mcp-servers/word/requirements.txt ]; then \
      pip3 install --break-system-packages --no-cache-dir -r /app/mcp-servers/word/requirements.txt; \
    fi

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pm2-runtime", "start", "server.js"]
