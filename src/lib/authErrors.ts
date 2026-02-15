/**
 * Преобразует коды ошибок Firebase Auth в сообщения на русском.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/invalid-email': 'Некорректный адрес email.',
  'auth/user-not-found': 'Пользователь с таким email не найден.',
  'auth/wrong-password': 'Неверный пароль.',
  'auth/too-many-requests': 'Слишком много попыток входа. Попробуйте позже.',
  'auth/network-request-failed': 'Ошибка сети. Проверьте подключение к интернету.',
  'auth/user-disabled': 'Этот аккаунт отключён.',
  'auth/configuration-not-found': 'Включите Authentication в Firebase Console: Authentication → Get started → Email/Password.',
  'auth/operation-not-allowed': 'Вход по email отключён в настройках Firebase.',
  'auth/weak-password': 'Пароль должен быть не менее 6 символов.',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован.',
  'auth/requires-recent-login': 'Для этого действия нужен повторный вход. Войдите снова.',
  'auth/expired-action-code': 'Ссылка устарела. Запросите сброс пароля заново.',
  'auth/invalid-action-code': 'Ссылка недействительна или уже использована.',
};

export function getAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (typeof code === 'string' && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }
  return err instanceof Error ? err.message : 'Произошла ошибка. Попробуйте ещё раз.';
}
