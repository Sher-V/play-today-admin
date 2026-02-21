import { Routes, Route, Navigate } from 'react-router-dom';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { MainPage } from './pages/MainPage';
import { AccountPage } from './pages/AccountPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientPage } from './pages/ClientPage';

/** Статус брони: hold — ожидает оплаты, confirmed — оплачена, canceled — отменена */
export type BookingStatus = 'hold' | 'confirmed' | 'canceled';

export interface Booking {
  id: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  comment: string;
  color: string;
  isRecurring?: boolean;
  recurringEndDate?: string;
  /** Тренер (для групповых и персональных тренировок) */
  coach?: string;
  /** ID документа клиента в подколлекции clubs/{clubId}/clients (связь с клиентом). */
  clientId?: string;
  /** ФИО клиента (для отображения, дублируется из справочника клиентов). */
  clientName?: string;
  /** Статус: confirmed — оплачена, hold — ожидает оплаты, canceled — отменена */
  status?: BookingStatus;
}

export const activityTypes = [
  { name: 'Разовая бронь корта', color: '#7dd3fc' },
  { name: 'Группа', color: '#3b82f6' },
  { name: 'Регулярная бронь корта', color: '#10b981' },
  { name: 'Турнир', color: '#fca5a5' },
  { name: 'Персональная тренировка', color: '#a78bfa' },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<MainPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/clients/:clientId" element={<ClientPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
