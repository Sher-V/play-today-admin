import { useState } from 'react';
import { X } from 'lucide-react';
import { Booking, activityTypes } from '../App';
import { DatePicker } from './DatePicker';

interface BookingModalProps {
  courtId: string;
  time: string;
  date: string;
  initialDuration?: number;
  existingBooking?: Booking;
  onClose: () => void;
  onSave: (booking: Omit<Booking, 'id'>, bookingId?: string) => void;
}

export function BookingModal({ courtId, time, date, initialDuration, existingBooking, onClose, onSave }: BookingModalProps) {
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

  const courts = ['Корт 1', 'Корт 2', 'Корт 3', 'Корт 4'];
  const timeSlots = Array.from({ length: 36 }, (_, i) => {
    const hour = Math.floor(i / 2) + 6;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  const selectedActivity = activityTypes.find(a => a.name === activity) || activityTypes[0];
  
  // Автоматически показываем поле для регулярных занятий для группы и регулярной брони
  const isRecurringType = activity === 'Группа' || activity === 'Регулярная бронь корта';

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

    // Validate recurring end date if recurring is enabled
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

    onSave({
      courtId: selectedCourtId,
      date: selectedDate,
      startTime: selectedTime,
      endTime: calculateEndTime(selectedTime, duration),
      activity,
      comment: comment.trim(),
      color: selectedActivity.color,
      isRecurring: isRecurringType,
      recurringEndDate: isRecurringType ? recurringEndDate : undefined,
    }, existingBooking?.id);

    setComment('');
    onClose();
  };

  const getDurationLabel = (hours: number) => {
    if (hours === 0.5) return '30 мин';
    if (hours === 1) return '1 час';
    const wholeHours = Math.floor(hours);
    const hasHalf = hours % 1 === 0.5;
    return hasHalf ? `${wholeHours}.5 часа` : `${wholeHours} часа`;
  };

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
                💡 Бронирования будут созданы каждую неделю в {time} на корте {courtId} до ыбранной даты.
                {recurringEndDate && (
                  <span className="block mt-1 font-medium">
                    Примерно {Math.ceil((new Date(recurringEndDate).getTime() - new Date(date).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1} занятий.
                  </span>
                )}
              </p>
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