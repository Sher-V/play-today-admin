
  # Tennis Court Booking Admin App

  This is a code bundle for Tennis Court Booking Admin App. The original project is available at https://www.figma.com/design/yrlI5PXGEPYndTkEmdHaj6/Tennis-Court-Booking-Admin-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Deployment to Google Cloud

  This app is configured for deployment to Google Cloud with custom domain support.

  **Quick Start (Firebase Hosting - Recommended):**

  1. Install Firebase CLI: `npm install -g firebase-tools`
  2. Login: `firebase login`
  3. Initialize: `firebase init hosting` (select existing project or create new)
  4. Update `.firebaserc` with your project ID
  5. Build: `npm run build`
  6. Deploy: `firebase deploy --only hosting`
  7. Add custom domain in Firebase Console → Hosting → Add custom domain

  For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
  