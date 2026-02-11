import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { RegistrationForm } from '../components/RegistrationForm';
import { saveClub } from '../lib/clubStorage';
import { saveClubToFirestore } from '../lib/clubsFirestore';
import type { ClubData } from '../lib/clubStorage';

export function SignUpPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/dashboard', { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleRegistered = async (data: ClubData, userId: string) => {
    const clubId = await saveClubToFirestore(data, userId);
    saveClub({ ...data, clubId });
    navigate('/dashboard', { replace: true });
  };

  return <RegistrationForm onRegistered={handleRegistered} />;
}
