# This script sets up the environment for a Node.js project by installing dependencies and setting up environment variables.
# chmod +x setup.sh
if [ -f .env ]; then
  NPM_TOKEN=$(grep '^NPM_TOKEN=' .env | cut -d '=' -f2 | xargs)
  if [ -n "$NPM_TOKEN" ]; then
    export NPM_TOKEN
    echo "NPM_TOKEN has been set from .env"
  else
    echo "NPM_TOKEN is empty or malformed in .env file."
    exit 1
  fi
else
  echo ".env file not found. Please create one with NPM_TOKEN."
  exit 2
fi