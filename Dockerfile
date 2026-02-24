# === LinkEver Dockerfile ===
# This Dockerfile bundles Node.js, Python, yt-dlp, and FFmpeg
# Standard environment for Render, Railway, or Fly.io

# Use Node.js as base
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (required by yt-dlp for signature decryption)
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
RUN cp /root/.deno/bin/deno /usr/local/bin/deno

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy Python requirements and install
COPY python/requirements.txt ./python/
RUN pip3 install --no-cache-dir -r python/requirements.txt --break-system-packages || \
    pip3 install --no-cache-dir -r python/requirements.txt

# Copy the rest of the application
COPY . .

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
