import { getFirestoreDb } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

const COLLECTION_CLUBS = 'clubs';
const SUBCOLLECTION_CLIENTS = 'clients';

export interface Client {
  id: string;
  name: string;
}

/** Загрузить список клиентов клуба (id + ФИО), отсортированный по имени. */
export async function getClients(clubId: string): Promise<Client[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const clientsRef = collection(db, COLLECTION_CLUBS, clubId, SUBCOLLECTION_CLIENTS);
  const q = query(clientsRef, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => {
      const name = (d.data().name as string)?.trim();
      return name ? { id: d.id, name } : null;
    })
    .filter((c): c is Client => c !== null);
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
