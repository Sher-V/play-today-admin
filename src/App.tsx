import { useState } from 'react';
import { BookingCalendar } from './components/BookingCalendar';
import { BookingModal } from './components/BookingModal';

export interface Booking {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  comment: string;
  color: string;
}

export const activityTypes = [
  { name: 'Урок', color: '#3b82f6' },
  { name: 'Матч', color: '#10b981' },
  { name: 'Тренировка', color: '#f59e0b' },
  { name: 'Турнир', color: '#ef4444' },
  { name: 'Обслуживание', color: '#6b7280' },
];

export default function App() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ courtId: string; time: string } | null>(null);

  const handleSlotClick = (courtId: string, time: string) => {
    setSelectedSlot({ courtId, time });
    setModalOpen(true);
  };

  const handleAddBooking = (booking: Omit<Booking, 'id'>) => {
    const newBooking = {
      ...booking,
      id: Date.now().toString(),
    };
    setBookings([...bookings, newBooking]);
    setModalOpen(false);
  };

  const handleDeleteBooking = (id: string) => {
    setBookings(bookings.filter(b => b.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="mb-6">Управление бронированием кортов</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="font-medium">Выберите дату:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        <BookingCalendar
          selectedDate={selectedDate}
          bookings={bookings}
          onSlotClick={handleSlotClick}
          onDeleteBooking={handleDeleteBooking}
        />

        {modalOpen && selectedSlot && (
          <BookingModal
            courtId={selectedSlot.courtId}
            time={selectedSlot.time}
            date={selectedDate}
            onClose={() => setModalOpen(false)}
            onSave={handleAddBooking}
          />
        )}
      </div>
    </div>
  );
}