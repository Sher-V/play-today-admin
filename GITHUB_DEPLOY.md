# Деплой через GitHub Actions (Stage и Prod)

Один workflow **`.github/workflows/deploy.yml`**: при push в ветку запускается деплой, окружение и проект выбираются по ветке.

| Ветка   | GitHub Environment | Куда деплой      |
|---------|--------------------|------------------|
| `dev`   | **dev**            | Stage (отдельный Firebase-проект) |
| `main`  | **prod**           | Prod (основной Firebase-проект)   |

---

## 1. GitHub Environments

В репозитории уже должны быть два environment: **dev** и **prod**.

- **Settings** → **Environments** → создайте при необходимости `dev` и `prod`.

---

## 2. Секреты в окружении **prod**

В **Settings** → **Environments** → **prod** → **Environment secrets** добавьте:

| Секрет | Описание |
|--------|----------|
| `VITE_FIREBASE_API_KEY` | API Key prod-приложения |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (например `your-prod-app.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | ID prod Firebase-проекта (например `play-today-479819`); используется и для сборки, и для деплоя |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket prod |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | App ID prod |
| `FIREBASE_SERVICE_ACCOUNT` | JSON целиком сервисного аккаунта Firebase (Project settings → Service accounts → Generate new private key) |

Все значения берите в Firebase Console **prod-проекта** → Project settings → General → Your apps (Web app) и Service accounts.

---

## 3. Секреты в окружении **dev**

В **Settings** → **Environments** → **dev** → **Environment secrets** добавьте те же **имена** секретов, но со значениями **stage** Firebase-проекта:

| Секрет | Описание |
|--------|----------|
| `VITE_FIREBASE_API_KEY` | API Key **stage**-приложения |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain stage (например `your-stage-app.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | ID **stage** Firebase-проекта (`play-today-dev`); используется и для сборки, и для деплоя |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket stage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID stage |
| `VITE_FIREBASE_APP_ID` | App ID stage |
| `FIREBASE_SERVICE_ACCOUNT` | JSON сервисного аккаунта **stage**-проекта (отдельный ключ из stage Firebase Console) |

То есть в **dev** — свои ключи и свой Firebase-проект (stage), в **prod** — продовые.

---

## 4. Итог

- **Push в `dev`** → деплой в stage Firebase-проект (секреты из environment **dev**).
- **Push в `main`** → деплой в prod Firebase-проект (секреты из environment **prod**).
- Имена секретов в обоих окружениях одинаковые; значения разные (свои ключи и project ID для stage и prod). Для деплоя используется тот же `VITE_FIREBASE_PROJECT_ID`, отдельный секрет `FIREBASE_PROJECT_ID` не нужен.
