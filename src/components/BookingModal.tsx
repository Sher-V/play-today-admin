import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X, Copy, Link2, Plus } from 'lucide-react';
import { Booking, activityTypes } from '../App';
import { DatePicker } from './DatePicker';
import { getPriceForBooking, hasPricing } from '../lib/pricing';
import { generateTimeSlots } from '../lib/timeSlots';
import type { ClubPricing } from '../types/club-slots';
import { createClient, type Client } from '../lib/clientsFirestore';

export interface BookingSaveOptions {
  needPaymentLink?: boolean;
  amount?: number;
  /** При редактировании брони в серии: применить новый комментарий ко всей серии. */
  applyCommentToSeries?: boolean;
}

interface BookingModalProps {
  courts: string[];
  courtId: string;
  time: string;
  date: string;
  /** Время открытия клуба (например, "08:00"). */
  openingTime?: string;
  /** Время закрытия клуба (например, "22:00"). */
  closingTime?: string;
  initialDuration?: number;
  existingBooking?: Booking;
  /** Предзаполнение формы (например, после «Вернуться к бронированию» при конфликте). Режим создания. */
  prefill?: Omit<Booking, 'id'>;
  /** Справочник клиентов клуба (id + ФИО) — для подсказки и связи по clientId. */
  existingClients?: Client[];
  /** ID клуба — для добавления нового клиента из формы бронирования. */
  clubId?: string;
  /** После добавления нового клиента — обновить список (например, перезагрузить клиентов). */
  onClientAdded?: () => void | Promise<void>;
  paymentLink?: string | null;
  /** Прайс по кортам (имя корта → прайс). Для расчёта суммы используется прайс выбранного корта. */
  pricingByCourt?: Record<string, ClubPricing | null | undefined>;
  onClose: () => void;
  onSave: (booking: Omit<Booking, 'id'>, bookingId?: string, options?: BookingSaveOptions) => void | Promise<void>;
  /** Брони той же серии (тот же корт, время) — для диалога «Изменить комментарий для всей серии?». */
  bookingsInSeries?: Booking[];
  /** При нажатии «Отменить бронь» — вызвать это (показать окно подтверждения отмены) и закрыть модалку. Если не передано, используется confirm + сохранение со статусом canceled. */
  onRequestCancelBooking?: (booking: Booking) => void;
  /** При нажатии «Отменить серию» — отменить эту и все последующие брони серии. Только для регулярных броней. */
  onRequestCancelSeries?: (booking: Booking) => void;
}

