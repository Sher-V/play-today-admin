# Deployment Guide - Google Cloud

This guide will help you deploy your Tennis Court Booking Admin App to Google Cloud with your custom domain.

## Option 1: Firebase Hosting (Recommended)

Firebase Hosting is the easiest way to deploy a static React app to Google Cloud with custom domain support.

### Prerequisites

1. A Google Cloud account
2. Firebase CLI installed: `npm install -g firebase-tools`
3. Your custom domain ready

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Firebase Project

```bash
firebase init hosting
```

When prompted:
- Select "Use an existing project" or "Create a new project"
- Set public directory to: `build`
- Configure as single-page app: `Yes`
- Set up automatic builds: `No` (or `Yes` if using GitHub Actions)

### Step 4: Update .firebaserc

Edit `.firebaserc` and replace `your-project-id` with your actual Firebase project ID.

### Step 5: Build Your App

```bash
npm run build
```

### Step 6: Deploy

```bash
firebase deploy --only hosting
```

### Step 7: Connect Custom Domain

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Hosting → Add custom domain
4. Enter your domain name
5. Follow the DNS configuration instructions:
   - Add the A records provided by Firebase
   - Or add a CNAME record pointing to Firebase
6. Wait for SSL certificate provisioning (usually 5-10 minutes)

Your app will be available at your custom domain!

---

## Option 2: Cloud Storage + Cloud CDN

This option provides more control and is good for production workloads.

### Prerequisites

1. Google Cloud SDK installed: `gcloud`
2. A Google Cloud project with billing enabled

### Step 1: Install Google Cloud SDK

```bash
# macOS
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### Step 2: Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 3: Enable Required APIs

```bash
gcloud services enable storage-component.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Step 4: Create Storage Bucket

```bash
# Replace YOUR_BUCKET_NAME with a unique name (must be globally unique)
gsutil mb -p YOUR_PROJECT_ID -c STANDARD -l us-central1 gs://YOUR_BUCKET_NAME

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME

# Enable website hosting
gsutil web set -m index.html -e index.html gs://YOUR_BUCKET_NAME
```

### Step 5: Build Your App

```bash
npm run build
```

### Step 6: Upload to Cloud Storage

```bash
# Upload all files from build directory
gsutil -m rsync -r build/ gs://YOUR_BUCKET_NAME/
```

### Step 7: Set Up Cloud CDN (Optional but Recommended)

1. Go to [Cloud Console](https://console.cloud.google.com/)
2. Navigate to Cloud CDN → Backend buckets
3. Create a new backend bucket pointing to your storage bucket
4. Create a load balancer with the backend bucket
5. Configure your custom domain to point to the load balancer IP

### Step 8: Connect Custom Domain

1. Get the load balancer IP or storage bucket URL
2. In your domain registrar, add:
   - An A record pointing to the load balancer IP (if using CDN)
   - Or a CNAME pointing to `c.storage.googleapis.com` (if using storage only)

---

## Option 3: Cloud Run (Containerized)

For more advanced deployments with containerization.

### Step 1: Create Dockerfile

A `Dockerfile` is included in this project.

### Step 2: Build and Deploy

```bash
# Build the container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/tennis-booking-app

# Deploy to Cloud Run
gcloud run deploy tennis-booking-app \
  --image gcr.io/YOUR_PROJECT_ID/tennis-booking-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Step 3: Map Custom Domain

1. Go to Cloud Run in the console
2. Click on your service
3. Go to "Custom Domains" tab
4. Add your domain and follow DNS instructions

---

## Automated Deployment with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

---

## Environment Variables

If you need environment variables, create a `.env.production` file:

```env
VITE_API_URL=https://your-api-url.com
```

Then update your build script in `package.json`:

```json
"build": "vite build --mode production"
```

---

## Troubleshooting

### Firebase: Domain verification fails
- Ensure DNS records are correctly set
- Wait up to 24 hours for DNS propagation
- Check that your domain registrar allows the required record types

### Cloud Storage: 403 Forbidden
- Verify bucket permissions: `gsutil iam get gs://YOUR_BUCKET_NAME`
- Ensure `allUsers:objectViewer` permission is set

### Build fails
- Check Node.js version (should be 18+)
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

---

## Cost Estimation

- **Firebase Hosting**: Free tier includes 10GB storage and 360MB/day transfer
- **Cloud Storage**: ~$0.026/GB/month + transfer costs
- **Cloud CDN**: ~$0.08/GB for first 10TB
- **Cloud Run**: Pay per request, free tier includes 2 million requests/month

For a small to medium app, Firebase Hosting free tier is usually sufficient.
