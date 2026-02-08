import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getStoredClub, saveClub, clearClub } from '../lib/clubStorage';
import { getClubByUserIdOrEmail, getCourts, ensureCourts } from '../lib/clubsFirestore';
import {
  getBookings,
  addBookingToFirestore,
  updateBookingInFirestore,
  deleteBookingFromFirestore,
} from '../lib/bookingsFirestore';
import type { ClubData } from '../lib/clubStorage';
import type { CourtDoc } from '../types/club-slots';
import { BookingCalendar } from '../components/BookingCalendar';
import { BookingModal, type BookingSaveOptions } from '../components/BookingModal';
import { createPaymentLink } from '../lib/yookassa';
import { DatePicker } from '../components/DatePicker';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, LogOut } from 'lucide-react';
import type { Booking } from '../App';

export function MainPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [courts, setCourts] = useState<CourtDoc[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ courtId: string; time: string; duration?: number; date?: string } | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser ? { uid: firebaseUser.uid } : null);
      try {
        if (firebaseUser) {
          let stored = getStoredClub();
          if (!stored) {
            try {
              const c = await getClubByUserIdOrEmail(firebaseUser.uid, firebaseUser.email ?? null);
              if (c) {
                saveClub(c);
                stored = c;
              }
            } catch {
              stored = null;
            }
          }
          setClub(stored);
        } else {
          setClub(null);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    });
    const timeout = setTimeout(() => {
      if (!cancelled) setAuthChecked(true);
    }, 5000);
    return () => {
      cancelled = true;
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  // Загрузка кортов и броней из Firestore при наличии клуба с clubId
  // Если кортов нет, но у клуба указано courtsCount — создаём подколлекцию courts (для старых клубов)
  useEffect(() => {
    if (!club?.clubId) {
      setCourts([]);
      setBookings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let courtsList = await getCourts(club.clubId!);
      if (cancelled) return;
      if (courtsList.length === 0 && (club.courtsCount ?? 0) > 0) {
        courtsList = await ensureCourts(club.clubId!, club.courtsCount!);
        if (cancelled) return;
      }
      setCourts(courtsList);
      const list = await getBookings(club.clubId!, courtsList);
      if (cancelled) return;
      setBookings(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [club?.clubId, club?.courtsCount]);

  const handleLogout = () => {
    const auth = getFirebaseAuth();
    if (auth) signOut(auth);
    clearClub();
    setClub(null);
    setUser(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Загрузка…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Клуб не найден для этого аккаунта.</p>
          <Link to="/signup" className="text-blue-600 font-medium hover:underline">
            Зарегистрировать клуб
          </Link>
        </div>
      </div>
    );
  }

  // Список кортов: из Firestore (courts) или по количеству из клуба (Корт 1, Корт 2, ...)
  const courtNames =
    courts.length > 0
      ? courts.map((c) => c.name)
      : Array.from({ length: club.courtsCount || 1 }, (_, i) => `Корт ${i + 1}`);

  const handleSlotClick = (courtId: string, time: string, duration?: number, date?: string) => {
    setSelectedSlot({ courtId, time, duration, date });
    setEditingBooking(null);
    setModalOpen(true);
  };

  const handleBookingClick = (booking: Booking) => {
    setEditingBooking(booking);
    setSelectedSlot(null);
    setModalOpen(true);
  };

  const loadBookings = async () => {
    if (!club?.clubId || courts.length === 0) return;
    const list = await getBookings(club.clubId, courts);
    setBookings(list);
  };

  const handleAddBooking = async (booking: Omit<Booking, 'id'>, bookingId?: string, options?: BookingSaveOptions) => {
    if (!club?.clubId) {
      alert('Клуб не загружен. Обновите страницу.');
      return;
    }
    if (courts.length === 0) {
      alert('Список кортов ещё загружается или не создан. Подождите несколько секунд и попробуйте снова, либо обновите страницу.');
      return;
    }

    if (bookingId) {
      try {
        await updateBookingInFirestore(club.clubId, bookingId, booking, courts);
        await loadBookings();
        setModalOpen(false);
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Не удалось обновить бронь.');
      }
      return;
    }

    if (booking.isRecurring && booking.recurringEndDate) {
      const startDate = new Date(booking.date);
      const endDate = new Date(booking.recurringEndDate);
      let currentDate = new Date(startDate);
      let created = 0;
      const skippedDates: string[] = [];

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const hasConflict = bookings.some(b => {
          if (b.courtId !== booking.courtId || b.date !== dateStr) return false;
          const existingStart = parseInt(b.startTime.replace(':', ''));
          const existingEnd = parseInt(b.endTime.replace(':', ''));
          const newStart = parseInt(booking.startTime.replace(':', ''));
          const newEnd = parseInt(booking.endTime.replace(':', ''));
          return (newStart < existingEnd && newEnd > existingStart);
        });
        if (!hasConflict) {
          try {
            await addBookingToFirestore(
              club.clubId,
              { ...booking, date: dateStr },
              courts
            );
            created++;
          } catch {
            skippedDates.push(new Date(dateStr).toLocaleDateString('ru-RU'));
          }
        } else {
          skippedDates.push(new Date(dateStr).toLocaleDateString('ru-RU'));
        }
        currentDate.setDate(currentDate.getDate() + 7);
      }

      await loadBookings();
      setModalOpen(false);
      if (created === 0) {
        alert('Не удалось создать ни одного бронирования. Все выбранные слоты уже заняты или произошла ошибка.');
      } else if (skippedDates.length > 0) {
        alert(`Создано бронирований: ${created}\n\nПропущено дат: ${skippedDates.length}\n(${skippedDates.slice(0, 5).join(', ')}${skippedDates.length > 5 ? '...' : ''})`);
      } else {
        alert(`Успешно создано ${created} регулярных бронирований!`);
      }
      return;
    }

    const hasConflict = bookings.some(b => {
      if (b.courtId !== booking.courtId || b.date !== booking.date) return false;
      const existingStart = parseInt(b.startTime.replace(':', ''));
      const existingEnd = parseInt(b.endTime.replace(':', ''));
      const newStart = parseInt(booking.startTime.replace(':', ''));
      const newEnd = parseInt(booking.endTime.replace(':', ''));
      return (newStart < existingEnd && newEnd > existingStart);
    });
    if (hasConflict) {
      alert('Этот временной слот уже занят. Пожалуйста, выберите другое время.');
      return;
    }

    try {
      await addBookingToFirestore(club.clubId, booking, courts);
      await loadBookings();

      if (options?.needPaymentLink) {
        try {
          const description = `Бронь корта: ${booking.courtId}, ${booking.date} ${booking.startTime}–${booking.endTime}. ${booking.comment}`.slice(0, 128);
          const url = await createPaymentLink({
            amount: options.amount,
            description,
          });
          setPaymentLink(url);
        } catch (e) {
          console.error(e);
          alert(e instanceof Error ? e.message : 'Не удалось создать ссылку на оплату. Бронирование сохранено.');
          setModalOpen(false);
        }
      } else {
        setModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Не удалось сохранить бронь.');
    }
  };

  const handleCloseModal = () => {
    setPaymentLink(null);
    setModalOpen(false);
    setSelectedSlot(null);
    setEditingBooking(null);
  };

  const handleDeleteBooking = async (id: string) => {
    if (!club?.clubId) return;
    try {
      await deleteBookingFromFirestore(club.clubId, id);
      setBookings(bookings.filter(b => b.id !== id));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Не удалось удалить бронь.');
    }
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="mb-6">Управление бронированием кортов</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 truncate max-w-[200px]" title={club.name}>
              {club.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
        <div className="mb-6 -mt-2">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode('day')}
              >
                <Calendar className="w-5 h-5" />
                <span>Дневной вид</span>
              </button>
              <button
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode('week')}
              >
                <CalendarDays className="w-5 h-5" />
                <span>Расписание по неделям</span>
              </button>
            </div>

            {viewMode === 'day' && (
              <div className="flex items-center gap-4 mb-3">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  onClick={() => handleDateChange('prev')}
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Предыдущая неделя</span>
                </button>
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-medium text-gray-600">Выберите дату:</span>
                    <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
                  </div>
                </div>
                <button
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  onClick={() => handleDateChange('next')}
                >
                  <span>Следующая неделя</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {viewMode === 'day' ? (
            <BookingCalendar
              courts={courtNames}
              selectedDate={selectedDate}
              bookings={bookings}
              onSlotClick={handleSlotClick}
              onDeleteBooking={handleDeleteBooking}
              onBookingClick={handleBookingClick}
            />
          ) : (
            <WeeklySchedule
              courts={courtNames}
              selectedDate={selectedDate}
              bookings={bookings}
              onWeekChange={handleDateChange}
              onBookingClick={handleBookingClick}
              onSlotClick={handleSlotClick}
            />
          )}

          {modalOpen && (selectedSlot || editingBooking || paymentLink) && (
            <BookingModal
              courts={courtNames}
              courtId={editingBooking?.courtId || selectedSlot?.courtId || ''}
              time={editingBooking?.startTime || selectedSlot?.time || ''}
              date={editingBooking?.date || selectedSlot?.date || selectedDate}
              initialDuration={selectedSlot?.duration}
              existingBooking={editingBooking || undefined}
              paymentLink={paymentLink}
              onClose={handleCloseModal}
              onSave={handleAddBooking}
            />
          )}
        </div>
      </div>
    </div>
  );
}
