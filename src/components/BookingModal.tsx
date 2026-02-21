import React, { useMemo, useState, useEffect } from 'react';
import { X, Copy, Link2 } from 'lucide-react';
import { Booking, activityTypes } from '../App';
import { DatePicker } from './DatePicker';
import { getPriceForBooking, hasPricing } from '../lib/pricing';
import { generateTimeSlots } from '../lib/timeSlots';
import type { ClubPricing } from '../types/club-slots';

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

export function BookingModal({ courts, courtId, time, date, openingTime = '08:00', closingTime = '22:00', initialDuration, existingBooking, paymentLink, pricingByCourt, bookingsInSeries, onClose, onSave, onRequestCancelBooking, onRequestCancelSeries }: BookingModalProps) {
  const calculateDuration = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  };

  const [selectedCourtId, setSelectedCourtId] = useState(courtId);
  const [selectedDate, setSelectedDate] = useState(date);
  const [selectedTime, setSelectedTime] = useState(time);
  const [comment, setComment] = useState(existingBooking?.comment || '');
  const [activity, setActivity] = useState(existingBooking?.activity || activityTypes[0].name);
  const [duration, setDuration] = useState(
    existingBooking ? calculateDuration(existingBooking.startTime, existingBooking.endTime) : (initialDuration || 1)
  );
  const [recurringEndDate, setRecurringEndDate] = useState(existingBooking?.recurringEndDate || '');
  const [coach, setCoach] = useState(existingBooking?.coach ?? '');
  const [isPaid, setIsPaid] = useState(existingBooking?.status === 'confirmed');
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
  const isRecurringType = activity === 'Группа' || activity === 'Регулярная бронь корта';
  const isOneTime = activity === 'Разовая бронь корта';

  /** При редактировании брони серии — дата последней брони в серии (для поля «Дата окончания серии»). */
  const lastSeriesDate = useMemo(() => {
    if (!bookingsInSeries?.length) return undefined;
    return bookingsInSeries.reduce((max, b) => (b.date > max ? b.date : max), bookingsInSeries[0].date);
  }, [bookingsInSeries]);
  const effectiveRecurringEndDate = recurringEndDate || lastSeriesDate || '';
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
    recurringEndDate: isRecurringType ? (recurringEndDate || lastSeriesDate) : undefined,
    ...(activity === 'Группа' && coach.trim() ? { coach: coach.trim() } : {}),
    status: isPaid ? 'confirmed' : 'hold',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (isRecurringType) {
      const endDate = recurringEndDate || lastSeriesDate;
      if (!endDate) {
        alert('Пожалуйста, укажите дату окончания для регулярных занятий');
        return;
      }
      if (new Date(endDate) <= new Date(date)) {
        alert('Дата окончания должна быть позже даты начала');
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
              recurringEndDate: isRecurringType ? (recurringEndDate || lastSeriesDate) : undefined,
              ...(activity === 'Группа' && coach.trim() ? { coach: coach.trim() } : {}),
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

          {activity === 'Группа' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тренер (необязательно)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания серии</label>
                <DatePicker
                  selectedDate={effectiveRecurringEndDate || selectedDate}
                  onDateChange={setRecurringEndDate}
                  minDate={selectedDate}
                  placeholder="Выберите дату окончания"
                />
              </div>
              <p className="text-xs text-gray-600">
                💡 Бронирования будут созданы каждую неделю в {time} на корте {courtId} до выбранной даты.
                {effectiveRecurringEndDate && (
                  <span className="block mt-1 font-medium">
                    Примерно {Math.ceil((new Date(effectiveRecurringEndDate).getTime() - new Date(date).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1} занятий.
                  </span>
                )}
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
              {(existingBooking.isRecurring || existingBooking.activity === 'Группа' || existingBooking.activity === 'Регулярная бронь корта') && onRequestCancelSeries && (
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
              className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="comment-scope-title" className="text-base font-semibold text-gray-900">
                Изменить комментарий для всей серии?
              </h3>
              <div className="flex flex-col gap-2">
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