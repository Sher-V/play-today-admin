import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Booking, activityTypes } from '../App';
import { generateTimeSlots } from '../lib/timeSlots';

interface WeeklyScheduleProps {
  courts: string[];
  selectedDate: string;
  bookings: Booking[];
  /** Время открытия клуба (например, "08:00"). */
  openingTime: string;
  /** Время закрытия клуба (например, "22:00"). */
  closingTime: string;
  onWeekChange: (direction: 'prev' | 'next') => void;
  onBookingClick: (booking: Booking) => void;
  onSlotClick: (courtId: string, time: string, duration?: number, date?: string) => void;
}

export function WeeklySchedule({ courts, selectedDate, bookings, openingTime, closingTime, onWeekChange, onBookingClick, onSlotClick }: WeeklyScheduleProps) {
  const [selectedCourt, setSelectedCourt] = useState<string | 'all'>('all');
  
  const { timeSlots, hourlyTimeSlots } = useMemo(
    () => generateTimeSlots(openingTime, closingTime),
    [openingTime, closingTime]
  );

  // Calculate Monday of the current week
  const getMonday = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return monday;
  };

  // Get all 7 days of the week
  const getWeekDays = (dateStr: string) => {
    const monday = getMonday(dateStr);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      days.push(day.toISOString().split('T')[0]);
    }
    return days;
  };

  const weekDays = getWeekDays(selectedDate);
  const monday = getMonday(selectedDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekRange = `${monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getBookingsForSlot = (courtId: string, date: string, time: string) => {
    return bookings.filter(b => {
      if (b.courtId !== courtId || b.date !== date) return false;
      const slotTime = timeToMinutes(time);
      const bookingStart = timeToMinutes(b.startTime);
      const bookingEnd = timeToMinutes(b.endTime);
      return slotTime >= bookingStart && slotTime < bookingEnd;
    });
  };

  const displayCourts = selectedCourt === 'all' ? courts : courts.filter(court => court === selectedCourt);

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Week navigation */}
      <div className="flex items-center justify-between py-2 px-3 border-b">
        <button
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          onClick={() => onWeekChange('prev')}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Предыдущая</span>
        </button>
        <div className="flex items-center gap-4">
          <div className="font-medium text-lg">{weekRange}</div>
          <select
            value={selectedCourt}
            onChange={(e) => setSelectedCourt(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все корты</option>
            {courts.map((court) => (
              <option key={court} value={court}>{court}</option>
            ))}
          </select>
        </div>
        <button
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          onClick={() => onWeekChange('next')}
        >
          <span>Следующая</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekly grid */}
      <div className="overflow-x-auto">
        <div className="flex">
          {/* Time column: header height = court header (36px) + day header row (36px) so labels align with grid rows */}
          <div className="flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: '72px' }}>
            <div className="border-b border-gray-200" style={{ height: '72px' }}></div>
            <div>
              {hourlyTimeSlots.map((time) => (
                <div
                  key={time}
                  className="px-1.5 text-xs font-semibold text-gray-700 flex items-center"
                  style={{ height: '28px' }}
                >
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* Courts and days grid */}
          <div className="flex-1">
            {displayCourts.map((court) => (
              <div key={court} className="border-b last:border-b-0">
                {/* Court header — fixed height so it matches time column header offset */}
                <div className="sticky left-0 bg-gray-100 px-2 py-1.5 font-medium text-sm border-b flex items-center" style={{ height: '36px' }}>
                  {court}
                </div>

                {/* Days grid for this court */}
                <div className="grid grid-cols-7 relative relative">
                  {/* Hour grid lines spanning all days */}
                  {hourlyTimeSlots.map((time, hourIndex) => (
                    <div
                      key={`line-${time}`}
                      className="absolute left-0 right-0 border-t border-gray-200 pointer-events-none"
                      style={{ 
                        top: `${36 + hourIndex * 28}px`,
                        zIndex: 1
                      }}
                    />
                  ))}
                  
                  {weekDays.map((date, dayIndex) => {
                    const dateObj = new Date(date);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    
                    return (
                      <div key={date} className="border-r last:border-r-0 min-w-[120px]">
                        {/* Day header */}
                        <div className={`px-1.5 text-center text-xs border-b flex flex-col items-center justify-center ${
                          isToday ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-600'
                        }`} style={{ height: '36px' }}>
                          <div>{dayNames[dayIndex]}</div>
                          <div className="text-[10px] leading-tight">
                            {dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>

                        {/* Time slots for this day */}
                        <div className="relative" style={{ height: `${hourlyTimeSlots.length * 28}px` }}>
                          {/* Clickable 30-min slots */}
                          {timeSlots.map((time, timeIndex) => {
                            const bookingsInSlot = getBookingsForSlot(court, date, time);
                            const booking = bookingsInSlot[0];
                            
                            // Check if this is the first slot of a booking
                            const isFirstSlot = booking && booking.startTime === time;

                            return (
                              <div
                                key={`${date}-${time}`}
                                className="absolute left-0 right-0"
                                style={{ 
                                  top: `${timeIndex * 14}px`,
                                  height: '14px'
                                }}
                              >
                                {booking && isFirstSlot && (
                                  <div
                                    className="absolute top-0 left-0 right-0 text-white text-[8px] px-0.5 flex items-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity z-10"
                                    style={{ 
                                      backgroundColor: booking.color,
                                      height: `${(timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime)) / 30 * 14}px`
                                    }}
                                    onClick={() => onBookingClick(booking)}
                                    title={[
                                      booking.activity === 'Группа' && booking.coach ? `Тренер: ${booking.coach}. ` : '',
                                      booking.status === 'hold' ? `${booking.comment} (ожидает оплаты)` : booking.comment
                                    ].filter(Boolean).join('')}
                                  >
                                    <span className="truncate flex items-center gap-0.5">
                                      {booking.status === 'hold' && <Clock className="w-2.5 h-2.5 shrink-0 opacity-90" />}
                                      {booking.comment}
                                    </span>
                                  </div>
                                )}
                                {!booking && (
                                  <div
                                    className="absolute inset-0 cursor-pointer hover:bg-blue-50/50 transition-colors"
                                    style={{ 
                                      height: '14px'
                                    }}
                                    onClick={() => onSlotClick(court, time, 1, date)}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда: цвета типов бронирования */}
      <div className="border-t bg-gray-50 py-2 px-3">
        <p className="text-xs font-medium text-gray-600 mb-1.5">Цвета типов бронирования</p>
        <div className="text-xs text-gray-500 space-y-1.5">
          {activityTypes.map((type) => (
            <div key={type.name} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: type.color }} />
              <span>{type.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}