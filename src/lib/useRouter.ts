import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { view: 'teachers' }
  | { view: 'lessons'; teacherId: string }
  | { view: 'homework'; teacherId: string; lessonId: string };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);

  if (parts.length >= 3 && parts[0] === 'homework') {
    return { view: 'homework', teacherId: parts[1], lessonId: parts[2] };
  }
  if (parts.length >= 2 && parts[0] === 'lessons') {
    return { view: 'lessons', teacherId: parts[1] };
  }
  return { view: 'teachers' };
}

export function routeToHash(route: Route): string {
  if (route.view === 'homework') return `#/homework/${route.teacherId}/${route.lessonId}`;
  if (route.view === 'lessons') return `#/lessons/${route.teacherId}`;
  return '#/teachers';
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((r: Route) => {
    const hash = routeToHash(r);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setRoute(r);
    }
  }, []);

  return { route, navigate };
}
