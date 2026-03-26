FROM oven/bun:1

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json bun.lock ./
RUN bun install

COPY server/package.json server/bun.lock ./server/
WORKDIR /app/server
RUN bun install

WORKDIR /app

# Copy the rest of the application
COPY . .

# Override config.json to ensure server binds to all interfaces
COPY config.json ./config.json.original
RUN echo '{"SERVER_HOST": "0.0.0.0", "SERVER_PORT": 58951, "SERVER_URL": "http://localhost:58951"}' > config.json

# Build the React application
RUN bun run build

# Expose the port the server runs on
EXPOSE 58951

# Start the application (server only, not client)
CMD ["bun", "run", "start"]
