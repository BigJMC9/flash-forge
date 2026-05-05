[CmdletBinding()]
param(
  [switch]$SkipNpm,
  [switch]$SkipPython,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Get-CommandPath {
  param([string]$Name)
  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $Command) {
    return $null
  }
  return $Command.Source
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }
}

function Assert-Node {
  $NodePath = Get-CommandPath "node"
  if (-not $NodePath) {
    throw "Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/ and rerun this script."
  }

  $NpmPath = Get-CommandPath "npm"
  if (-not $NpmPath) {
    throw "npm was not found. Reinstall Node.js 20 or newer from https://nodejs.org/ and rerun this script."
  }

  $NodeVersion = (& node --version).Trim()
  if ($NodeVersion -notmatch "^v(?<major>\d+)") {
    throw "Unable to parse Node.js version: $NodeVersion"
  }

  $NodeMajor = [int]$Matches["major"]
  if ($NodeMajor -lt 20) {
    throw "Node.js $NodeVersion is installed, but this app expects Node.js 20 or newer."
  }

  Write-Host "Node: $NodeVersion"
  Write-Host "npm:  $((& npm --version).Trim())"
}

function Test-PythonCandidate {
  param(
    [string]$FilePath,
    [string[]]$BaseArguments,
    [string]$Label
  )

  if (-not $FilePath) {
    return $null
  }

  $VersionScript = "import sys; print('{}.{}.{}'.format(*sys.version_info[:3])); sys.exit(0 if sys.version_info >= (3, 10) else 1)"
  $Arguments = @()
  $Arguments += $BaseArguments
  $Arguments += @("-c", $VersionScript)

  try {
    $Version = (& $FilePath @Arguments 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and $Version) {
      return @{
        File = $FilePath
        Args = $BaseArguments
        Label = $Label
        Version = $Version
      }
    }
  } catch {
    return $null
  }

  return $null
}

function Get-PythonCommand {
  $Candidates = @(
    @{ File = (Get-CommandPath "py"); Args = @("-3"); Label = "py -3" },
    @{ File = (Get-CommandPath "python"); Args = @(); Label = "python" },
    @{ File = (Get-CommandPath "python3"); Args = @(); Label = "python3" }
  )

  foreach ($Candidate in $Candidates) {
    $Result = Test-PythonCandidate `
      -FilePath $Candidate["File"] `
      -BaseArguments $Candidate["Args"] `
      -Label $Candidate["Label"]
    if ($null -ne $Result) {
      return $Result
    }
  }

  throw "Python 3.10 or newer was not found. Install Python from https://www.python.org/downloads/ and rerun this script."
}

function Invoke-Python {
  param(
    [hashtable]$Python,
    [string[]]$Arguments
  )

  $AllArguments = @()
  $AllArguments += $Python["Args"]
  $AllArguments += $Arguments

  & $Python["File"] @AllArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Python command failed: $($Python["Label"]) $($Arguments -join ' ')"
  }
}

Write-Step "Checking system prerequisites"
Assert-Node
$Python = Get-PythonCommand
Write-Host "Python: $($Python["Version"]) via $($Python["Label"])"

Write-Step "Preparing local environment file"
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
} else {
  Write-Host "Keeping existing .env"
}

Write-Step "Creating workspace folders"
$WorkspaceDirs = @(
  "anki_workspace",
  "anki_workspace\collections",
  "anki_workspace\exports",
  "anki_workspace\media",
  "anki_workspace\tmp"
)
foreach ($Dir in $WorkspaceDirs) {
  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
}

if (-not $SkipPython) {
  Write-Step "Setting up Python virtual environment"
  $VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

  if (-not (Test-Path $VenvPython)) {
    Invoke-Python $Python @("-m", "venv", ".venv")
  } else {
    Write-Host "Reusing existing .venv"
  }

  Invoke-Checked $VenvPython @("-m", "pip", "install", "--upgrade", "pip")
  Invoke-Checked $VenvPython @("-m", "pip", "install", "-r", "python_sidecar\requirements.txt")

  Write-Step "Checking Python sidecar"
  Invoke-Checked $VenvPython @("python_sidecar\main.py", "--ping")
}

if (-not $SkipNpm) {
  Write-Step "Installing Node dependencies"
  if (Test-Path "package-lock.json") {
    Invoke-Checked "npm" @("ci")
  } else {
    Invoke-Checked "npm" @("install")
  }
}

if (-not $SkipBuild) {
  Write-Step "Running production build smoke check"
  Invoke-Checked "npm" @("run", "build")
}

Write-Step "Setup complete"
Write-Host "Run npm run dev to start the development server."
Write-Host "Set OPENAI_API_KEY in .env before using AI features."
