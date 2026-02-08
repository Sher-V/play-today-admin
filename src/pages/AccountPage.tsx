import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getStoredClub, saveClub } from '../lib/clubStorage';
import { getClubByUserIdOrEmail, updateClubInFirestore } from '../lib/clubsFirestore';
import type { ClubData } from '../lib/clubStorage';
import type { ClubPricing, PriceSlot } from '../types/club-slots';
import '../components/RegistrationForm.css';
import './AccountPage.css';

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

const defaultPricing = (open: string, close: string): ClubPricing => ({
  weekday: [defaultPriceSlot(open, close, 1500)],
  weekend: [defaultPriceSlot(open, close, 2000)],
});

export function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [courtsCount, setCourtsCount] = useState(1);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [pricing, setPricing] = useState<ClubPricing>(() => defaultPricing('08:00', '22:00'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email ?? null } : null);
      if (firebaseUser) {
        let stored = getStoredClub();
        if (!stored) {
          try {
            const c = await getClubByUserIdOrEmail(firebaseUser.uid, firebaseUser.email ?? null);
            if (c) {
              saveClub(c);
              stored = c;
            }
          } catch {
            stored = null;
          }
        }
        setClub(stored);
        if (stored) {
          setCourtsCount(stored.courtsCount ?? 1);
          setOpeningTime(stored.openingTime ?? '08:00');
          setClosingTime(stored.closingTime ?? '22:00');
          setPricing(
            stored.pricing && (stored.pricing.weekday?.length > 0 || stored.pricing.weekend?.length > 0)
              ? stored.pricing
              : defaultPricing(stored.openingTime ?? '08:00', stored.closingTime ?? '22:00')
          );
        }
      } else {
        setClub(null);
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const addSlot = (dayType: 'weekday' | 'weekend') => {
    setPricing((prev) => ({
      ...prev,
      [dayType]: [
        ...prev[dayType],
        defaultPriceSlot(openingTime, closingTime, dayType === 'weekday' ? 1500 : 2000),
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
      [dayType]: prev[dayType].map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club?.clubId) return;
    setError('');
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await updateClubInFirestore(club.clubId, {
        courtsCount,
        openingTime,
        closingTime,
        pricing,
      });
      const updated: ClubData = {
        ...club,
        courtsCount,
        openingTime,
        closingTime,
        pricing,
      };
      saveClub(updated);
      setClub(updated);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения.');
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

  if (loading) {
    return (
      <div className="account-page__loading">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="account-page__empty">
        <div className="account-page__empty-card">
          <p>Войдите в аккаунт.</p>
          <Link to="/signin">Войти</Link>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="account-page__empty">
        <div className="account-page__empty-card">
          <p>Клуб не найден для этого аккаунта.</p>
          <Link to="/signup">Зарегистрировать клуб</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-page__inner">
        <header className="account-page__header">
          <h1 className="account-page__title">Аккаунт</h1>
          <Link to="/" className="account-page__back">
            ← Назад к расписанию
          </Link>
        </header>

        <div className="account-page__card">
          <h2 className="account-page__card-title">Настройки клуба</h2>
          <p className="account-page__card-desc">
            Измените количество кортов, время работы и цены за аренду. Изменения сохраняются в базу и сразу учитываются при расчёте суммы для разовой брони.
          </p>

          <form onSubmit={handleSubmit} className="account-page__form">
            <div className="account-page__field">
              <label htmlFor="account-courts">Количество кортов</label>
              <input
                id="account-courts"
                type="number"
                min={1}
                max={20}
                value={courtsCount}
                onChange={(e) => setCourtsCount(Number(e.target.value) || 1)}
              />
            </div>

            <div className="account-page__field">
              <div className="account-page__time-row">
                <Clock size={18} />
                <span>Время работы</span>
              </div>
              <div className="account-page__time-fields">
                <div className="account-page__subfield">
                  <label htmlFor="account-opening">Открытие</label>
                  <input
                    id="account-opening"
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                  />
                </div>
                <div className="account-page__subfield">
                  <label htmlFor="account-closing">Закрытие</label>
                  <input
                    id="account-closing"
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="account-page__pricing-title">Цены за аренду (руб/час)</h3>
              <p className="account-page__pricing-hint">
                Укажите диапазоны времени и цену. Можно добавить несколько диапазонов для разных периодов дня.
              </p>
              {renderPriceSection('Будние дни (Пн–Пт)', 'weekday')}
              {renderPriceSection('Выходные (Сб–Вс)', 'weekend')}
            </div>

            {error && (
              <div className="account-page__message account-page__message--error" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="account-page__message account-page__message--success" role="status">
                Изменения сохранены.
              </div>
            )}

            <div className="account-page__actions">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="account-page__btn account-page__btn--secondary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="account-page__btn account-page__btn--primary"
              >
                {isSubmitting ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
