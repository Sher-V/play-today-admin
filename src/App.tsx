import { Routes, Route, Navigate } from 'react-router-dom';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { MainPage } from './pages/MainPage';

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
}

export const activityTypes = [
  { name: 'Разовая бронь корта', color: '#7dd3fc' },
  { name: 'Группа', color: '#3b82f6' },
  { name: 'Регулярная бронь корта', color: '#10b981' },
  { name: 'Турнир', color: '#fca5a5' },
];

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={<MainPage />} />
      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
