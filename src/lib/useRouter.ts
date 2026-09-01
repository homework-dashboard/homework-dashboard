import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { view: 'teachers' }
  | { view: 'lessons'; teacherSlug: string }
  | { view: 'homework'; teacherSlug: string; lessonSlug: string }
  | { view: 'lessons-legacy'; teacherId: string }
  | { view: 'homework-legacy'; teacherId: string; lessonId: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);

  // New hierarchical URLs: prepodavateli/{teacher}/{lesson}
  if (parts.length >= 3 && parts[0] === 'prepodavateli') {
    return { view: 'homework', teacherSlug: parts[1], lessonSlug: parts[2] };
  }
  if (parts.length >= 2 && parts[0] === 'prepodavateli') {
    return { view: 'lessons', teacherSlug: parts[1] };
  }
  if (parts.length >= 1 && parts[0] === 'prepodavateli') {
    return { view: 'teachers' };
  }

  // Legacy slug URLs with /zadanie/ segment (prepodavateli/{teacher}/zadanie/{lesson})
  if (parts.length >= 4 && parts[0] === 'prepodavateli' && parts[2] === 'zadanie') {
    return { view: 'homework', teacherSlug: parts[1], lessonSlug: parts[3] };
  }

  // Legacy UUID-based URLs
  if (parts.length >= 3 && parts[0] === 'homework' && UUID_RE.test(parts[1]) && UUID_RE.test(parts[2])) {
    return { view: 'homework-legacy', teacherId: parts[1], lessonId: parts[2] };
  }
  if (parts.length >= 2 && parts[0] === 'lessons' && UUID_RE.test(parts[1])) {
    return { view: 'lessons-legacy', teacherId: parts[1] };
  }

  return { view: 'teachers' };
}

export function routeToHash(route: Route): string {
  if (route.view === 'homework') return `#/prepodavateli/${route.teacherSlug}/${route.lessonSlug}`;
  if (route.view === 'lessons') return `#/prepodavateli/${route.teacherSlug}`;
  return '#/prepodavateli';
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
