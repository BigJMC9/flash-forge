# Flash Forge

Flash Forge is a Vite/React app with a Node server and a Python sidecar for Anki deck and Japanese dictionary workflows.

## Fresh Machine Setup

Install these system prerequisites first:

- Node.js 20 or newer
- Python 3.10 or newer

Then run the setup script from the repository root.

Windows:

```bat
.\setup.cmd
```

macOS/Linux:

```bash
bash ./setup.sh
```

The setup script installs npm dependencies, creates `.venv`, installs Python sidecar dependencies, creates `.env` from `.env.example` when needed, creates the local `anki_workspace` folders, pings the sidecar, and runs a production build smoke check. Windows users can also run `.\setup.ps1` directly from PowerShell if they prefer.

After setup, edit `.env` and set `OPENAI_API_KEY` if you want AI, OCR, reading, or conversation generation features.

## Running Locally

```bash
npm run dev
```

The Node bridge automatically uses the repo-local Python virtual environment when `.venv` exists.

## Production Build

```bash
npm run build
npm start
```

## Docker

```bash
docker compose up --build
```

For AI features with Docker, provide `OPENAI_API_KEY` in your shell or local `.env`.
