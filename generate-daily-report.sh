#!/bin/bash

set -e

echo "=== BuilderPulse Daily Report Generator ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Check if running in correct directory
if [ ! -f "scripts/fetch-data.js" ]; then
  echo "ERROR: fetch-data.js not found. Run from project root."
  exit 1
fi

# Step 1: Fetch data with error handling
echo "Step 1/3: Fetching data from multiple sources..."
if ! node scripts/fetch-data.js; then
  echo "WARNING: Data fetching encountered errors (some sources may be unavailable)"
fi

# Verify data was saved
if [ ! -f "data/raw-data.json" ]; then
  echo "ERROR: No data file generated. Check fetch errors above."
  exit 1
fi

# Step 2: Generate reports with error handling
echo ""
echo "Step 2/3: Generating bilingual reports..."
if ! node scripts/generate-report.js; then
  echo "ERROR: Report generation failed."
  exit 1
fi

# Verify reports were created
TODAY=$(date +%Y-%m-%d)
if [ ! -f "en/2026/${TODAY}.md" ] || [ ! -f "zh/2026/${TODAY}.md" ]; then
  echo "ERROR: Report files not generated."
  exit 1
fi

# Step 3: Git operations (optional - use --no-git flag to skip)
SKIP_GIT="${1:-}"

if [ "$SKIP_GIT" = "--no-git" ]; then
  echo ""
  echo "Step 3/3: Skipped (git operations disabled)"
else
  echo ""
  echo "Step 3/3: Committing to git..."
  
  # Check if there are changes to commit
  git diff --quiet HEAD || {
    git add "en/2026/${TODAY}.md" "zh/2026/${TODAY}.md" data/raw-data.json
    git commit -m "Daily: ${TODAY} - multi-source data"
    
    # Push with retry on SSL errors
    git push origin main 2>/dev/null || {
      echo "Push failed, retrying with HTTP/1.1..."
      git config --global http.version http/1.1
      git push origin main
    }
  } || echo "No changes to commit."
fi

echo ""
echo "=== Done! ==="
echo "Reports saved to:"
echo "  en/2026/${TODAY}.md"
echo "  zh/2026/${TODAY}.md"