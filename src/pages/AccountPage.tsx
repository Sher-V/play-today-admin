import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getStoredClub, saveClub } from '../lib/clubStorage';
import { getClubByUserIdOrEmail, updateClubInFirestore } from '../lib/clubsFirestore';
import type { ClubData } from '../lib/clubStorage';
import type { ClubPricing, PriceSlot } from '../types/club-slots';
import { PriceRangesSection } from '../components/PriceRangesSection';
import './AccountPage.css';

const defaultPriceSlot = (open: string, close: string, price: number): PriceSlot => ({
  startTime: open,
  endTime: close,
  priceRub: price,
});

const defaultPricing = (open: string, close: string): ClubPricing => ({
  weekday: [defaultPriceSlot(open, close, 1500)],
  weekend: [defaultPriceSlot(open, close, 2000)],
});

type PaymentIntegration = 'yookassa' | 'bank_account';
type PaymentLinkKey = 'one_time' | 'group' | 'regular' | 'personal_training';

const PAYMENT_LINK_FIELDS: { key: PaymentLinkKey; label: string; description: string }[] = [
  {
    key: 'one_time',
    label: 'Разовая бронь корта',
    description: 'Ссылка на оплату разовой аренды корта',
  },
  {
    key: 'group',
    label: 'Группа',
    description: 'Ссылка на оплату групповых занятий',
  },
  {
    key: 'regular',
    label: 'Регулярная бронь корта',
    description: 'Ссылка на оплату регулярных броней',
  },
  {
    key: 'personal_training',
    label: 'Персональная тренировка',
    description: 'Ссылка на оплату персональных тренировок',
  },
];

export function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [courtsCountInput, setCourtsCountInput] = useState('1');
  const [yandexMapsUrl, setYandexMapsUrl] = useState('');
  const [telegramAdmin, setTelegramAdmin] = useState('');
  const [openingTime, setOpeningTime] = useState('07:00');
  const [closingTime, setClosingTime] = useState('23:00');
  const [pricing, setPricing] = useState<ClubPricing>(() => defaultPricing('07:00', '23:00'));
  const [paymentIntegration, setPaymentIntegration] = useState<PaymentIntegration>('yookassa');
  const [paymentLinks, setPaymentLinks] = useState<Partial<Record<PaymentLinkKey, string>>>({});
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
          setCourtsCountInput(String(stored.courtsCount ?? 1));
          setYandexMapsUrl(stored.yandexMapsUrl ?? '');
          setTelegramAdmin(stored.telegramAdmin ?? '');
          setOpeningTime(stored.openingTime ?? '07:00');
          setClosingTime(stored.closingTime ?? '23:00');
          setPricing(
            stored.pricing && (stored.pricing.weekday?.length > 0 || stored.pricing.weekend?.length > 0)
              ? stored.pricing
              : defaultPricing(stored.openingTime ?? '07:00', stored.closingTime ?? '23:00')
          );
          if (stored.paymentIntegration === 'bank_account' || stored.paymentIntegration === 'yookassa') {
            setPaymentIntegration(stored.paymentIntegration);
          } else {
            setPaymentIntegration('yookassa');
          }
          if (stored.paymentLinks) {
            setPaymentLinks(stored.paymentLinks as Partial<Record<PaymentLinkKey, string>>);
          }
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
    const parsed = parseInt(courtsCountInput.trim(), 10);
    const courtsCount = (Number.isNaN(parsed) || parsed < 1) ? 1 : Math.min(32, parsed);
    try {
      await updateClubInFirestore(club.clubId, {
        courtsCount,
        yandexMapsUrl: yandexMapsUrl.trim(),
        telegramAdmin: telegramAdmin.trim(),
        openingTime,
        closingTime,
        pricing,
        paymentIntegration,
        paymentLinks,
      });
      setCourtsCountInput(String(courtsCount));
      const updated: ClubData = {
        ...club,
        courtsCount,
        yandexMapsUrl: yandexMapsUrl.trim() || undefined,
        telegramAdmin: telegramAdmin.trim() || undefined,
        openingTime,
        closingTime,
        pricing,
        paymentIntegration,
        paymentLinks,
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
          <Link to="/dashboard" className="account-page__back">
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
                type="text"
                inputMode="numeric"
                value={courtsCountInput}
                onChange={(e) => setCourtsCountInput(e.target.value)}
                placeholder="1"
              />
              <span className="account-page__hint">От 1 до 32</span>
            </div>

            <div className="account-page__field">
              <label htmlFor="account-yandex-maps">Ссылка на Яндекс.Карты</label>
              <input
                id="account-yandex-maps"
                type="url"
                value={yandexMapsUrl}
                onChange={(e) => setYandexMapsUrl(e.target.value)}
                placeholder="https://yandex.ru/maps/..."
              />
              <span className="account-page__hint">Ссылка на место клуба в Яндекс.Картах (по желанию)</span>
            </div>

            <div className="account-page__field">
              <label htmlFor="account-telegram-admin">Telegram аккаунт администратора</label>
              <input
                id="account-telegram-admin"
                type="text"
                value={telegramAdmin}
                onChange={(e) => setTelegramAdmin(e.target.value)}
                placeholder="@club_admin"
              />
              <span className="account-page__hint">
                Аккаунт Telegram для отправки уведомлений о новых бронированиях из бота.
              </span>
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
            </div>

            <div>
              <h3 className="account-page__pricing-title">Настройки оплаты</h3>
              <p className="account-page__pricing-hint">
                Выберите, как вы хотите принимать онлайн-оплату за бронирования, и при необходимости задайте ссылки на оплату.
              </p>

              <div className="account-page__field">
                <label className="account-page__hint" style={{ marginBottom: '0.25rem' }}>
                  Способ интеграции
                </label>
                <div className="account-page__time-fields">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="radio"
                      name="paymentIntegration"
                      value="yookassa"
                      checked={paymentIntegration === 'yookassa'}
                      onChange={() => setPaymentIntegration('yookassa')}
                    />
                    <span>ЮKassa (ссылка на оплату создаётся автоматически)</span>
                  </label>
                </div>
                <div className="account-page__time-fields" style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="radio"
                      name="paymentIntegration"
                      value="bank_account"
                      checked={paymentIntegration === 'bank_account'}
                      onChange={() => setPaymentIntegration('bank_account')}
                    />
                    <span>Оплата по расчётному счёту (готовые ссылки на оплату)</span>
                  </label>
                </div>
              </div>

              {paymentIntegration === 'bank_account' && (
                <div className="account-page__field">
                  <p className="account-page__pricing-hint">
                    Укажите ссылки на оплату по расчётному счёту для разных услуг (по желанию). Если ссылка не указана, ссылка на оплату для этой услуги создана не будет.
                  </p>
                  <div className="account-page__time-fields" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                    {PAYMENT_LINK_FIELDS.map(({ key, label, description }) => (
                      <div key={key} className="account-page__subfield">
                        <label htmlFor={`payment-link-${key}`}>{label}</label>
                        <input
                          id={`payment-link-${key}`}
                          type="url"
                          value={paymentLinks[key] ?? ''}
                          onChange={(e) =>
                            setPaymentLinks((prev) => ({
                              ...prev,
                              [key]: e.target.value || undefined,
                            }))
                          }
                          placeholder="https://..."
                        />
                        <span className="account-page__hint">{description} (опционально)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                onClick={() => navigate('/dashboard')}
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
