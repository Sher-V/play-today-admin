import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getStoredClub, saveClub, clearClub } from '../lib/clubStorage';
import { getClubByUserIdOrEmail } from '../lib/clubsFirestore';
import { getClients, type Client } from '../lib/clientsFirestore';
import type { ClubData } from '../lib/clubStorage';
import { LogOut, User, Search, ChevronRight } from 'lucide-react';

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<{ uid: string; email?: string | null } | null>(null);
  const [club, setClub] = useState<ClubData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email ?? null } : null);
      if (!firebaseUser) {
        setClub(null);
        setAuthChecked(true);
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
    if (!club?.clubId) return;
    let cancelled = false;
    setLoading(true);
    getClients(club.clubId)
      .then((list) => {
        if (!cancelled) setClients(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [club?.clubId]);

  const filteredClients = clients.filter((c) =>
    c.name.trim().toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  useEffect(() => {
    const q = searchQuery.trim();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) next.set('q', q);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [searchQuery, setSearchParams]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold">Клиенты</h1>
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

        <div className="mb-6 max-w-sm">
          <label htmlFor="client-search" className="block text-sm font-medium text-gray-700 mb-1.5">
            Поиск по ФИО
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              id="client-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите ФИО..."
              className="w-full pl-11 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-base transition-[border-color,box-shadow] focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-500/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            {searchQuery.trim() ? 'По вашему запросу клиенты не найдены.' : 'Пока нет клиентов. Они появятся при создании бронирований с указанием ФИО.'}
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredClients.map((client) => (
              <li key={client.id}>
                <Link
                  to={`/clients/${client.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                >
                  <span className="font-medium text-gray-900">{client.name}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && filteredClients.length > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            {filteredClients.length} {filteredClients.length === 1 ? 'клиент' : filteredClients.length < 5 ? 'клиента' : 'клиентов'}
          </p>
        )}
      </div>
    </div>
  );
}
