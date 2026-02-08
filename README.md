
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

  ## Deploy on push to GitHub

  При пуше в ветку `main` приложение автоматически деплоится на Firebase Hosting.

  1. Создайте репозиторий на GitHub и добавьте remote:
     ```bash
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     ```
  2. Добавьте секрет в GitHub: Settings → Secrets and variables → Actions → New repository secret:
     - Name: `FIREBASE_SERVICE_ACCOUNT_PLAY_TODAY_479819`
     - Value: содержимое JSON-ключа сервисного аккаунта Firebase (см. [настройка секрета](#настройка-секрета-для-github-actions))
  3. Пуш в `main`: `git push -u origin main`

  Подробнее: [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)

  ### Настройка секрета для GitHub Actions

  В [Firebase Console](https://console.firebase.google.com/) → Project settings → Service accounts → Generate new private key. Скачанный JSON целиком вставьте в значение секрета `FIREBASE_SERVICE_ACCOUNT_PLAY_TODAY_479819`.
  