# Deploy Schema Comparison to a New Netlify Site

This guide will help you deploy the schema comparison feature to a **NEW** Netlify site without affecting your existing running project.

## ✅ You're Already on a Separate Branch!

**Good news:** You're currently on `feat/schema-comparison` branch, which is **already separate** from your main/production branch. This means:
- ✅ Your existing Netlify site uses a different branch (likely `main` or `deploy-working-version`)
- ✅ This new branch won't affect your existing site
- ✅ When you deploy, you'll create a **NEW** Netlify site (not update the existing one)
- ✅ Both sites will run independently and safely

**You don't need to create another branch - you're already set up correctly!** 🎉

## Prerequisites

1. You have a Netlify account
2. Your code is pushed to GitHub
3. You have access to your GitHub repository: `https://github.com/PragyaTripathi990/finfactorAA.git`

## Step 0: Prepare Your Branch (IMPORTANT - Do This First!)

Before deploying, you need to commit and push all your changes to the `feat/schema-comparison` branch.

### Option A: Use the Preparation Script (Recommended)

```bash
cd /Users/pragyatripathi/Desktop/HandaUncle/NfinvuHU
./PREPARE_FOR_DEPLOYMENT.sh
```

This script will:
- Check you're on the correct branch
- Stage all schema comparison files
- Commit all changes
- Push to remote repository

### Option B: Manual Steps

```bash
# 1. Make sure you're on the correct branch
git checkout feat/schema-comparison

# 2. Add all schema comparison files
git add app/schema-comparison/
git add app/api/schema-comparison/
git add lib/schema-comparison.ts
git add lib/rebit-schema-parser.ts
git add lib/finfactor-api-extractor.ts

# 3. Commit
git commit -m "feat: Complete schema comparison feature"

# 4. Push to remote
git push origin feat/schema-comparison
```

**✅ Once your branch is pushed, proceed to Step 1 below.**

## Step-by-Step Deployment Guide

### Option 1: Deploy via Netlify Dashboard (Recommended - Safest)

#### Step 1: Create a New Netlify Site

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com
   - Log in to your account

2. **Add New Site**
   - Click **"Add new site"** button (top right)
   - Select **"Import an existing project"**
   - Choose **"Deploy with GitHub"** (or GitLab/Bitbucket if you use those)

3. **Authorize Netlify** (if first time)
   - Grant Netlify access to your GitHub repositories
   - You can grant access to all repos or just this specific one

4. **Select Repository**
   - Search for: `finfactorAA` or `PragyaTripathi990/finfactorAA`
   - Click on your repository

5. **Configure Build Settings**
   - **Branch to deploy:** Select `feat/schema-comparison` (or `main` if you've merged)
   - **Base directory:** Leave empty (or `./` if required)
   - **Build command:** `npm run build`
   - **Publish directory:** `.next` (for Next.js)

6. **Set Environment Variables** (if needed)
   - Click **"Show advanced"** → **"New variable"**
   - Add any required environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL` (if needed)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (if needed)
     - Any other API keys or secrets

7. **Deploy**
   - Click **"Deploy site"**
   - Wait for the build to complete (usually 2-5 minutes)

#### Step 2: Verify Deployment

1. Once deployment completes, Netlify will provide a URL like:
   - `https://random-name-12345.netlify.app`
   - Or you can set a custom domain

2. **Test the Schema Comparison Page**
   - Visit: `https://your-site.netlify.app/schema-comparison`
   - Verify all features work correctly

### Option 2: Deploy via Netlify CLI (Alternative)

#### Step 1: Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### Step 2: Login to Netlify

```bash
netlify login
```

This will open a browser window for authentication.

#### Step 3: Initialize New Site

```bash
cd /Users/pragyatripathi/Desktop/HandaUncle/NfinvuHU
netlify init
```

When prompted:
- **Create & configure a new site:** Yes
- **Team:** Select your team
- **Site name:** Enter a unique name (e.g., `finfactor-schema-comparison`)
- **Build command:** `npm run build`
- **Directory to deploy:** `.next`

#### Step 4: Deploy

```bash
# Make sure you're on the correct branch
git checkout feat/schema-comparison

# Deploy
netlify deploy --prod
```

### Option 3: Deploy via GitHub Actions (Most Automated)

Create a workflow file that deploys to a new Netlify site:

1. **Create `.github/workflows/deploy-schema-comparison.yml`:**

```yaml
name: Deploy Schema Comparison to Netlify

on:
  push:
    branches:
      - feat/schema-comparison
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --dir=.next --prod
          secrets: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        env:
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID_SCHEMA_COMPARISON }}
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

2. **Get Netlify Auth Token:**
   - Go to: https://app.netlify.com/user/applications
   - Click **"New access token"**
   - Copy the token

3. **Add Secrets to GitHub:**
   - Go to your repo → **Settings** → **Secrets and variables** → **Actions**
   - Add:
     - `NETLIFY_AUTH_TOKEN`: Your Netlify auth token
     - `NETLIFY_SITE_ID_SCHEMA_COMPARISON`: Your new Netlify site ID

## Important: Keeping Your Existing Site Safe

### ✅ What This Does:
- Creates a **completely separate** Netlify site
- Uses a **different branch** (`feat/schema-comparison`)
- Has its **own URL** and deployment history
- **Does NOT affect** your existing production site

### ✅ Your Existing Site:
- Remains **unchanged** and **untouched**
- Continues running on its current URL
- Uses its current branch (likely `main` or `deploy-working-version`)
- All existing deployments remain intact

## Post-Deployment Checklist

- [ ] Schema comparison page loads correctly
- [ ] All filters work (Layer A, B, C, Common, FinFactor Only, REBIT Only)
- [ ] Search functionality works
- [ ] FI Type filter works
- [ ] Data loads from API correctly
- [ ] No console errors
- [ ] Mobile responsive (if needed)

## Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Verify all dependencies are in `package.json`
- Ensure Node.js version is compatible (Netlify uses Node 18+ by default)

### Environment Variables Missing
- Add them in Netlify dashboard: **Site settings** → **Environment variables**

### API Calls Failing
- Check CORS settings
- Verify API endpoints are accessible
- Check network tab in browser console

## Quick Deploy Script

I've created a helper script. Run this after setting up the new Netlify site:

```bash
# Make sure you're on the correct branch
git checkout feat/schema-comparison

# Push latest changes
git push origin feat/schema-comparison

# The new Netlify site will auto-deploy from this branch
```

## Need Help?

If you encounter issues:
1. Check Netlify build logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure the branch is correct

---

**Remember:** This creates a **NEW** Netlify site. Your existing site remains completely safe and unchanged! 🎉

