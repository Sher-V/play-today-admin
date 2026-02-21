import { useState, useEffect, useMemo } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getStoredClub, saveClub, clearClub } from '../lib/clubStorage';
import { getClubByUserIdOrEmail, getCourts } from '../lib/clubsFirestore';
import { getBookings } from '../lib/bookingsFirestore';
import { getClients, updateClient, type Client } from '../lib/clientsFirestore';
import type { ClubData } from '../lib/clubStorage';
import type { Booking } from '../App';
import { LogOut, User, ChevronLeft, Pencil, X } from 'lucide-react';

const statusLabel: Record<string, string> = {
  hold: 'Ожидает оплаты',
  confirmed: 'Оплачена',
  canceled: 'Отменена',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function ClientPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [user, setUser] = useState<{ uid: string; email?: string | null } | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const client = useMemo(
    () => (clientId ? clients.find((c) => c.id === clientId) : null),
    [clientId, clients]
  );

  const clientBookings = useMemo(() => {
    if (!clientId) return [];
    return bookings
      .filter((b) => b.clientId === clientId)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.startTime.localeCompare(b.startTime);
      });
  }, [bookings, clientId]);

  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredBookings = useMemo(() => {
    if (!statusFilter) return clientBookings;
    return clientBookings.filter((b) => (b.status ?? '') === statusFilter);
  }, [clientBookings, statusFilter]);

  const startEditing = () => {
    if (client) {
      setEditName(client.name);
      setEditContact(client.contact ?? '');
      setSaveError('');
      setEditing(true);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError('');
  };

  const handleSaveClient = async () => {
    if (!club?.clubId || !clientId || !editName.trim()) return;
    setSaveError('');
    setSaving(true);
    try {
      await updateClient(club.clubId, clientId, {
        name: editName.trim(),
        contact: editContact.trim() || undefined,
      });
      const list = await getClients(club.clubId);
      setClients(list);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthChecked(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email ?? null } : null);
      if (!firebaseUser) {
        setClub(null);
        setAuthChecked(true);
        setLoading(false);
        return;
      }
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
      setClub(stored ?? null);
      setAuthChecked(true);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!club?.clubId || !clientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getCourts(club.clubId), getClients(club.clubId)])
      .then(([courtsList, clientsList]) => {
        if (cancelled) return undefined;
        setClients(clientsList);
        return getBookings(club.clubId!, courtsList);
      })
      .then((bookingsList) => {
        if (!cancelled && Array.isArray(bookingsList)) setBookings(bookingsList);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [club?.clubId, clientId]);

  const handleLogout = () => {
    clearClub();
    getFirebaseAuth()?.signOut();
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

  if (!clientId) {
    return <Navigate to="/clients" replace />;
  }

  if (!loading && !client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-4">
          <Link to="/clients" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-4">
            <ChevronLeft className="w-4 h-4" />
            К списку клиентов
          </Link>
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            Клиент не найден.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold">Карточка клиента</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 truncate max-w-[200px]" title={club.name}>
              {club.name}
            </span>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Расписание
            </Link>
            <Link
              to="/clients"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Клиенты
            </Link>
            <Link
              to="/account"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title="Аккаунт"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Аккаунт</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>

        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          К списку клиентов
        </Link>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : client ? (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              {!editing ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{client.name}</h2>
                      {client.contact ? (
                        <p className="text-sm text-gray-700 mt-1">
                          Контакт:{' '}
                          {client.contact.startsWith('http') || client.contact.startsWith('@') || /^\+?\d[\d\s-]+$/.test(client.contact) ? (
                            <a
                              href={client.contact.startsWith('http') ? client.contact : client.contact.startsWith('@') ? `https://t.me/${client.contact.slice(1)}` : `tel:${client.contact.replace(/\s/g, '')}`}
                              target={client.contact.startsWith('http') || client.contact.startsWith('@') ? '_blank' : undefined}
                              rel={client.contact.startsWith('http') || client.contact.startsWith('@') ? 'noopener noreferrer' : undefined}
                              className="text-blue-600 hover:underline"
                            >
                              {client.contact}
                            </a>
                          ) : (
                            <span>{client.contact}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">Контакт не указан</p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        Всего бронирований: {clientBookings.length}
                        {clientBookings.some((b) => b.status !== 'canceled') && (
                          <span className="ml-2">
                            (активных: {clientBookings.filter((b) => b.status !== 'canceled').length})
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startEditing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Редактировать
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ФИО клиента"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Контакт</label>
                    <input
                      type="text"
                      value={editContact}
                      onChange={(e) => setEditContact(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Телефон, Telegram, email..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Если клиент из бота, контакт можно взять из бота и вставить сюда</p>
                  </div>
                  {saveError && (
                    <p className="text-sm text-red-600" role="alert">{saveError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveClient}
                      disabled={saving || !editName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h3 className="text-base font-medium text-gray-700">Бронирования</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Все статусы</option>
                <option value="confirmed">{statusLabel.confirmed}</option>
                <option value="hold">{statusLabel.hold}</option>
                <option value="canceled">{statusLabel.canceled}</option>
              </select>
              {statusFilter && (
                <span className="text-sm text-gray-500">
                  Показано: {filteredBookings.length} из {clientBookings.length}
                </span>
              )}
            </div>
            {clientBookings.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                У этого клиента пока нет бронирований.
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                Нет бронирований с выбранным статусом.
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-full">
                <table className="w-full max-w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-700 w-[1%] whitespace-nowrap">Дата</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 w-[1%] whitespace-nowrap">Корт</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 w-[1%] whitespace-nowrap">Время</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Активность</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 w-[1%] whitespace-nowrap">Статус</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-0">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 align-top whitespace-nowrap">{formatDate(b.date)}</td>
                        <td className="py-3 px-4 text-gray-700 align-top break-words">{b.courtId}</td>
                        <td className="py-3 px-4 text-gray-700 align-top whitespace-nowrap">{b.startTime}–{b.endTime}</td>
                        <td className="py-3 px-4 text-gray-700 align-top break-words">{b.activity}</td>
                        <td className="py-3 px-4 align-top">
                          <span
                            className={
                              b.status === 'canceled'
                                ? 'text-gray-500'
                                : b.status === 'confirmed'
                                  ? 'text-green-600'
                                  : 'text-amber-600'
                            }
                          >
                            {b.status ? statusLabel[b.status] ?? b.status : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 align-top break-words min-w-0">
                          {b.comment?.trim() || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
