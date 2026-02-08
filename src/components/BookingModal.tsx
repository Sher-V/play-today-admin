import React, { useState } from 'react';
import { X, Copy, Link2 } from 'lucide-react';
import { Booking, activityTypes } from '../App';
import { DatePicker } from './DatePicker';
import { getPriceForBooking, hasPricing } from '../lib/pricing';
import type { ClubPricing } from '../types/club-slots';

export interface BookingSaveOptions {
  needPaymentLink: boolean;
  amount: number;
}

interface BookingModalProps {
  courts: string[];
  courtId: string;
  time: string;
  date: string;
  initialDuration?: number;
  existingBooking?: Booking;
  paymentLink?: string | null;
  /** Прайс клуба для авторасчёта суммы при разовой брони. */
  pricing?: ClubPricing | null;
  onClose: () => void;
  onSave: (booking: Omit<Booking, 'id'>, bookingId?: string, options?: BookingSaveOptions) => void;
}

export function BookingModal({ courts, courtId, time, date, initialDuration, existingBooking, paymentLink, pricing, onClose, onSave }: BookingModalProps) {
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
  const [needPaymentLink, setNeedPaymentLink] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(1000);

  const timeSlots = Array.from({ length: 36 }, (_, i) => {
    const hour = Math.floor(i / 2) + 6;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  const selectedActivity = activityTypes.find(a => a.name === activity) || activityTypes[0];
  const isRecurringType = activity === 'Группа' || activity === 'Регулярная бронь корта';
  const isOneTime = activity === 'Разовая бронь корта';
  const useCalculatedAmount = isOneTime && needPaymentLink && hasPricing(pricing ?? undefined);
  const calculatedAmount = useCalculatedAmount && pricing
    ? getPriceForBooking(pricing, selectedDate, selectedTime, calculateEndTime(selectedTime, duration))
    : 0;

  const calculateEndTime = (start: string, hours: number) => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + hours * 60;
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (isRecurringType) {
      if (!recurringEndDate) {
        alert('Пожалуйста, укажите дату окончания для регулярных занятий');
        return;
      }
      if (new Date(recurringEndDate) <= new Date(date)) {
        alert('Дата окончания должна быть позже даты начала');
        return;
      }
    }

    const amount =
      useCalculatedAmount && pricing
        ? getPriceForBooking(pricing, selectedDate, selectedTime, calculateEndTime(selectedTime, duration))
        : paymentAmount;
    const options: BookingSaveOptions | undefined =
      !existingBooking && needPaymentLink
        ? { needPaymentLink: true, amount }
        : undefined;

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
        recurringEndDate: isRecurringType ? recurringEndDate : undefined,
      },
      existingBooking?.id,
      options
    );

    if (!options) {
      setComment('');
      onClose();
    }
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      alert('Ссылка скопирована в буфер обмена');
    }
  };

  const getDurationLabel = (hours: number) => {
    if (hours === 0.5) return '30 мин';
    if (hours === 1) return '1 час';
    const wholeHours = Math.floor(hours);
    const hasHalf = hours % 1 === 0.5;
    return hasHalf ? `${wholeHours}.5 часа` : `${wholeHours} часа`;
  };

  // Экран «Бронирование создано» со ссылкой на оплату
  if (paymentLink) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{existingBooking ? 'Редактирование бронирования' : 'Новое бронирование'}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(h => (
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

          {isRecurringType && (
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания серии</label>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  min={date}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <p className="text-xs text-gray-600">
                💡 Бронирования будут созданы каждую неделю в {time} на корте {courtId} до выбранной даты.
                {recurringEndDate && (
                  <span className="block mt-1 font-medium">
                    Примерно {Math.ceil((new Date(recurringEndDate).getTime() - new Date(date).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1} занятий.
                  </span>
                )}
              </p>
            </div>
          )}

          {!existingBooking && (
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {existingBooking ? 'Сохранить изменения' : 'Создать бронирование'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}