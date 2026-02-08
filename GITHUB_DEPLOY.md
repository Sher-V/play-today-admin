# Деплой по пушу в GitHub

При пуше в ветку `main` GitHub Actions собирает проект и деплоит его на Firebase Hosting.

## Однократная настройка

### 1. Репозиторий на GitHub

- Создайте новый репозиторий на [github.com](https://github.com/new) (без README, .gitignore и лицензии, если код уже есть локально).

### 2. Подключите remote и запушьте

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(Замените `YOUR_USERNAME` и `YOUR_REPO` на свои.)

### 3. Секрет для Firebase

Чтобы GitHub мог деплоить в ваш Firebase-проект, нужен сервисный аккаунт:

1. [Firebase Console](https://console.firebase.google.com/) → ваш проект **play-today-479819**
2. **Project settings** (шестерёнка) → вкладка **Service accounts**
3. **Generate new private key** → скачается JSON-файл
4. В GitHub: репозиторий → **Settings** → **Secrets and variables** → **Actions**
5. **New repository secret**:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_PLAY_TODAY_479819` (точно так, как в воркфлоу)
   - **Value:** откройте скачанный JSON и вставьте **весь** его текст (одной строкой)

После этого каждый пуш в `main` будет запускать сборку и деплой.

## Как это работает

- **Ветка `main`:** при `push` в `main` запускается workflow **Deploy to Firebase Hosting on merge** — сборка и деплой в канал `live`.
- **Pull Request:** при создании/обновлении PR создаётся preview-деплой (отдельный URL), продакшен не меняется.

Логи и статус деплоя: вкладка **Actions** в репозитории на GitHub.
