import { useState } from 'react';
import { Link } from 'react-router-dom';
import './RegistrationForm.css';

interface SignInFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword?: (email: string) => Promise<void>;
}

export function SignInForm({ onSignIn, onResetPassword }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSignIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onResetPassword) return;
    setResetError('');
    setResetSubmitting(true);
    try {
      await onResetPassword(resetEmail.trim());
      setResetSuccess(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Не удалось отправить письмо');
    } finally {
      setResetSubmitting(false);
    }
  };

  const backToSignIn = () => {
    setShowResetForm(false);
    setResetSuccess(false);
    setResetEmail('');
    setResetError('');
  };

  if (showResetForm) {
    return (
      <div className="registration-page">
        <div className="registration-card">
          <div className="registration-header">
            <div className="registration-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="registration-title">Восстановление пароля</h1>
            <p className="registration-subtitle">
              {resetSuccess ? 'Проверьте почту' : 'Введите email, указанный при регистрации'}
            </p>
          </div>

          {resetSuccess ? (
            <>
              <p className="registration-reset-success">
                Письмо со ссылкой для сброса пароля отправлено на <strong>{resetEmail}</strong>. Проверьте почту и следуйте инструкциям.
              </p>
              <button type="button" className="registration-submit" onClick={backToSignIn}>
                Вернуться к входу
              </button>
            </>
          ) : (
            <form onSubmit={handleResetSubmit}>
              <div>
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="club@example.com"
                />
              </div>

              {resetError && (
                <div className="registration-error" role="alert">
                  {resetError}
                </div>
              )}

              <button
                type="submit"
                className="registration-submit"
                disabled={resetSubmitting}
              >
                {resetSubmitting ? 'Отправка…' : 'Отправить ссылку для сброса пароля'}
              </button>

              <p className="registration-footer">
                <button
                  type="button"
                  className="registration-link-button"
                  onClick={backToSignIn}
                  disabled={resetSubmitting}
                >
                  Назад к входу
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="registration-page">
      <div className="registration-card">
        <div className="registration-header">
          <div className="registration-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>
          <h1 className="registration-title">Вход</h1>
          <p className="registration-subtitle">Введите email и пароль</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="club@example.com"
            />
          </div>

          <div>
            <label htmlFor="signin-password">Пароль</label>
            <input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="registration-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="registration-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Вход…' : 'Войти'}
          </button>

          {onResetPassword && (
            <p className="registration-footer">
              <button
                type="button"
                className="registration-link-button"
                onClick={() => setShowResetForm(true)}
              >
                Забыли пароль?
              </button>
            </p>
          )}

          <p className="registration-footer">
            Нет аккаунта?{' '}
            <Link to="/signup" className="registration-link">
              Зарегистрироваться
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
