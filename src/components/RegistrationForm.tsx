import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import type { ClubData } from '../lib/clubStorage';
import type { ClubPricing, PriceSlot } from '../types/club-slots';
import './RegistrationForm.css';

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 6; h <= 23; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  slots.push('24:00');
  return slots;
})();

const defaultPriceSlot = (open: string, close: string, price: number): PriceSlot => ({
  startTime: open,
  endTime: close,
  priceRub: price,
});

interface RegistrationFormProps {
  onRegistered: (data: ClubData, userId: string) => void | Promise<void>;
}

export function RegistrationForm({ onRegistered }: RegistrationFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<ClubData & { password: string }>({
    name: '',
    email: '',
    city: '',
    password: '',
    courtsCount: 1,
    openingTime: '08:00',
    closingTime: '22:00',
  });
  const [pricing, setPricing] = useState<ClubPricing>(() => ({
    weekday: [defaultPriceSlot('08:00', '22:00', 1500)],
    weekend: [defaultPriceSlot('08:00', '22:00', 2000)],
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const goToStep2 = () => {
    setError('');
    setPricing({
      weekday: [defaultPriceSlot(formData.openingTime, formData.closingTime, 1500)],
      weekend: [defaultPriceSlot(formData.openingTime, formData.closingTime, 2000)],
    });
    setStep(2);
  };

  const addSlot = (dayType: 'weekday' | 'weekend') => {
    setPricing((prev) => ({
      ...prev,
      [dayType]: [
        ...prev[dayType],
        defaultPriceSlot(formData.openingTime, formData.closingTime, dayType === 'weekday' ? 1500 : 2000),
      ],
    }));
  };

  const removeSlot = (dayType: 'weekday' | 'weekend', index: number) => {
    setPricing((prev) => ({
      ...prev,
      [dayType]: prev[dayType].filter((_, i) => i !== index),
    }));
  };

  const updateSlot = (dayType: 'weekday' | 'weekend', index: number, field: keyof PriceSlot, value: string | number) => {
    setPricing((prev) => ({
      ...prev,
      [dayType]: prev[dayType].map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    goToStep2();
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { password, ...dataToSave } = formData;
    dataToSave.pricing = pricing;
    setIsSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        setError('Firebase не настроен. Задайте переменные VITE_FIREBASE_* в .env');
        return;
      }
      const { user } = await createUserWithEmailAndPassword(auth, formData.email, password);
      await onRegistered(dataToSave, user.uid);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      if (typeof code === 'string') {
        if (code === 'auth/configuration-not-found') {
          setError('Включите Authentication в Firebase Console: Authentication → Get started → Email/Password.');
        } else if (code === 'auth/email-already-in-use') {
          setError('Этот email уже зарегистрирован.');
        } else if (code === 'auth/weak-password') {
          setError('Пароль должен быть не менее 6 символов.');
        } else if (code === 'auth/invalid-email') {
          setError('Некорректный email.');
        } else if (code === 'permission-denied') {
          setError('Доступ к Firestore запрещён. В Firebase Console откройте Firestore → Rules и разрешите запись в коллекцию clubs (см. README).');
        } else {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPriceSection = (title: string, dayType: 'weekday' | 'weekend') => (
    <div key={dayType} className="registration-price-section">
      <div className="registration-price-section-header">
        <h3 className="registration-price-title">{title}</h3>
        <button
          type="button"
          className="registration-btn-add"
          onClick={() => addSlot(dayType)}
          aria-label="Добавить диапазон"
        >
          <Plus className="registration-btn-add-icon" />
          Добавить диапазон
        </button>
      </div>
      <div className="registration-price-list">
        {pricing[dayType].map((slot, index) => (
          <div key={index} className="registration-price-row">
            <select
              value={slot.startTime}
              onChange={(e) => updateSlot(dayType, index, 'startTime', e.target.value)}
              className="registration-price-time"
              aria-label="Начало"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="registration-price-dash">—</span>
            <select
              value={slot.endTime}
              onChange={(e) => updateSlot(dayType, index, 'endTime', e.target.value)}
              className="registration-price-time"
              aria-label="Конец"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={50}
              value={slot.priceRub}
              onChange={(e) => updateSlot(dayType, index, 'priceRub', Number(e.target.value) || 0)}
              className="registration-price-input"
              placeholder="₽"
              aria-label="Цена"
            />
            <span className="registration-price-currency">₽</span>
            {pricing[dayType].length > 1 && (
              <button
                type="button"
                className="registration-btn-remove"
                onClick={() => removeSlot(dayType, index)}
                aria-label="Удалить"
              >
                <Trash2 className="registration-btn-remove-icon" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="registration-page">
      <div className="registration-card">
        <div className="registration-header">
          <div className="registration-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="registration-title">Регистрация теннисного клуба</h1>
          <p className="registration-subtitle">
            {step === 1 ? 'Заполните информацию о вашем клубе' : 'Настройте цены за аренду корта'}
          </p>
          <div className="registration-steps">
            <span className={step === 1 ? 'registration-step-active' : 'registration-step-done'}>1</span>
            <span className="registration-step-divider">—</span>
            <span className={step === 2 ? 'registration-step-active' : ''}>2</span>
          </div>
        </div>

        {step === 1 && (
          <form onSubmit={handleSubmitStep1}>
            <div>
              <label htmlFor="name">Название клуба</label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Центральный теннисный клуб"
              />
            </div>

            <div>
              <label htmlFor="city">Город</label>
              <input
                id="city"
                type="text"
                value={formData.city ?? ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Например: Москва"
              />
            </div>

            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="club@example.com"
              />
            </div>

            <div>
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Не менее 6 символов"
              />
            </div>

            <div>
              <label htmlFor="courts">Количество кортов</label>
              <input
                id="courts"
                type="number"
                required
                min={1}
                max={20}
                value={formData.courtsCount}
                onChange={(e) => setFormData({ ...formData, courtsCount: Number(e.target.value) })}
              />
            </div>

            <div>
              <div className="registration-time-row">
                <Clock style={{ width: '1.25rem', height: '1.25rem' }} />
                <span>Время работы</span>
              </div>
              <div className="registration-time-grid">
                <div>
                  <label htmlFor="opening" className="registration-label-sm">Открытие</label>
                  <input
                    id="opening"
                    type="time"
                    required
                    value={formData.openingTime}
                    onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="closing" className="registration-label-sm">Закрытие</label>
                  <input
                    id="closing"
                    type="time"
                    required
                    value={formData.closingTime}
                    onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="registration-submit">
              Далее: настройка цен
            </button>

            <p className="registration-footer">
              Уже есть аккаунт?{' '}
              <Link to="/signin" className="registration-link">Войти</Link>
            </p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmitStep2}>
            <p className="registration-price-intro">
              Укажите диапазоны времени и цену за аренду (руб). Можно добавить несколько диапазонов для разных периодов дня.
            </p>

            {renderPriceSection('Будние дни (Пн–Пт)', 'weekday')}
            {renderPriceSection('Выходные (Сб–Вс)', 'weekend')}

            {error && (
              <div className="registration-error" role="alert">{error}</div>
            )}

            <div className="registration-step2-actions">
              <button
                type="button"
                className="registration-btn-back"
                onClick={() => { setError(''); setStep(1); }}
              >
                <ChevronLeft className="registration-btn-back-icon" />
                Назад
              </button>
              <button
                type="submit"
                className="registration-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Сохранение…' : 'Зарегистрироваться'}
              </button>
            </div>

            <p className="registration-footer">
              Уже есть аккаунт?{' '}
              <Link to="/signin" className="registration-link">Войти</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
