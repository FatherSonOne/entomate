# Entomate meeting bot image
# ==========================
# Headless Chromium + PulseAudio, driven by Puppeteer. One container per
# meeting session, launched by backend/services/botOrchestrator.js against the
# Fly.io Machines API.
#
# P1.1 scope: ship the container surface + entrypoint skeleton. P1.2 fills in
# the Google Meet join + loopback audio capture inside src/index.js.

FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      chromium-common \
      chromium-sandbox \
      dbus-x11 \
      fonts-liberation \
      fonts-noto-color-emoji \
      pulseaudio \
      pulseaudio-utils \
      xvfb \
      ca-certificates \
      tini \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --loglevel=warn || npm install --omit=dev --loglevel=warn

COPY src ./src

RUN useradd -m -u 1001 botuser \
 && mkdir -p /home/botuser/.config/pulse /tmp/bot-audio \
 && chown -R botuser:botuser /app /home/botuser /tmp/bot-audio

USER botuser

ENV BOT_HEADLESS=true \
    BOT_AUDIO_DIR=/tmp/bot-audio

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
