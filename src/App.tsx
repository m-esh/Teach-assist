import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { StoreProvider, useStore } from './store';
import { CoursesScreen } from './screens/Courses';
import { CourseDetail } from './screens/CourseDetail';
import { UpdatesScreen } from './screens/Updates';
import { SettingsScreen } from './screens/Settings';
import { LoginScreen } from './screens/Login';
import { LockScreen } from './screens/Lock';
import { TabBar } from './components/TabBar';

type Tab = 'courses' | 'updates' | 'settings';
const ORDER: Tab[] = ['courses', 'updates', 'settings'];

/** Runs a navigation inside a View Transition (slides in the direction of travel). */
function transition(dir: 'forward' | 'back' | 'none', fn: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced || dir === 'none') {
    fn();
    return;
  }
  document.documentElement.dataset.nav = dir;
  doc.startViewTransition(() => flushSync(fn));
}

function Shell() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('courses');
  const [courseId, setCourseId] = useState<string | null>(null);

  // Browser/back gesture closes the course page.
  useEffect(() => {
    const onPop = () => transition('back', () => setCourseId(null));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (id: string) => {
    history.pushState({ course: id }, '');
    transition('forward', () => {
      setCourseId(id);
      window.scrollTo(0, 0);
    });
  };
  const back = () => {
    if (history.state?.course) history.back();
    else transition('back', () => setCourseId(null));
  };
  const selectTab = (t: Tab) => {
    if (courseId) {
      if (history.state?.course) history.replaceState(null, '');
      transition('back', () => {
        setCourseId(null);
        setTab(t);
        window.scrollTo(0, 0);
      });
      return;
    }
    if (t === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    transition(ORDER.indexOf(t) > ORDER.indexOf(tab) ? 'forward' : 'back', () => {
      setTab(t);
      window.scrollTo(0, 0);
    });
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
      <TabBar
        active={tab}
        onSelect={selectTab}
        tabs={[
          { id: 'courses', label: 'Courses', icon: 'book' },
          { id: 'updates', label: 'Updates', icon: 'bell', badge: unseen },
          { id: 'settings', label: 'Settings', icon: 'gear' },
        ]}
      />
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
