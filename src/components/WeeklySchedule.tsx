import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking } from '../App';
import { useState } from 'react';

interface WeeklyScheduleProps {
  selectedDate: string;
  bookings: Booking[];
  onWeekChange: (direction: 'prev' | 'next') => void;
  onBookingClick: (booking: Booking) => void;
  onSlotClick: (courtId: string, time: string, duration?: number, date?: string) => void;
}

export function WeeklySchedule({ selectedDate, bookings, onWeekChange, onBookingClick, onSlotClick }: WeeklyScheduleProps) {
  const courts = ['Корт 1', 'Корт 2', 'Корт 3', 'Корт 4'];
  const [selectedCourt, setSelectedCourt] = useState<string | 'all'>('all');
  
  // All time slots for calculations
  const timeSlots = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', 
    '22:00', '22:30', '23:00', '23:30'
  ];

  // Only hourly slots for display
  const hourlyTimeSlots = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', 
    '22:00', '23:00'
  ];

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
      <div className="flex items-center justify-between p-4 border-b">
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
          {/* Time column */}
          <div className="flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: '80px' }}>
            {/* Empty header for time column */}
            <div className="h-12 border-b border-gray-200"></div>
            
            {/* Time labels */}
            <div>
              {hourlyTimeSlots.map((time, index) => {
                return (
                  <div
                    key={time}
                    className="px-2 text-xs font-semibold text-gray-700 flex items-start"
                    style={{ 
                      height: '40px',
                      paddingTop: '2px'
                    }}
                  >
                    {time}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Courts and days grid */}
          <div className="flex-1">
            {displayCourts.map((court) => (
              <div key={court} className="border-b last:border-b-0">
                {/* Court header */}
                <div className="sticky left-0 bg-gray-100 px-3 py-2 font-medium text-sm border-b">
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
                        top: `${48 + hourIndex * 40}px`,
                        zIndex: 1
                      }}
                    />
                  ))}
                  
                  {/* Hour grid lines spanning all days */}
                  {hourlyTimeSlots.map((time, hourIndex) => (
                    <div
                      key={`line-${time}`}
                      className="absolute left-0 right-0 border-t border-gray-200 pointer-events-none"
                      style={{ 
                        top: `${48 + hourIndex * 40}px`,
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
                        <div className={`px-2 text-center text-xs border-b flex flex-col items-center justify-center ${
                          isToday ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-600'
                        }`} style={{ height: '48px' }}>
                          <div>{dayNames[dayIndex]}</div>
                          <div className="text-[10px]">
                            {dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>

                        {/* Time slots for this day */}
                        <div className="relative" style={{ height: `${hourlyTimeSlots.length * 40}px` }}>
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
                                  top: `${timeIndex * 20}px`,
                                  height: '20px'
                                }}
                              >
                                {booking && isFirstSlot && (
                                  <div
                                    className="absolute inset-0 text-white text-[9px] px-1 flex items-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity z-10"
                                    style={{ 
                                      backgroundColor: booking.color,
                                      height: `${(timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime)) / 30 * 20}px`
                                    }}
                                    onClick={() => onBookingClick(booking)}
                                    title={booking.comment}
                                  >
                                    <span className="truncate">{booking.comment}</span>
                                  </div>
                                )}
                                {!booking && (
                                  <div
                                    className="absolute inset-0 cursor-pointer hover:bg-blue-50/50 transition-colors"
                                    style={{ 
                                      height: '20px'
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

      {/* Time labels sidebar */}
      <div className="border-t bg-gray-50 p-4">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#7dd3fc' }}></div>
            <span>Разовая бронь корта</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>Группа</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
            <span>Регулярная бронь корта</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fca5a5' }}></div>
            <span>Турнир</span>
          </div>
        </div>
      </div>
    </div>
  );
}