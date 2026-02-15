import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { getAuthErrorMessage } from '../lib/authErrors';
import { getClubByUserIdOrEmail } from '../lib/clubsFirestore';
import { saveClub } from '../lib/clubStorage';
import { SignInForm } from '../components/SignInForm';

export function SignInPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/dashboard', { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleSignIn = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase не настроен. Задайте переменные VITE_FIREBASE_* в .env');

    try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const club = await getClubByUserIdOrEmail(user.uid, user.email ?? email);
      if (!club) throw new Error('Клуб не найден для этого аккаунта. Зарегистрируйте клуб.');
      saveClub(club);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      throw new Error(getAuthErrorMessage(err));
    }
  };

  const handleResetPassword = async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase не настроен. Задайте переменные VITE_FIREBASE_* в .env');
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      throw new Error(getAuthErrorMessage(err));
    }
  };

  return <SignInForm onSignIn={handleSignIn} onResetPassword={handleResetPassword} />;
}
