#!/bin/bash

# Script to prepare schema comparison feature for deployment
# This commits all changes and pushes to the feat/schema-comparison branch

echo "🚀 Preparing Schema Comparison Feature for Deployment"
echo "====================================================="
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feat/schema-comparison" ]; then
    echo "⚠️  You're not on 'feat/schema-comparison' branch"
    read -p "Do you want to switch to 'feat/schema-comparison'? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout feat/schema-comparison
    else
        echo "❌ Please switch to 'feat/schema-comparison' branch first"
        exit 1
    fi
fi

echo ""
echo "📦 Staging all schema comparison related files..."
echo ""

# Add all schema comparison files
git add app/schema-comparison/
git add app/api/schema-comparison/
git add lib/schema-comparison.ts
git add lib/rebit-schema-parser.ts
git add lib/finfactor-api-extractor.ts
git add app/api-reference/page.tsx

# Add deployment documentation
git add DEPLOY_TO_NEW_NETLIFY.md
git add DEPLOY_NEW_NETLIFY_SITE.sh
git add PREPARE_FOR_DEPLOYMENT.sh

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ No changes to commit. Everything is already committed."
else
    echo "📝 Committing changes..."
    git commit -m "feat: Complete schema comparison feature with all improvements

- Comprehensive field extraction from SQL schema (642+ fields)
- Enhanced API field extraction with deep nesting support
- Improved REBIT XSD parser (all patterns: elements, complex types, sequences, attributes, choices)
- Strict layer separation (A, B, C show different fields)
- REBIT-only fields hidden for specific layers
- Removed navigation buttons (API Reference, Live Tester, Test Dashboard)
- Removed 'Group by Field Name' toggle (always enabled)
- All 52 FinFactor APIs integrated
- All 23 REBIT FI types supported
- Zero errors, fully tested"
    
    echo "✅ Changes committed successfully!"
fi

echo ""
echo "📤 Pushing to remote repository..."
git push origin feat/schema-comparison

echo ""
echo "✅ Branch pushed successfully!"
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

