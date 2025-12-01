---
description: Deploy the application to Azure Static Web Apps
---

# Deploy to Azure Static Web Apps

This workflow guides you through deploying your Vite React application to Azure Static Web Apps.

## Prerequisites
- An Azure account (Free tier is available)
- A GitHub account

## Step 1: Initialize Git Repository
Since your project is not yet a git repository, initialize it:

```bash
git init
git add .
git commit -m "Initial commit"
```

## Step 2: Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new).
2. Follow the instructions to push your existing repository:

```bash
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Step 3: Create Azure Static Web App
1. Go to the [Azure Portal](https://portal.azure.com).
2. Search for **Static Web Apps** and click **Create**.
3. **Basics Tab**:
   - **Subscription**: Select your subscription.
   - **Resource Group**: Create new or select existing.
   - **Name**: Enter a name for your app (e.g., `anns-shop`).
   - **Plan type**: Free (for hobby/personal projects).
   - **Deployment details**: Select **GitHub**.
   - **Authorize**: Click to sign in with GitHub.
   - **Organization/Repository/Branch**: Select the repo you just created.
4. **Build Details**:
   - **Build Presets**: Select **React**.
   - **App location**: `/`
   - **Api location**: (Leave empty)
   - **Output location**: `dist` (Vite's default output)
5. Click **Review + create** -> **Create**.

## Step 4: Verify Deployment
1. Once the resource is created, go to the resource.
2. Click on the **URL** provided in the Overview.
3. GitHub Actions will automatically build and deploy your site. It might take a minute or two for the first run.

## Alternative: Using Azure CLI (SWA CLI)
If you prefer command line:
1. Install SWA CLI: `npm install -g @azure/static-web-apps-cli`
2. Login: `swa login`
3. Deploy: `swa deploy` (Follow the prompts, set output location to `dist`)
