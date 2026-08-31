import { useEffect, useState } from 'react';
import { Music, Home, Pencil, Eye, LogIn, LogOut, ShieldCheck, Moon, Sun, UserCircle } from 'lucide-react';
import type { Teacher, Lesson } from '@/types';
import { weekdayName, formatTime } from '@/types';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/useTheme';
import TeachersView from '@/components/TeachersView';
import LessonsView from '@/components/LessonsView';
import HomeworkView from '@/components/HomeworkView';
import AuthModal from '@/components/AuthModal';
import AdminPanel from '@/components/AdminPanel';
import ChangePasswordModal from '@/components/ChangePasswordModal';

type View = 'teachers' | 'lessons' | 'homework';

type MyProfile = {
  teacher_id: string;
  display_name: string;
  is_admin: boolean;
  must_change_password: boolean;
};

function App() {
  const { theme, toggle } = useTheme();
  const [view, setView] = useState<View>('teachers');
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [session, setSession] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  const checkAdmin = async () => {
    const { data } = await supabase.rpc('is_current_admin');
    setIsAdmin(!!data);
    return !!data;
  };

  const loadProfile = async () => {
    const { data } = await supabase.rpc('get_my_teacher_profile') as { data: MyProfile[] | null };
    if (data && data.length > 0) {
      setMyProfile(data[0]);
      if (data[0].must_change_password) {
        setForcePasswordChange(true);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
      if (data.session) {
        checkAdmin();
        loadProfile();
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(!!sess);
      if (sess) {
        (async () => {
          await checkAdmin();
          await loadProfile();
          if (event === 'PASSWORD_RECOVERY') {
            setForcePasswordChange(true);
          }
        })();
      } else {
        setIsAdmin(false);
        setMyProfile(null);
        setEditMode(false);
        setForcePasswordChange(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setEditMode(false);
    setIsAdmin(false);
    setMyProfile(null);
  };

  const openTeacher = (t: Teacher) => {
    setTeacher(t);
    setLesson(null);
    setView('lessons');
  };

  const openLesson = (l: Lesson) => {
    setLesson(l);
    setView('homework');
  };

  const goTeachers = () => {
    setView('teachers');
    setTeacher(null);
    setLesson(null);
  };

  const goLessons = () => {
    if (!teacher) return goTeachers();
    setView('lessons');
    setLesson(null);
  };

  return (
    <div className="min-h-screen bg-stone-100 transition-colors dark:bg-slate-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/85 backdrop-blur dark:border-slate-700 dark:bg-slate-800/85">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            onClick={goTeachers}
            className="group flex items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm transition-transform group-hover:scale-105">
              <Music size={22} strokeWidth={2} />
            </span>
            <span>
              <span className="block font-display text-xl font-semibold leading-none text-slate-900 sm:text-2xl dark:text-slate-100">
                Расписание и задания
              </span>
              <span className="hidden text-xs font-medium uppercase tracking-widest text-amber-700 sm:block dark:text-amber-400">
                Музыкальная школа № 1 им. Н. Г. Сабитова
              </span>
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={toggle}
              className="flex items-center justify-center rounded-full bg-stone-100 p-2.5 text-slate-600 ring-1 ring-inset ring-stone-300 transition-colors hover:bg-stone-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-600"
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {session ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => setAdminOpen(true)}
                    className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 sm:px-4 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <ShieldCheck size={16} /> <span className="hidden sm:inline">Админка</span>
                  </button>
                )}
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    editMode
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-stone-100 text-slate-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600'
                  }`}
                >
                  {editMode ? <Eye size={16} /> : <Pencil size={16} />}
                  <span className="hidden sm:inline">{editMode ? 'Просмотр' : 'Редактировать'}</span>
                </button>
                {myProfile && (
                  <span className="hidden items-center gap-1.5 rounded-full bg-stone-100 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-stone-300 sm:flex dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">
                    <UserCircle size={16} /> {myProfile.display_name}
                  </span>
                )}
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-inset ring-stone-300 transition-colors hover:bg-stone-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-600"
                >
                  <LogOut size={16} /> <span className="hidden sm:inline">Выйти</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-inset ring-stone-300 transition-colors hover:bg-stone-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-600"
              >
                <LogIn size={16} /> <span className="hidden sm:inline">Вход</span><span className="sm:hidden">Вход</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <li>
            <button
              onClick={goTeachers}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-stone-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <Home size={14} /> Преподаватели
            </button>
          </li>
          {teacher && (
            <>
              <li className="text-stone-400 dark:text-slate-600">/</li>
              <li>
                <button
                  onClick={goLessons}
                  className="rounded-md px-2 py-1 font-medium hover:bg-stone-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  {teacher.name}
                </button>
              </li>
            </>
          )}
          {lesson && view === 'homework' && (
            <>
              <li className="text-stone-400 dark:text-slate-600">/</li>
              <li className="rounded-md px-2 py-1 font-medium text-slate-800 dark:text-slate-200">
                {[
                  weekdayName(lesson.weekday),
                  formatTime(lesson.start_time),
                  lesson.class_name,
                  lesson.classroom,
                ].filter(Boolean).join(' · ') || 'Класс'}
              </li>
            </>
          )}
        </ol>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {view === 'teachers' && (
          <TeachersView editMode={editMode} onOpen={openTeacher} isAdmin={isAdmin} myProfile={myProfile} />
        )}
        {view === 'lessons' && teacher && (
          <LessonsView teacher={teacher} editMode={editMode} onOpen={openLesson} isAdmin={isAdmin} myProfile={myProfile} />
        )}
        {view === 'homework' && lesson && (
          <HomeworkView lesson={lesson} editMode={editMode} isAdmin={isAdmin} myProfile={myProfile} />
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-center text-xs text-slate-400 sm:px-6 dark:text-slate-500">
        Домашние задания музыкальной школы
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => setEditMode(true)}
      />

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}

      {forcePasswordChange && session && (
        <ChangePasswordModal
          forced
          onClose={() => setForcePasswordChange(false)}
          onChanged={() => {
            setForcePasswordChange(false);
            setMyProfile((prev) => prev ? { ...prev, must_change_password: false } : prev);
          }}
        />
      )}
    </div>
  );
}

export default App;
