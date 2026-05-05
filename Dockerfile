FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1
ENV ANKI_APP_DIR=/app/anki_workspace
ENV VIRTUAL_ENV=/opt/venv
ENV PYTHON=/opt/venv/bin/python
ENV PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && python3 -m venv "$VIRTUAL_ENV" \
  && "$PYTHON" -m pip install --upgrade pip \
  && rm -rf /var/lib/apt/lists/*

COPY python_sidecar/requirements.txt /app/python_sidecar/requirements.txt
RUN "$PYTHON" -m pip install --no-cache-dir -r /app/python_sidecar/requirements.txt

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/public /app/public
COPY --from=builder /app/server /app/server
COPY --from=builder /app/AnkiDeckBuilder /app/AnkiDeckBuilder
COPY --from=builder /app/python_sidecar /app/python_sidecar

RUN mkdir -p /app/anki_workspace

EXPOSE 3000

CMD ["node", "server/index.mjs"]
