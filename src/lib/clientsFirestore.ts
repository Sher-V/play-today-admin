import { getFirestoreDb } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';

const COLLECTION_CLUBS = 'clubs';
const SUBCOLLECTION_CLIENTS = 'clients';

export interface Client {
  id: string;
  name: string;
  /** Контакт: телефон, Telegram и т.п. Может быть заполнен вручную или из бота. */
  contact?: string;
}

/** Загрузить список клиентов клуба (id, ФИО, контакт), отсортированный по имени. */
export async function getClients(clubId: string): Promise<Client[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const clientsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_CLIENTS);
  const q = query(clientsRef, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => {
      const data = d.data();
      const name = (data.name as string)?.trim();
      const contact = (data.contact as string)?.trim();
      return name ? { id: d.id, name, ...(contact ? { contact } : {}) } : null;
    })
    .filter((c): c is Client => c !== null);
}

/** Обновить данные клиента (ФИО и/или контакт). */
export async function updateClient(
  clubId: string,
  clientId: string,
  data: { name?: string; contact?: string }
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase не настроен');

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.contact !== undefined) payload.contact = data.contact.trim() || null;

  const docRef = doc(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_CLIENTS, clientId);
  await updateDoc(docRef, payload);
}

/** Найти или создать клиента по ФИО. Возвращает id документа клиента. Идемпотентно по имени. */
export async function ensureClient(clubId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('ФИО клиента не указано');

  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase не настроен');

  const clientsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_CLIENTS);
  const q = query(clientsRef, where('name', '==', trimmed));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  const ref = await addDoc(clientsRef, {
    name: trimmed,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
