import React, { createContext, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AssistantContext = createContext(null);

const SECTION_MAP = [
  { match: (path) => path === '/', section: 'home' },
  { match: (path) => path.startsWith('/hub'), section: 'hub' },
  { match: (path) => path.startsWith('/wallet'), section: 'wallet' },
  { match: (path) => path.startsWith('/admin'), section: 'admin' },
  { match: (path) => path.includes('upload'), section: 'upload' }
];

const ENTITY_PATTERNS = [
  { prefix: '/track/', type: 'track' },
  { prefix: '/album/', type: 'album' },
  { prefix: '/playlist/', type: 'playlist' },
  { prefix: '/creator/', type: 'creator' },
  { prefix: '/video/', type: 'video' }
];

function resolveRole(user, profile) {
  if (!user) return 'guest';
  if (profile?.is_admin) return 'admin';
  if (profile?.is_verified_creator) return 'creator';
  return 'user';
}

function resolveSection(pathname) {
  for (const entry of SECTION_MAP) {
    if (entry.match(pathname)) return entry.section;
  }
  return 'detail';
}

function resolveEntity(pathname) {
  for (const pattern of ENTITY_PATTERNS) {
    if (pathname.startsWith(pattern.prefix)) {
      const id = pathname.slice(pattern.prefix.length).split('/')[0];
      return id ? { type: pattern.type, id } : null;
    }
  }
  return null;
}

export function AssistantProvider({ children }) {
  const location = useLocation();
  const { user, profile } = useAuth();

  const value = useMemo(() => {
    const role = resolveRole(user, profile);
    const section = resolveSection(location.pathname);
    const entity = resolveEntity(location.pathname);

    return {
      user,
      profile,
      role,
      routeContext: {
        path: location.pathname,
        search: location.search || '',
        section,
        entity
      }
    };
  }, [location.pathname, location.search, user, profile]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantContext() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistantContext must be used within an AssistantProvider');
  }
  return context;
}
