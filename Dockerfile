FROM node:20-alpine

WORKDIR /app

# Copy the pre-built standalone output
COPY ./build ./

# Install PM2 for process management
RUN npm install -g pm2

ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# server.js is created by next build from the standalone output
CMD ["pm2-runtime", "start", "server.js"]
