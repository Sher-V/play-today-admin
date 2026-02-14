import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronLeft, Search } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getRussiaCities } from '../lib/russiaCities';
import type { ClubData } from '../lib/clubStorage';
import type { ClubPricing, PriceSlot } from '../types/club-slots';
import { PriceRangesSection } from './PriceRangesSection';
import './RegistrationForm.css';

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
    yandexMapsUrl: '',
    password: '',
    courtsCount: 1,
    openingTime: '07:00',
    closingTime: '23:00',
  });
  const [pricing, setPricing] = useState<ClubPricing>(() => ({
    weekday: [defaultPriceSlot('07:00', '23:00', 1500)],
    weekend: [defaultPriceSlot('07:00', '23:00', 2000)],
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityHighlightedIndex, setCityHighlightedIndex] = useState(0);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const cityListRef = useRef<HTMLUListElement>(null);

  const filteredCities = useMemo(() => {
    const q = cityInput.trim().toLowerCase();
    if (!q) return cities.slice(0, 80);
    return cities
      .filter((c) => c.toLowerCase().includes(q))
      .slice(0, 50);
  }, [cities, cityInput]);

  useEffect(() => {
    setCityInput(formData.city ?? '');
  }, [formData.city]);

  useEffect(() => {
    setCityHighlightedIndex(0);
  }, [cityInput]);

  useEffect(() => {
    const el = cityListRef.current;
    if (!el || !cityDropdownOpen) return;
    const item = el.children[cityHighlightedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cityHighlightedIndex, cityDropdownOpen]);

  const handleCitySelect = (name: string) => {
    setFormData((prev) => ({ ...prev, city: name }));
    setCityInput(name);
    setCityDropdownOpen(false);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent) => {
    if (!cityDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setCityDropdownOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setCityDropdownOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCityHighlightedIndex((i) => (i < filteredCities.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCityHighlightedIndex((i) => (i > 0 ? i - 1 : filteredCities.length - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const name = filteredCities[cityHighlightedIndex];
      if (name) handleCitySelect(name);
    }
  };

  useEffect(() => {
    const cancelled = { current: false };
    const handleClickOutside = (event: MouseEvent) => {
      if (cancelled.current) return;
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setCityDropdownOpen(false);
        setFormData((prev) => ({ ...prev, city: cityInput }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      cancelled.current = true;
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cityInput]);

  useEffect(() => {
    let cancelled = false;
    getRussiaCities()
      .then((list) => {
        if (!cancelled) {
          setCities(list);
          setCitiesError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCitiesError(e instanceof Error ? e.message : 'Не удалось загрузить список городов');
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

            <div ref={cityDropdownRef} className="registration-city-search">
              <label htmlFor="city">Город</label>
              {citiesError ? (
                <input
                  id="city"
                  type="text"
                  value={formData.city ?? ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Например: Москва"
                  title={citiesError}
                />
              ) : (
                <>
                  <div className="registration-city-input-wrap">
                    <Search className="registration-city-icon" aria-hidden />
                    <input
                      id="city"
                      type="text"
                      value={cityInput}
                      onChange={(e) => {
                        setCityInput(e.target.value);
                        setCityDropdownOpen(true);
                      }}
                      onFocus={() => setCityDropdownOpen(true)}
                      onKeyDown={handleCityKeyDown}
                      placeholder={citiesLoading ? 'Загрузка городов...' : 'Начните вводить название города'}
                      disabled={citiesLoading}
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={cityDropdownOpen}
                      aria-autocomplete="list"
                      aria-controls="city-list"
                      aria-activedescendant={cityDropdownOpen && filteredCities[cityHighlightedIndex] ? `city-opt-${cityHighlightedIndex}` : undefined}
                    />
                  </div>
                  {cityDropdownOpen && !citiesLoading && (
                    <ul
                      id="city-list"
                      ref={cityListRef}
                      className="registration-city-dropdown"
                      role="listbox"
                    >
                      {filteredCities.length === 0 ? (
                        <li className="registration-city-empty">Ничего не найдено</li>
                      ) : (
                        filteredCities.map((name, idx) => (
                          <li
                            key={name}
                            id={`city-opt-${idx}`}
                            role="option"
                            aria-selected={idx === cityHighlightedIndex}
                            className={`registration-city-option ${idx === cityHighlightedIndex ? 'registration-city-option--highlighted' : ''}`}
                            onMouseEnter={() => setCityHighlightedIndex(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleCitySelect(name);
                            }}
                          >
                            {name}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div>
              <label htmlFor="yandexMapsUrl">Ссылка на Яндекс.Карты</label>
              <input
                id="yandexMapsUrl"
                type="url"
                value={formData.yandexMapsUrl ?? ''}
                onChange={(e) => setFormData({ ...formData, yandexMapsUrl: e.target.value })}
                placeholder="https://yandex.ru/maps/..."
              />
              <span className="registration-hint">Укажите ссылку на место клуба в Яндекс.Картах (по желанию)</span>
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
              Далее
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

            <PriceRangesSection
              title="Будние дни (Пн–Пт)"
              slots={pricing.weekday}
              onAdd={() => addSlot('weekday')}
              onRemove={(index) => removeSlot('weekday', index)}
              onUpdateSlot={(index, field, value) => updateSlot('weekday', index, field, value)}
            />
            <PriceRangesSection
              title="Выходные (Сб–Вс)"
              slots={pricing.weekend}
              onAdd={() => addSlot('weekend')}
              onRemove={(index) => removeSlot('weekend', index)}
              onUpdateSlot={(index, field, value) => updateSlot('weekend', index, field, value)}
            />

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
