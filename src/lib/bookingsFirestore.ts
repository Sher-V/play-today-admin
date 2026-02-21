import { getFirestoreDb } from './firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  Timestamp,
} from 'firebase/firestore';
import type { CourtDoc } from '../types/club-slots';
import type { BookingType } from '../types/club-slots';
import { activityTypes } from '../App';
import type { Booking } from '../App';

const COLLECTION_CLUBS = 'clubs';
const SUBCOLLECTION_BOOKINGS = 'bookings';

/** Маппинг названия активности (из формы) в тип брони в Firestore */
const ACTIVITY_TO_TYPE: Record<string, BookingType> = {
  'Разовая бронь корта': 'one_time',
  'Группа': 'group',
  'Регулярная бронь корта': 'regular',
  'Турнир': 'tournament',
};

function activityToType(activity: string): BookingType {
  return ACTIVITY_TO_TYPE[activity] ?? 'one_time';
}

function typeToActivity(type: string): string {
  const entry = Object.entries(ACTIVITY_TO_TYPE).find(([, t]) => t === type);
  return entry ? entry[0] : 'Разовая бронь корта';
}

function getColorForActivity(activity: string): string {
  const found = activityTypes.find((a) => a.name === activity);
  return found?.color ?? '#7dd3fc';
}

/** date YYYY-MM-DD + time HH:mm -> Firestore Timestamp */
function toTimestamp(dateStr: string, timeStr: string): Timestamp {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return Timestamp.fromDate(date);
}

/** Firestore Timestamp -> date YYYY-MM-DD и time HH:mm */
function fromTimestamp(ts: { toDate: () => Date }): { date: string; time: string } {
  const d = ts.toDate();
  const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return { date, time };
}

/** Загрузить брони клуба из Firestore. courtId в документе — id корта; в Booking возвращаем имя корта для отображения. */
export async function getBookings(clubId: string, courts: CourtDoc[]): Promise<Booking[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const courtById = new Map(courts.map((c) => [c.id, c.name]));

  const bookingsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_BOOKINGS);
  const q = query(bookingsRef, orderBy('startTime', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    const start = data.startTime as Timestamp;
    const end = data.endTime as Timestamp;
    const startParsed = start ? fromTimestamp(start) : { date: '', time: '' };
    const endParsed = end ? fromTimestamp(end) : { date: '', time: '' };
    const activity = typeToActivity(data.type ?? 'one_time');
    const courtName = courtById.get(data.courtId as string) ?? (data.courtId as string);

    const status = data.status as 'hold' | 'confirmed' | 'canceled' | undefined;
    const coach = data.coach as string | undefined;
    return {
      id: d.id,
      courtId: courtName,
      date: startParsed.date,
      startTime: startParsed.time,
      endTime: endParsed.time,
      activity,
      comment: (data.comment as string) ?? '',
      color: getColorForActivity(activity),
      ...(status && (status === 'hold' || status === 'confirmed' || status === 'canceled') ? { status } : {}),
      ...(coach != null && coach !== '' ? { coach } : {}),
    } as Booking;
  });
}

/** Найти id корта по имени (Корт 1, Корт 2, ...). */
function courtNameToId(courtName: string, courts: CourtDoc[]): string | null {
  const c = courts.find((x) => x.name === courtName);
  return c?.id ?? null;
}

/** Добавить бронь в Firestore. booking.courtId — имя корта для отображения; в Firestore сохраняем id документа корта. */
export async function addBookingToFirestore(
  clubId: string,
  booking: Omit<Booking, 'id'>,
  courts: CourtDoc[]
): Promise<string> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase не настроен');

  const courtDocId = courtNameToId(booking.courtId, courts);
  if (!courtDocId) throw new Error(`Корт не найден: ${booking.courtId}`);

  const startTime = toTimestamp(booking.date, booking.startTime);
  const endTime = toTimestamp(booking.date, booking.endTime);
  const type = activityToType(booking.activity);

  const payload: Record<string, unknown> = {
    courtId: courtDocId,
    type,
    startTime,
    endTime,
    comment: booking.comment ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (booking.status && (booking.status === 'hold' || booking.status === 'confirmed' || booking.status === 'canceled')) {
    payload.status = booking.status;
  }
  if (type === 'group' && booking.coach != null && booking.coach.trim() !== '') {
    payload.coach = booking.coach.trim();
  }
  const ref = await addDoc(collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_BOOKINGS), payload);

  return ref.id;
}

/** Обновить бронь в Firestore. */
export async function updateBookingInFirestore(
  clubId: string,
  bookingId: string,
  booking: Omit<Booking, 'id'>,
  courts: CourtDoc[]
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase не настроен');

  const courtDocId = courtNameToId(booking.courtId, courts);
  if (!courtDocId) throw new Error(`Корт не найден: ${booking.courtId}`);

  const startTime = toTimestamp(booking.date, booking.startTime);
  const endTime = toTimestamp(booking.date, booking.endTime);
  const type = activityToType(booking.activity);

  const payload: Record<string, unknown> = {
    courtId: courtDocId,
    type,
    startTime,
    endTime,
    comment: booking.comment ?? '',
    updatedAt: serverTimestamp(),
  };
  if (booking.status && (booking.status === 'hold' || booking.status === 'confirmed' || booking.status === 'canceled')) {
    payload.status = booking.status;
  }
  if (type === 'group' && booking.coach != null && booking.coach.trim() !== '') {
    payload.coach = booking.coach.trim();
  } else if (type === 'group') {
    payload.coach = '';
  }
  const docRef = doc(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_BOOKINGS, bookingId);
  await updateDoc(docRef, payload);
}

/** Удалить бронь из Firestore. */
export async function deleteBookingFromFirestore(clubId: string, bookingId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase не настроен');

  const docRef = doc(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_BOOKINGS, bookingId);
  await deleteDoc(docRef);
}
