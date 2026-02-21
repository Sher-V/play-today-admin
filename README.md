
  # Tennis Court Booking Admin App

  This is a code bundle for Tennis Court Booking Admin App. The original project is available at https://www.figma.com/design/yrlI5PXGEPYndTkEmdHaj6/Tennis-Court-Booking-Admin-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Firestore: сохранение клубов

  При регистрации данные клуба сохраняются в коллекцию **clubs** в Firestore.

  1. В [Firebase Console](https://console.firebase.google.com/) включите Firestore: **Build → Firestore Database → Create database** (режим production или test).
  2. **Обязательно настройте правила доступа**: **Firestore Database → Rules**. Без разрешения на запись коллекция **clubs** не создаётся и документы не сохраняются. Вставьте правила (или скопируйте из файла `firestore.rules` в проекте):
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /clubs/{clubId} {
           allow read, create, update, delete: if request.auth != null;
         }
       }
     }
     ```
     Нажмите **Publish**.
  3. Скопируйте `.env.example` в `.env` и заполните переменные из Project settings → General → Your apps (Web app config).
  4. Установите зависимости: `npm i` (включая пакет `firebase`).

  Без настроенного `.env` или без правил Firestore запись в облако не сработает; при ошибке в форме показывается сообщение.

  **Структура Firestore** (как в ADMIN_README):
  - `clubs/{clubId}` — документ клуба (name, city, email, courtsCount, openingTime, closingTime, userId, createdAt, updatedAt).
  - `clubs/{clubId}/courts/{courtId}` — подколлекция кортов (Корт 1, Корт 2, … по courtsCount; поля name, order, createdAt, updatedAt).
  - `clubs/{clubId}/bookings/{bookingId}` — подколлекция броней (courtId, type, startTime, endTime, comment, clientName, firstSessionDate, lastSessionDate и др.).
  - `clubs/{clubId}/clients/{clientId}` — подколлекция клиентов клуба (name — ФИО). Справочник для подсказки в форме брони; при сохранении брони с новым ФИО клиент добавляется в подколлекцию.
  Типы и константы: `src/types/club-slots.ts`.

  ### Поле «Клиент» в бронировании

  В форме создания и редактирования брони есть поле **«Клиент»** (ФИО). Значение сохраняется в документе брони как `clientName`. Подсказки при вводе берутся из подколлекции **clients** клуба (поиск по вводу, без учёта регистра). При сохранении брони с новым ФИО клиент автоматически добавляется в подколлекцию `clients`.

  ## Авторизация и маршруты

  - **`/signin`** — вход (email и пароль). По умолчанию приложение открывается на этой странице.
  - **`/signup`** — регистрация клуба (форма регистрации). Ссылка «Зарегистрироваться» ведёт с `/signin` на `/signup`.
  - **`/`** — главная (расписание). Доступна только после входа.

  В [Firebase Console](https://console.firebase.google.com/) включите способ входа **Email/Password** (Authentication → Sign-in method).

  ## Ссылка на оплату (ЮKassa)

  В форме создания брони есть галочка **«Нужна ссылка на оплату»**. При сохранении брони с этой галочкой создаётся платёж в ЮKassa и в модалке показывается ссылка для отправки клиенту.

  ### Тестовая ЮKassa (локальная разработка)

  Для локального тестирования оплаты используйте демо-магазин ЮKassa:

  1. Скопируйте `functions/.env.example` в `functions/.env`.
  2. Укажите ваш Shop ID из [личного кабинета ЮKassa](https://yookassa.ru/my) (демо-магазин создаётся в разделе «Добавить магазин» → «Демо-магазин»).
  3. Secret Key (тестовый) уже указан в `.env.example`. При необходимости замените на свой из раздела «Интеграция» → «Ключи API».

  ### Продакшен (деплой)

  1. Задеплойте Cloud Function: из корня проекта выполните `cd functions && npm i && npm run build && cd .. && firebase deploy --only functions`.
  2. Задайте учётные данные ЮKassa в Firebase:
     - **Вариант A**: в [Firebase Console](https://console.firebase.google.com/) → Project settings → Service accounts → или через CLI:
       `firebase functions:config:set yookassa.shop_id="ВАШ_SHOP_ID" yookassa.secret_key="ВАШ_SECRET_KEY"`
     - **Вариант B**: в Google Cloud Console → Cloud Functions → выберите функцию `createPaymentLink` → Edit → Variables and secrets → добавьте переменные `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`.
  3. Shop ID и Secret Key берутся в [личном кабинете ЮKassa](https://yookassa.ru/my) (раздел «Настройки» → «Ключи API»).

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
  2. Добавьте секреты в GitHub: Settings → Secrets and variables → Actions → New repository secret:
     - `FIREBASE_SERVICE_ACCOUNT_PLAY_TODAY_479819` — содержимое JSON-ключа сервисного аккаунта Firebase (см. [настройка секрета](#настройка-секрета-для-github-actions))
     - Для сборки в проде нужны переменные Firebase (они подставляются при `npm run build`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` — значения берите в Firebase Console → Project settings → General → Your apps (Web app).
  3. Пуш в `main`: `git push -u origin main`

  Подробнее: [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md)

  ### Настройка секрета для GitHub Actions

  В [Firebase Console](https://console.firebase.google.com/) → Project settings → Service accounts → Generate new private key. Скачанный JSON целиком вставьте в значение секрета `FIREBASE_SERVICE_ACCOUNT_PLAY_TODAY_479819`.
  