export function BookingModal({ courts, courtId, time, date, openingTime = '08:00', closingTime = '22:00', initialDuration, existingBooking, prefill, existingClients = [], clubId, onClientAdded, paymentLink, pricingByCourt, bookingsInSeries, onClose, onSave, onRequestCancelBooking, onRequestCancelSeries }: BookingModalProps) {
  const calculateDuration = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  };

  const [selectedCourtId, setSelectedCourtId] = useState(courtId);
  const [selectedDate, setSelectedDate] = useState(date);
  const [selectedTime, setSelectedTime] = useState(time);
  const [comment, setComment] = useState(existingBooking?.comment ?? prefill?.comment ?? '');
  const [activity, setActivity] = useState(existingBooking?.activity ?? prefill?.activity ?? activityTypes[0].name);
  const [duration, setDuration] = useState(
    existingBooking
      ? calculateDuration(existingBooking.startTime, existingBooking.endTime)
      : prefill
        ? calculateDuration(prefill.startTime, prefill.endTime)
        : (initialDuration ?? 1)
  );
  /** Количество занятий в серии (для группы и регулярных). Дата окончания = дата начала + (sessionCount - 1) недель. */
  const [sessionCount, setSessionCount] = useState(() => {
    const source = existingBooking ?? prefill;
    if (source?.recurringEndDate && source?.date) {
      const start = new Date(source.date + 'T12:00:00').getTime();
      const end = new Date(source.recurringEndDate + 'T12:00:00').getTime();
      const weeks = (end - start) / (7 * 24 * 60 * 60 * 1000);
      const count = Math.floor(weeks) + 1;
      return Math.max(1, Math.min(104, count));
    }
    return 4;
  });
  const [coach, setCoach] = useState(existingBooking?.coach ?? prefill?.coach ?? '');
  const [clientId, setClientId] = useState<string | undefined>(existingBooking?.clientId ?? prefill?.clientId);
  const [clientName, setClientName] = useState(existingBooking?.clientName ?? prefill?.clientName ?? '');
  const [clientSuggestionsOpen, setClientSuggestionsOpen] = useState(false);
  const [showAddClientPopup, setShowAddClientPopup] = useState(false);
  const [addClientPhone, setAddClientPhone] = useState('');
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [addClientError, setAddClientError] = useState('');
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);
  const [isPaid, setIsPaid] = useState((existingBooking ?? prefill)?.status === 'confirmed');
  const [needPaymentLink, setNeedPaymentLink] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentScopeDialog, setShowCommentScopeDialog] = useState(false);

  const pricing = pricingByCourt?.[selectedCourtId] ?? null;

  const { timeSlots } = useMemo(
    () => generateTimeSlots(openingTime, closingTime),
    [openingTime, closingTime]
  );

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const calculateEndTime = (start: string, hours: number) => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + hours * 60;
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  };

  const allDurations = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const validDurations = useMemo(() => {
    const closingMinutes = timeToMinutes(closingTime);
    return allDurations.filter(h => {
      const endTime = calculateEndTime(selectedTime, h);
      return timeToMinutes(endTime) <= closingMinutes;
    });
  }, [selectedTime, closingTime]);

  const selectedActivity = activityTypes.find(a => a.name === activity) || activityTypes[0];
  const isRecurringType = activity === 'Группа' || activity === 'Регулярная бронь корта' || activity === 'Персональная тренировка';
  const isOneTime = activity === 'Разовая бронь корта';

  /** Подсказки клиентов: только по введённому тексту (без учёта регистра), не более 10. */
  const clientSuggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return [];
    return existingClients
      .filter((c) => c.name.trim().toLowerCase().includes(q) && c.name.trim() !== clientName.trim())
      .slice(0, 10);
  }, [clientName, existingClients]);

  /** Введённое ФИО не совпадает ни с одним клиентом — можно добавить нового (показать плюс). */
  const isNewClient = useMemo(() => {
    const name = clientName.trim();
    if (!name) return false;
    return !existingClients.some((c) => c.name.trim().toLowerCase() === name.toLowerCase());
  }, [clientName, existingClients]);

  const handleOpenAddClientPopup = () => {
    setAddClientPhone('');
    setAddClientError('');
    setShowAddClientPopup(true);
  };

  const handleSaveNewClient = async () => {
    const name = clientName.trim();
    if (!name || !clubId) return;
    setAddClientError('');
    setAddClientSaving(true);
    try {
      const id = await createClient(clubId, {
        name,
        contact: addClientPhone.trim() || undefined,
      });
      setClientId(id);
      await Promise.resolve(onClientAdded?.());
      setShowAddClientPopup(false);
    } catch (e) {
      setAddClientError(e instanceof Error ? e.message : 'Не удалось добавить клиента');
    } finally {
      setAddClientSaving(false);
    }
  };

  /** Только активные (не отменённые) брони серии — для расчёта количества занятий. */
  const activeInSeries = useMemo(
    () => bookingsInSeries?.filter((b) => b.status !== 'canceled') ?? [],
    [bookingsInSeries]
  );
  /** При редактировании брони серии — дата первой и последней активной брони. */
  const firstSeriesDate = useMemo(() => {
    if (!activeInSeries.length) return existingBooking?.date;
    return activeInSeries.reduce((min, b) => (b.date < min ? b.date : min), activeInSeries[0].date);
  }, [activeInSeries, existingBooking?.date]);
  const lastSeriesDate = useMemo(() => {
    if (!activeInSeries.length) return undefined;
    return activeInSeries.reduce((max, b) => (b.date > max ? b.date : max), activeInSeries[0].date);
  }, [activeInSeries]);

  /** Добавить N недель к дате YYYY-MM-DD, вернуть YYYY-MM-DD. */
  const addWeeks = (dateStr: string, weeks: number): string => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().slice(0, 10);
  };

  /** Дата первого занятия серии: при редактировании серии — firstSeriesDate, при создании — выбранная дата. */
  const seriesStartDate = activeInSeries.length > 0 && firstSeriesDate ? firstSeriesDate : selectedDate;
  /** Дата окончания серии, рассчитанная от первого занятия и количества занятий. */
  const effectiveRecurringEndDate = sessionCount >= 1 ? addWeeks(seriesStartDate, sessionCount - 1) : '';

  /** При открытии редактирования серии — подставить реальное количество занятий (число активных броней). */
  useEffect(() => {
    if (existingBooking && activeInSeries.length > 0) {
      setSessionCount(Math.max(1, Math.min(104, activeInSeries.length)));
    }
  }, [existingBooking, activeInSeries.length]);

  const useCalculatedAmount = isOneTime && needPaymentLink && hasPricing(pricing ?? undefined);
  const calculatedAmount = useCalculatedAmount && pricing
    ? getPriceForBooking(pricing, selectedDate, selectedTime, calculateEndTime(selectedTime, duration))
    : 0;

  const buildPayload = (): Omit<Booking, 'id'> => ({
    courtId: selectedCourtId,
    date: selectedDate,
    startTime: selectedTime,
    endTime: calculateEndTime(selectedTime, duration),
    activity,
    comment: comment.trim(),
    color: selectedActivity.color,
    isRecurring: isRecurringType,
    recurringEndDate: isRecurringType ? effectiveRecurringEndDate : undefined,
    ...((activity === 'Группа' || activity === 'Персональная тренировка') && coach.trim() ? { coach: coach.trim() } : {}),
    ...(clientId ? { clientId } : {}),
    ...(clientName.trim() ? { clientName: clientName.trim() } : {}),
    status: isPaid ? 'confirmed' : 'hold',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (isRecurringType) {
      if (sessionCount < 1) {
        alert('Укажите количество занятий (не менее 1)');
        return;
      }
    }

    const commentChanged = existingBooking && comment.trim() !== (existingBooking.comment ?? '');
    const hasSeries = bookingsInSeries && bookingsInSeries.length > 1;
    if (commentChanged && hasSeries) {
      setShowCommentScopeDialog(true);
      return;
    }

    const amount =
      useCalculatedAmount && pricing
        ? getPriceForBooking(pricing, selectedDate, selectedTime, calculateEndTime(selectedTime, duration))
        : paymentAmount;
    const options: BookingSaveOptions | undefined =
      !existingBooking && !isPaid && needPaymentLink
        ? { needPaymentLink: true, amount }
        : undefined;

    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave(buildPayload(), existingBooking?.id, options));
      if (!options) {
        setComment('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentScopeChoice = async (applyToSeries: boolean) => {
    setShowCommentScopeDialog(false);
    const options: BookingSaveOptions | undefined = applyToSeries ? { applyCommentToSeries: true } : undefined;
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave(buildPayload(), existingBooking?.id, options));
      setComment('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      alert('Ссылка скопирована в буфер обмена');
    }
  };

  const handleCancelBooking = () => {
    if (!existingBooking) return;
    if (onRequestCancelBooking) {
      onRequestCancelBooking(existingBooking);
      onClose();
      return;
    }
    // fallback: confirm + save with status canceled
    if (!confirm('Перевести бронь в статус «Отменена»?')) return;
    setIsSubmitting(true);
    (async () => {
      try {
        await Promise.resolve(
            onSave(
            {
              courtId: selectedCourtId,
              date: selectedDate,
              startTime: selectedTime,
              endTime: calculateEndTime(selectedTime, duration),
              activity,
              comment: comment.trim(),
              color: selectedActivity.color,
              isRecurring: isRecurringType,
              recurringEndDate: isRecurringType ? effectiveRecurringEndDate : undefined,
              ...((activity === 'Группа' || activity === 'Персональная тренировка') && coach.trim() ? { coach: coach.trim() } : {}),
              ...(clientId ? { clientId } : {}),
              ...(clientName.trim() ? { clientName: clientName.trim() } : {}),
              status: 'canceled',
            },
            existingBooking.id,
            undefined
          )
        );
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleCancelSeries = () => {
    if (!existingBooking || !onRequestCancelSeries) return;
    onRequestCancelSeries(existingBooking);
    onClose();
  };

  const getDurationLabel = (hours: number) => {
    if (hours === 0.5) return '30 мин';
    if (hours === 1) return '1 час';
    const wholeHours = Math.floor(hours);
    const hasHalf = hours % 1 === 0.5;
    return hasHalf ? `${wholeHours}.5 часа` : `${wholeHours} часа`;
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (timeSlots.length > 0 && !timeSlots.includes(selectedTime)) {
      const fallback = timeSlots.includes(time) ? time : timeSlots[0];
      setSelectedTime(fallback);
    }
  }, [time, timeSlots]);

  useEffect(() => {
    if (validDurations.length > 0 && !validDurations.includes(duration)) {
      setDuration(Math.max(...validDurations));
    }
  }, [selectedTime, validDurations, duration]);

  // Экран «Бронирование создано» со ссылкой на оплату
  if (paymentLink) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-green-700">Бронирование создано</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-2">Ссылку можно отправить клиенту для оплаты:</p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              readOnly
              value={paymentLink}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Копировать
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full relative flex flex-col my-auto"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-3 flex-shrink-0 border-b border-gray-100">
          <h2 className="font-semibold">{existingBooking ? 'Редактирование бронирования' : 'Новое бронирование'}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="flex-1 min-h-0 p-6 pt-4"
          style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 11rem)' }}
        >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Корт</label>
            <select
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {courts.map(court => (
                <option key={court} value={court}>{court}</option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
            <DatePicker
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Начало</label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeSlots.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Длительность (ч)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {validDurations.map(h => (
                  <option key={h} value={h}>{getDurationLabel(h)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип активности</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              style={{ backgroundColor: selectedActivity.color, color: 'white' }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {activityTypes.map((type) => (
                <option key={type.name} value={type.name}>{type.name}</option>
              ))}
            </select>
          </div>

          <div className="relative overflow-visible">
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент</label>
            <div className="flex flex-nowrap gap-2 items-center">
              <div className="relative flex-1 min-w-0">
                <input
                  ref={clientInputRef}
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setClientId(undefined);
                    setClientSuggestionsOpen(true);
                  }}
                  onFocus={() => clientName.trim() && setClientSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setClientSuggestionsOpen(false), 200)}
                  placeholder="ФИО клиента"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {clientSuggestionsOpen && clientSuggestions.length > 0 && (
                  <div
                    ref={clientSuggestionsRef}
                    className="absolute z-10 w-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {clientSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setClientId(c.id);
                          setClientName(c.name);
                          setClientSuggestionsOpen(false);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isNewClient && clientName.trim() && clubId && (
                <button
                  type="button"
                  onClick={handleOpenAddClientPopup}
                  title="Добавить клиента в справочник клуба"
                  aria-label="Добавить клиента"
                  style={{
                    minWidth: '2.5rem',
                    minHeight: '2.5rem',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: '#22c55e',
                    color: '#fff',
                    border: '1px solid #16a34a',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    lineHeight: 1,
                  }}
                  className="flex-none flex items-center justify-center shrink-0 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-opacity"
                >
                  <span aria-hidden>+</span>
                </button>
              )}
            </div>
          </div>

          {(activity === 'Группа' || activity === 'Персональная тренировка') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {activity === 'Персональная тренировка' ? 'Тренер' : 'Тренер (необязательно)'}
              </label>
              <input
                type="text"
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
                placeholder="ФИО тренера"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {isRecurringType && (
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Количество занятий</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="number"
                    min={1}
                    max={104}
                    value={sessionCount}
                    onChange={(e) => setSessionCount(Math.max(1, Math.min(104, Number(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {effectiveRecurringEndDate && (
                    <span className="text-sm text-gray-700">
                      Дата окончания: <strong>{new Date(effectiveRecurringEndDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600">
                💡 Бронирования будут созданы каждую неделю в {time} на корте {courtId} ({sessionCount} {sessionCount === 1 ? 'занятие' : sessionCount < 5 ? 'занятия' : 'занятий'}).
              </p>
            </div>
          )}

          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => {
                  setIsPaid(e.target.checked);
                  if (e.target.checked) setNeedPaymentLink(false);
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Бронь оплачена</span>
            </label>
          </div>

          {!existingBooking && !isPaid && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needPaymentLink}
                  onChange={(e) => setNeedPaymentLink(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Link2 className="w-4 h-4" />
                  Сгенерировать ссылку на оплату
                </span>
              </label>
              {needPaymentLink && (
                <div>
                  {useCalculatedAmount ? (
                    <p className="text-sm text-gray-600">
                      Сумма рассчитана по прайсу клуба: <strong>{calculatedAmount} ₽</strong>
                    </p>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Сумма (₽)</label>
                      <input
                        type="number"
                        min={1}
                        step={100}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Number(e.target.value) || 1000)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Введите комментарий"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {existingBooking ? 'Сохранить изменения' : 'Создать бронирование'}
            </button>
          </div>
          {existingBooking && existingBooking.status !== 'canceled' && (
            <div className="pt-3 mt-3 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Отменить бронь
              </button>
              {(existingBooking.isRecurring || existingBooking.activity === 'Группа' || existingBooking.activity === 'Регулярная бронь корта' || existingBooking.activity === 'Персональная тренировка') && onRequestCancelSeries && (
                <button
                  type="button"
                  onClick={handleCancelSeries}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Отменить серию
                </button>
              )}
            </div>
          )}
        </form>
        </div>
        {showCommentScopeDialog && (
          <div
            className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/30 p-4"
            style={{ zIndex: 9998 }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="comment-scope-title"
          >
            <div
              className="bg-white rounded-xl border border-gray-200 shadow-2xl p-4 max-w-sm w-full space-y-4"
              style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="comment-scope-title" className="text-base font-semibold text-gray-900">
                Изменить комментарий для всей серии?
              </h3>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCommentScopeChoice(true)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 text-sm font-medium"
                >
                  Да, для всей
                </button>
                <button
                  type="button"
                  onClick={() => handleCommentScopeChoice(false)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 text-sm font-medium text-gray-700"
                >
                  Только для этой
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommentScopeDialog(false)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-sm"
                >
                  Отменить
                </button>
              </div>
            </div>
          </div>
        )}
        {showAddClientPopup && (
          <div
            className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/30 p-4"
            style={{ zIndex: 9998 }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="add-client-title"
          >
            <div
              className="bg-white rounded-xl border border-gray-200 shadow-2xl p-4 max-w-sm w-full space-y-4"
              style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="add-client-title" className="text-base font-semibold text-gray-900">
                Добавить клиента в справочник
              </h3>
              <p className="text-sm text-gray-600">
                <strong>{clientName.trim()}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Телефон (необязательно)</label>
                <input
                  type="text"
                  value={addClientPhone}
                  onChange={(e) => setAddClientPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {addClientError && (
                <p className="text-sm text-red-600" role="alert">{addClientError}</p>
              )}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleSaveNewClient}
                  disabled={addClientSaving}
                  aria-label="Сохранить клиента"
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: '1px solid #15803d',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  className="disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {addClientSaving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddClientPopup(false)}
                  disabled={addClientSaving}
                  aria-label="Отмена"
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                  className="disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
        {isSubmitting && (
          <div
            className="absolute inset-0 rounded-lg flex items-center justify-center bg-white/90"
            style={{ zIndex: 9999 }}
            aria-busy="true"
            aria-label="Сохранение"
          >
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}