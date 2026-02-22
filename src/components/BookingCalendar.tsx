import { useMemo } from 'react';
import { Booking, activityTypes } from '../App';
import { X, Clock } from 'lucide-react';
import { useState } from 'react';
import { generateTimeSlots } from '../lib/timeSlots';

interface BookingCalendarProps {
  courts: string[];
  selectedDate: string;
  bookings: Booking[];
  /** Время открытия клуба (например, "08:00"). */
  openingTime: string;
  /** Время закрытия клуба (например, "22:00"). */
  closingTime: string;
  onSlotClick: (courtId: string, time: string, duration?: number) => void;
  /** Отменить бронь (перевести в статус canceled). Вызывается после подтверждения пользователя. */
  onCancelBooking: (booking: Booking) => void;
  onBookingClick: (booking: Booking) => void;
}

/** Высота одного ряда (1 час) в пикселях. */
const ROW_HEIGHT_PX = 28;
/** Высота верхнего бордера (border-t-2) у рядов. */
const ROW_TOP_BORDER_PX = 2;
/** Полная высота одного ряда = контент + верхний бордер (без border-b). */
const ROW_TOTAL_PX = ROW_TOP_BORDER_PX + ROW_HEIGHT_PX;

/** Считает суммарную высоту N получасовых слотов (учёт рядов по 1 часу и бордеров). */
function getSlotsHeight(_startIndex: number, slotCount: number): number {
  const hourCount = slotCount / 2;
  return hourCount * ROW_TOTAL_PX;
}

export function BookingCalendar({ courts, selectedDate, bookings, openingTime, closingTime, onSlotClick, onCancelBooking, onBookingClick }: BookingCalendarProps) {
  const { timeSlots, hourlyTimeSlots } = useMemo(
    () => generateTimeSlots(openingTime, closingTime),
    [openingTime, closingTime]
  );
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

          {/* Time Slots: 1 ряд = 1 час */}
          {hourlyTimeSlots.map((hour, hourIndex) => {
            const slotIndex1 = hourIndex * 2;
            const slotIndex2 = hourIndex * 2 + 1;
            return (
              <div key={hour} className="grid border-t-2 border-t-gray-300 hover:bg-gray-50" style={{ gridTemplateColumns: `100px repeat(${courts.length}, 1fr)`, gridTemplateRows: `${ROW_HEIGHT_PX}px` }}>
                <div className="py-1 px-2 text-xs font-semibold text-gray-700 bg-gray-50 flex items-center border-r border-gray-200" style={{ minHeight: ROW_HEIGHT_PX }}>
                  {hour}
                </div>
                {courts.map((court) => (
                  <div key={court} className="relative border-r border-gray-200 last:border-r-0" style={{ height: `${ROW_HEIGHT_PX}px` }}>
                    {[slotIndex1, slotIndex2].filter(i => timeSlots[i] != null).map((timeIndex, i) => {
                      const time = timeSlots[timeIndex];
                      const booking = getBookingForSlot(court, time);
                      const isFirstSlot = booking && booking.startTime === time;
                      const slotHeight = ROW_HEIGHT_PX / 2;
                      return (
                        <div
                          key={time}
                          className={`absolute left-0 right-0 cursor-pointer transition-colors ${!booking ? 'hover:bg-blue-50' : ''}`}
                          style={{ top: `${i * slotHeight}px`, height: `${slotHeight}px` }}
                          onMouseDown={() => handleMouseDown(court, timeIndex, !!booking)}
                          onMouseEnter={() => handleMouseEnter(court, timeIndex)}
                          onClick={() => !booking && onSlotClick(court, time, 1)}
                        >
                          {booking && isFirstSlot && (() => {
                            const durationSlots = (timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime)) / 30;
                            const isHalfHour = durationSlots === 1;
                            return (
                            <div
                              className={`absolute top-0 left-0 right-0 rounded py-1 px-2 text-white text-xs group cursor-pointer z-10 overflow-hidden flex ${isHalfHour ? 'flex-row items-center gap-1.5' : 'flex-col justify-between'}`}
                              style={{ 
                                backgroundColor: booking.color,
                                height: `${getSlotsHeight(timeIndex, durationSlots)}px`
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onBookingClick(booking);
                              }}
                            >
                              {isHalfHour ? (
                                <div className="min-w-0 flex items-center gap-1 truncate flex-1">
                                  {booking.status === 'hold' && (
                                    <Clock className="w-3 h-3 shrink-0 opacity-90" title="Ожидает оплаты" />
                                  )}
                                  <span className="font-semibold shrink-0">{booking.startTime}-{booking.endTime}</span>
                                  <span className="truncate">{booking.comment}</span>
                                </div>
                              ) : (
                              <div>
                                <div className="text-xs font-semibold flex items-center gap-1">
                                  {booking.status === 'hold' && (
                                    <Clock className="w-3 h-3 shrink-0 opacity-90" title="Ожидает оплаты" />
                                  )}
                                  {booking.startTime} - {booking.endTime}
                                </div>
                                <div className="font-semibold truncate mt-0.5">{booking.comment}</div>
                                {booking.activity === 'Группа' && booking.coach && (
                                  <div className="text-xs opacity-90 truncate mt-0.5">Тренер: {booking.coach}</div>
                                )}
                              </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCancelBooking(booking);
                                }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/30 rounded p-1 shrink-0"
                                aria-label="Отменить бронирование"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            );
                          })()}
                          {isInDragRange(court, timeIndex) && dragStart && dragEnd && (() => {
                            const minIdx = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
                            const maxIdx = Math.max(dragStart.timeIndex, dragEnd.timeIndex);
                            const isFirstInRange = timeIndex === minIdx;
                            const rangeSlots = maxIdx - minIdx + 1;
                            return isFirstInRange ? (
                              <div
                                className="absolute left-1 right-1 top-1 rounded bg-blue-400/50 border-2 border-blue-500 pointer-events-none z-10"
                                style={{ height: `${getSlotsHeight(minIdx, rangeSlots) - 8}px` }}
                              />
                            ) : null;
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Легенда: цвета типов бронирования (дневное расписание) */}
      <div className="border-t bg-gray-50 py-2 px-3 mt-2 rounded-b-lg">
        <p className="text-xs font-medium text-gray-600 mb-1.5">Цвета типов бронирования</p>
        <div className="flex flex-wrap text-xs text-gray-500 mt-1" style={{ gap: '12px'}}>
          {activityTypes.map((type) => (
            <div key={type.name} className="flex items-center" style={{ gap: '3px' }}>
              <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: type.color }} />
              <span>{type.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}