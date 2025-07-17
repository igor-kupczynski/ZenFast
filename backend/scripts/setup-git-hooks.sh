#!/bin/bash
set -euo pipefail

# Script to set up git pre-commit hooks for code quality

echo "Setting up git pre-commit hooks..."

# Create the pre-commit hook
cat > ../.git/hooks/pre-commit << 'EOF'
#!/bin/bash
set -euo pipefail

echo "Running pre-commit checks..."

# Change to backend directory
cd backend

# Run type checking
echo "Running TypeScript type check..."
if ! npm run typecheck; then
    echo "❌ TypeScript type check failed!"
    exit 1
fi

# Run linting
echo "Running ESLint..."
if ! npm run lint; then
    echo "❌ ESLint check failed!"
    exit 1
fi

# Check formatting
echo "Checking code formatting..."
if ! npm run format:check; then
    echo "❌ Code formatting check failed!"
    echo "Run 'npm run format' to fix formatting issues."
    exit 1
fi

# Check for wrangler.toml
if [ -f "wrangler.toml" ]; then
    # Check if wrangler.toml is staged
    if git diff --cached --name-only | grep -q "backend/wrangler.toml"; then
        echo "❌ ERROR: wrangler.toml should not be committed!"
        echo "This file contains sensitive resource IDs."
        exit 1
    fi
fi

echo "✅ All pre-commit checks passed!"
EOF

# Make the hook executable
chmod +x ../.git/hooks/pre-commit

echo "✅ Git pre-commit hooks installed successfully!"
echo ""
echo "The pre-commit hook will run automatically before each commit to ensure:"
echo "  - TypeScript types are correct"
echo "  - ESLint rules are followed"
echo "  - Code is properly formatted"
echo "  - wrangler.toml is not accidentally committed"
echo ""
echo "To skip hooks temporarily (not recommended), use: git commit --no-verify"