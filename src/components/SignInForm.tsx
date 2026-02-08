import { useState } from 'react';
import { Link } from 'react-router-dom';
import './RegistrationForm.css';

interface SignInFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function SignInForm({ onSignIn }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
