#!/bin/bash

# Script to deploy schema comparison to a NEW Netlify site
# This ensures your existing Netlify site remains untouched

echo "🚀 Deploying Schema Comparison to NEW Netlify Site"
echo "=================================================="
echo ""

# Check if we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feat/schema-comparison" ]; then
    echo "⚠️  Warning: You're not on 'feat/schema-comparison' branch"
    read -p "Do you want to switch to 'feat/schema-comparison'? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout feat/schema-comparison
    else
        echo "❌ Deployment cancelled. Please switch to 'feat/schema-comparison' branch first."
        exit 1
    fi
fi

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes:"
    git status --short
    read -p "Do you want to commit these changes before deploying? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "feat: Schema comparison improvements - ready for deployment"
    fi
fi

# Push to remote
echo ""
echo "📤 Pushing to remote repository..."
git push origin feat/schema-comparison

echo ""
echo "✅ Code pushed successfully!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Go to Netlify Dashboard: https://app.netlify.com"
echo "2. Click 'Add new site' → 'Import an existing project'"
echo "3. Select 'Deploy with GitHub'"
echo "4. Choose repository: finfactorAA"
echo "5. Configure build settings:"
echo "   - Branch: feat/schema-comparison"
echo "   - Build command: npm run build"
echo "   - Publish directory: .next"
echo "6. Add environment variables if needed"
echo "7. Click 'Deploy site'"
echo ""
echo "✨ Your existing Netlify site will remain completely untouched!"
echo ""
echo "🔗 After deployment, your new site will be available at:"
echo "   https://your-new-site-name.netlify.app/schema-comparison"
echo ""

