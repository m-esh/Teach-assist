import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { CoursesScreen } from './screens/Courses';
import { CourseDetail } from './screens/CourseDetail';
import { UpdatesScreen } from './screens/Updates';
import { SettingsScreen } from './screens/Settings';
import { LoginScreen } from './screens/Login';
import { LockScreen } from './screens/Lock';
import { Icon } from './components/ui';

type Tab = 'courses' | 'updates' | 'settings';

function Shell() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('courses');
  const [courseId, setCourseId] = useState<string | null>(null);

  // Hardware/browser back closes the course page.
  useEffect(() => {
    const onPop = () => setCourseId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const open = (id: string) => {
    history.pushState({ course: id }, '');
    setCourseId(id);
    window.scrollTo(0, 0);
  };
  const back = () => {
    if (history.state?.course) history.back();
    else setCourseId(null);
  };

  if (store.phase === 'loading') return null;
  if (store.phase === 'locked') return <LockScreen />;
  if (store.phase === 'login') return <LoginScreen />;

  const course = courseId ? store.courseById(courseId) : undefined;
  const unseen = store.vault.updates.filter((u) => !u.seen).length;

  return (
    <>
      <main>
        {course ? (
          <CourseDetail key={course.id} course={course} onBack={back} />
        ) : tab === 'courses' ? (
          <CoursesScreen onOpen={open} />
        ) : tab === 'updates' ? (
          <UpdatesScreen onOpen={open} />
        ) : (
          <SettingsScreen />
        )}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {(
          [
            ['courses', 'Courses', 'book'],
            ['updates', 'Updates', 'bell'],
            ['settings', 'Settings', 'gear'],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            className={tab === id && !course ? 'active' : ''}
            onClick={() => {
              if (course) back();
              setTab(id);
              window.scrollTo(0, 0);
            }}
            aria-current={tab === id && !course ? 'page' : undefined}
          >
            <span className="tab-icon">
              <Icon name={icon} size={24} />
              {id === 'updates' && unseen > 0 && <span className="badge">{unseen > 99 ? '99+' : unseen}</span>}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
