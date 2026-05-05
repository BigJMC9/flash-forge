#!/usr/bin/env bash
set -euo pipefail

skip_npm=0
skip_python=0
skip_build=0

for arg in "$@"; do
  case "$arg" in
    --skip-npm)
      skip_npm=1
      ;;
    --skip-python)
      skip_python=1
      ;;
    --skip-build)
      skip_build=1
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: bash ./setup.sh [--skip-npm] [--skip-python] [--skip-build]" >&2
      exit 2
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

step() {
  printf "\n==> %s\n" "$1"
}

require_command() {
  local name="$1"
  local message="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "$message" >&2
    exit 1
  fi
}

find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >/dev/null 2>&1; then
        printf "%s" "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

step "Checking system prerequisites"
require_command "node" "Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/ and rerun this script."
require_command "npm" "npm was not found. Reinstall Node.js 20 or newer from https://nodejs.org/ and rerun this script."

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js $(node --version) is installed, but this app expects Node.js 20 or newer." >&2
  exit 1
fi

python_cmd="$(find_python || true)"
if [ -z "$python_cmd" ]; then
  echo "Python 3.10 or newer was not found. Install Python from https://www.python.org/downloads/ and rerun this script." >&2
  exit 1
fi

echo "Node: $(node --version)"
echo "npm:  $(npm --version)"
echo "Python: $($python_cmd -c "import sys; print('{}.{}.{}'.format(*sys.version_info[:3]))") via $python_cmd"

step "Preparing local environment file"
if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
  echo "Created .env from .env.example"
else
  echo "Keeping existing .env"
fi

step "Creating workspace folders"
mkdir -p \
  anki_workspace \
  anki_workspace/collections \
  anki_workspace/exports \
  anki_workspace/media \
  anki_workspace/tmp

if [ "$skip_python" -eq 0 ]; then
  step "Setting up Python virtual environment"
  if [ ! -x ".venv/bin/python" ]; then
    "$python_cmd" -m venv .venv
  else
    echo "Reusing existing .venv"
  fi

  venv_python=".venv/bin/python"
  "$venv_python" -m pip install --upgrade pip
  "$venv_python" -m pip install -r python_sidecar/requirements.txt

  step "Checking Python sidecar"
  "$venv_python" python_sidecar/main.py --ping
fi

if [ "$skip_npm" -eq 0 ]; then
  step "Installing Node dependencies"
  if [ -f "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi
fi

if [ "$skip_build" -eq 0 ]; then
  step "Running production build smoke check"
  npm run build
fi

step "Setup complete"
echo "Run npm run dev to start the development server."
echo "Set OPENAI_API_KEY in .env before using AI features."
