import { getFirestoreDb } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs, orderBy, type DocumentSnapshot } from 'firebase/firestore';
import type { ClubData } from './clubStorage';
import type { CourtDoc, ClubPricing } from '../types/club-slots';

const COLLECTION_CLUBS = 'clubs';
const SUBCOLLECTION_COURTS = 'courts';

export interface ClubDocument extends ClubData {
  userId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Сохраняет клуб в Firestore и создаёт подколлекцию courts (Корт 1, Корт 2, ...). Возвращает clubId. */
export async function saveClubToFirestore(data: ClubData, userId: string): Promise<string> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase не настроен. Задайте переменные VITE_FIREBASE_* в .env');
  }

  const now = serverTimestamp();
  const payload: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    city: data.city ?? '',
    yandexMapsUrl: data.yandexMapsUrl ?? '',
    courtsCount: data.courtsCount,
    openingTime: data.openingTime,
    closingTime: data.closingTime,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  if (data.pricing && (data.pricing.weekday?.length > 0 || data.pricing.weekend?.length > 0)) {
    payload.pricing = data.pricing;
  }
  const docRef = await addDoc(collection(db, COLLECTION_CLUBS), payload);

  const clubId = docRef.id;

  // Подколлекция courts: clubs/{clubId}/courts (Корт 1, Корт 2, ... по courtsCount)
  const courtsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_COURTS);
  for (let i = 1; i <= data.courtsCount; i++) {
    await addDoc(courtsRef, {
      name: `Корт ${i}`,
      order: i,
      createdAt: now,
      updatedAt: now,
    });
  }

  return clubId;
}

function parsePricingFromDoc(raw: unknown): ClubPricing | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const weekday = Array.isArray(o.weekday)
    ? (o.weekday as unknown[]).map((x) => {
        const t = x as Record<string, unknown>;
        return {
          startTime: String(t?.startTime ?? '08:00'),
          endTime: String(t?.endTime ?? '22:00'),
          priceRub: Number(t?.priceRub) || 0,
        };
      })
    : [];
  const weekend = Array.isArray(o.weekend)
    ? (o.weekend as unknown[]).map((x) => {
        const t = x as Record<string, unknown>;
        return {
          startTime: String(t?.startTime ?? '08:00'),
          endTime: String(t?.endTime ?? '22:00'),
          priceRub: Number(t?.priceRub) || 0,
        };
      })
    : [];
  return weekday.length || weekend.length ? { weekday, weekend } : undefined;
}

function docToClubData(d: DocumentSnapshot): ClubData {
  const data = d.data();
  const pricing = parsePricingFromDoc(data?.pricing);
  return {
    clubId: d.id,
    name: data?.name ?? '',
    email: data?.email ?? '',
    city: data?.city ?? '',
    yandexMapsUrl: data?.yandexMapsUrl ?? '',
    courtsCount: Number(data?.courtsCount) || 1,
    openingTime: data?.openingTime ?? '08:00',
    closingTime: data?.closingTime ?? '22:00',
    ...(pricing && { pricing }),
  };
}

export async function getClubByUserId(userId: string): Promise<ClubData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const q = query(
    collection(db, COLLECTION_CLUBS),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return docToClubData(snapshot.docs[0]);
}

/** Ищет клуб по userId, при отсутствии — по email (для старых документов без userId). */
export async function getClubByUserIdOrEmail(userId: string, email: string | null): Promise<ClubData | null> {
  const byUserId = await getClubByUserId(userId);
  if (byUserId) return byUserId;
  if (!email) return null;

  const db = getFirestoreDb();
  if (!db) return null;

  const q = query(
    collection(db, COLLECTION_CLUBS),
    where('email', '==', email)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return docToClubData(snapshot.docs[0]);
}

/** Создать корты для клуба, если подколлекция courts пуста (для старых клубов). */
export async function ensureCourts(clubId: string, courtsCount: number): Promise<CourtDoc[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const courtsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_COURTS);
  const q = query(courtsRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  if (snapshot.size > 0) return getCourts(clubId);

  const now = serverTimestamp();
  for (let i = 1; i <= courtsCount; i++) {
    await addDoc(courtsRef, {
      name: `Корт ${i}`,
      order: i,
      createdAt: now,
      updatedAt: now,
    });
  }
  return getCourts(clubId);
}

/** Список кортов клуба: clubs/{clubId}/courts (по полю order). */
export async function getCourts(clubId: string): Promise<CourtDoc[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const courtsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_COURTS);
  const q = query(courtsRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    const pricing = parsePricingFromDoc(data?.pricing);
    return {
      id: d.id,
      name: data?.name ?? '',
      order: Number(data?.order) ?? 0,
      ...(pricing && { pricing }),
      createdAt: data?.createdAt,
      updatedAt: data?.updatedAt,
    };
  });
}

/** Обновить данные клуба в Firestore и синхронизировать подколлекцию courts. */
export async function updateClubInFirestore(clubId: string, data: Partial<ClubData>): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase не настроен');

  const ref = doc(db, COLLECTION_CLUBS, clubId);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.city !== undefined) payload.city = data.city ?? '';
  if (data.yandexMapsUrl !== undefined) payload.yandexMapsUrl = data.yandexMapsUrl ?? '';
  if (data.openingTime !== undefined) payload.openingTime = data.openingTime;
  if (data.closingTime !== undefined) payload.closingTime = data.closingTime;
  if (data.courtsCount !== undefined) payload.courtsCount = data.courtsCount;
  if (data.pricing !== undefined) {
    payload.pricing = (data.pricing.weekday?.length || data.pricing.weekend?.length)
      ? data.pricing
      : { weekday: [], weekend: [] };
  }
  await updateDoc(ref, payload);

  const newCount = data.courtsCount;
  if (newCount !== undefined) {
    const courts = await getCourts(clubId);
    const now = serverTimestamp();
    const courtsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_COURTS);
    if (newCount > courts.length) {
      for (let i = courts.length + 1; i <= newCount; i++) {
        await addDoc(courtsRef, {
          name: `Корт ${i}`,
          order: i,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (newCount < courts.length) {
      const toDelete = courts.slice(newCount);
      for (const c of toDelete) {
        await deleteDoc(doc(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_COURTS, c.id));
      }
    }
  }
}
