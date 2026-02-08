import { Booking } from '../App';
import { X } from 'lucide-react';

interface BookingCalendarProps {
  selectedDate: string;
  bookings: Booking[];
  onSlotClick: (courtId: string, time: string) => void;
  onDeleteBooking: (id: string) => void;
}

const courts = ['Корт 1', 'Корт 2', 'Корт 3', 'Корт 4'];

const timeSlots = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00'
];

export function BookingCalendar({ selectedDate, bookings, onSlotClick, onDeleteBooking }: BookingCalendarProps) {
  const getBookingForSlot = (courtId: string, time: string) => {
    return bookings.find(
      b => b.courtId === courtId && b.date === selectedDate && b.startTime === time
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header Row */}
          <div className="grid grid-cols-[100px_repeat(4,1fr)] border-b border-gray-200 bg-gray-50">
            <div className="p-4 font-semibold text-gray-700 border-r border-gray-200">Время</div>
            {courts.map((court) => (
              <div key={court} className="p-4 font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0">
                {court}
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {timeSlots.map((time) => (
            <div key={time} className="grid grid-cols-[100px_repeat(4,1fr)] border-b border-gray-200 hover:bg-gray-50">
              <div className="p-4 font-medium text-gray-600 border-r border-gray-200 bg-gray-50">
                {time}
              </div>
              {courts.map((court, idx) => {
                const booking = getBookingForSlot(court, time);
                return (
                  <div
                    key={`${court}-${time}`}
                    className="relative border-r border-gray-200 last:border-r-0 min-h-[60px] cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => !booking && onSlotClick(court, time)}
                  >
                    {booking && (
                      <div
                        className="absolute inset-1 rounded p-2 text-white text-sm flex flex-col justify-between group"
                        style={{ backgroundColor: booking.color }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <div className="font-semibold">{booking.activity}</div>
                          <div className="text-xs opacity-90">{booking.comment}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBooking(booking.id);
                          }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/30 rounded p-1"
                          aria-label="Удалить бронирование"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}