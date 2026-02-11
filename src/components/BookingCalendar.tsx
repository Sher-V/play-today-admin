import { Booking } from '../App';
import { X, Clock } from 'lucide-react';
import { useState } from 'react';

interface BookingCalendarProps {
  courts: string[];
  selectedDate: string;
  bookings: Booking[];
  onSlotClick: (courtId: string, time: string, duration?: number) => void;
  /** Отменить бронь (перевести в статус canceled). Вызывается после подтверждения пользователя. */
  onCancelBooking: (booking: Booking) => void;
  onBookingClick: (booking: Booking) => void;
}

const timeSlots = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', 
  '22:00', '22:30', '23:00', '23:30'
];

export function BookingCalendar({ courts, selectedDate, bookings, onSlotClick, onCancelBooking, onBookingClick }: BookingCalendarProps) {
  const [dragStart, setDragStart] = useState<{ court: string; timeIndex: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ court: string; timeIndex: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const getBookingForSlot = (courtId: string, time: string) => {
    const slotMinutes = timeToMinutes(time);
    return bookings.find(b => {
      if (b.courtId !== courtId || b.date !== selectedDate) return false;
      const startMinutes = timeToMinutes(b.startTime);
      const endMinutes = timeToMinutes(b.endTime);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  };

  const handleMouseDown = (court: string, timeIndex: number, hasBooking: boolean) => {
    if (hasBooking) return;
    setIsDragging(true);
    setDragStart({ court, timeIndex });
    setDragEnd({ court, timeIndex });
  };

  const handleMouseEnter = (court: string, timeIndex: number) => {
    if (isDragging && dragStart && dragStart.court === court) {
      setDragEnd({ court, timeIndex });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd && dragStart.court === dragEnd.court) {
      const startIndex = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
      const endIndex = Math.max(dragStart.timeIndex, dragEnd.timeIndex);
      let duration = (endIndex - startIndex + 1) * 0.5; // Каждый слот = 30 минут = 0.5 часа
      
      // Если выбран только один слот (30 мин), увеличиваем до 1 часа
      if (duration === 0.5) {
        duration = 1;
      }
      
      onSlotClick(dragStart.court, timeSlots[startIndex], duration);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const isInDragRange = (court: string, timeIndex: number): boolean => {
    if (!isDragging || !dragStart || !dragEnd || dragStart.court !== court) return false;
    const minIndex = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
    const maxIndex = Math.max(dragStart.timeIndex, dragEnd.timeIndex);
    return court === dragStart.court && timeIndex >= minIndex && timeIndex <= maxIndex;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header Row */}
          <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: `100px repeat(${courts.length}, 1fr)` }}>
            <div className="py-2 px-3 font-semibold text-gray-700 border-r border-gray-200 text-sm">Время</div>
            {courts.map((court) => (
              <div key={court} className="py-2 px-3 font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0 text-sm">
                {court}
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {timeSlots.map((time, timeIndex) => {
            const isFullHour = time.endsWith(':00');
            return (
              <div key={time} className={`grid border-b border-gray-100 hover:bg-gray-50 ${isFullHour ? 'border-t-2 border-t-gray-300' : ''}`} style={{ gridTemplateColumns: `100px repeat(${courts.length}, 1fr)` }}>
                <div className={`py-1 px-2 text-xs ${isFullHour ? 'font-semibold text-gray-700 bg-gray-50' : 'font-normal text-gray-500 bg-gray-50/50'} border-r border-gray-200`}>
                  {time}
                </div>
                {courts.map((court, idx) => {
                  const booking = getBookingForSlot(court, time);
                  const isFirstSlot = booking && booking.startTime === time;
                  return (
                    <div
                      key={`${court}-${time}`}
                      className={`relative border-r border-gray-200 last:border-r-0 h-7 cursor-pointer transition-colors ${!booking ? 'hover:bg-blue-50' : ''}`}
                      onMouseDown={() => handleMouseDown(court, timeIndex, !!booking)}
                      onMouseEnter={() => handleMouseEnter(court, timeIndex)}
                      onClick={() => !booking && onSlotClick(court, time, 1)}
                    >
                      {booking && isFirstSlot && (
                        <div
                          className="absolute inset-0 rounded py-1 px-2 text-white text-xs flex flex-col justify-between group cursor-pointer z-10"
                          style={{ 
                            backgroundColor: booking.color,
                            height: `${(timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime)) / 30 * 28}px`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookingClick(booking);
                          }}
                        >
                          <div>
                            <div className="font-semibold flex items-center gap-1">
                              {booking.status === 'hold' && (
                                <Clock className="w-3 h-3 shrink-0 opacity-90" title="Ожидает оплаты" />
                              )}
                              <span className="truncate">{booking.comment}</span>
                            </div>
                            <div className="text-[10px] opacity-90 mt-0.5">{booking.startTime} - {booking.endTime}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelBooking(booking);
                            }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/30 rounded p-1"
                            aria-label="Отменить бронирование"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {isInDragRange(court, timeIndex) && (
                        <div
                          className="absolute inset-1 rounded bg-blue-400/50 border-2 border-blue-500 pointer-events-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}