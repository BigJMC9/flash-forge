import type { ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { useApp } from './contexts/AppContext';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Collections } from './pages/Collections';
import { Dictionary } from './pages/Dictionary';
import { Composer } from './pages/Composer';
import { Formats } from './pages/Formats';
import { GlobalLibrary } from './pages/GlobalLibrary';
import { DeckOperations } from './pages/DeckOperations';
import { Revision } from './pages/Revision';
import { Practice } from './pages/Practice';
import { ImportExport } from './pages/ImportExport';
import { Reading } from './pages/Reading';
import { Conversation } from './pages/Conversation';
import { Account } from './pages/Account';
import { AiDeckAssistant } from './pages/AiDeckAssistant';
import { Admin } from './pages/Admin';

function LoadingState() {
  return (
    <Layout>
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        Loading workspace…
      </div>
    </Layout>
  );
}

function PublicPage({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}

function PublicOnlyPage({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo;

  if (isAuthenticated) {
    return <Navigate to={redirectTo?.startsWith('/') ? redirectTo : '/dashboard'} replace />;
  }

  return <Layout>{children}</Layout>;
}

function PrivatePage({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useApp();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ redirectTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Layout>{children}</Layout>;
}

function AdminPage({ children }: { children: ReactNode }) {
  const { isAdmin, isAuthenticated, isLoading } = useApp();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ redirectTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: () => (
      <PublicPage>
        <Home />
      </PublicPage>
    ),
  },
  {
    path: '/login',
    Component: () => (
      <PublicOnlyPage>
        <Login />
      </PublicOnlyPage>
    ),
  },
  {
    path: '/register',
    Component: () => (
      <PublicOnlyPage>
        <Register />
      </PublicOnlyPage>
    ),
  },
  {
    path: '/dashboard',
    Component: () => (
      <PrivatePage>
        <Dashboard />
      </PrivatePage>
    ),
  },
  {
    path: '/collections',
    Component: () => (
      <PrivatePage>
        <Collections />
      </PrivatePage>
    ),
  },
  {
    path: '/dictionary',
    Component: () => (
      <PrivatePage>
        <Dictionary />
      </PrivatePage>
    ),
  },
  {
    path: '/composer',
    Component: () => (
      <PrivatePage>
        <Composer />
      </PrivatePage>
    ),
  },
  {
    path: '/formats',
    Component: () => (
      <PrivatePage>
        <Formats />
      </PrivatePage>
    ),
  },
  {
    path: '/global-library',
    Component: () => (
      <PrivatePage>
        <GlobalLibrary />
      </PrivatePage>
    ),
  },
  {
    path: '/deck/:deckId',
    Component: () => (
      <PrivatePage>
        <DeckOperations />
      </PrivatePage>
    ),
  },
  {
    path: '/revision/:deckId',
    Component: () => (
      <PrivatePage>
        <Revision />
      </PrivatePage>
    ),
  },
  {
    path: '/practice/:deckId',
    Component: () => (
      <PrivatePage>
        <Practice />
      </PrivatePage>
    ),
  },
  {
    path: '/reading/:deckId',
    Component: () => (
      <PrivatePage>
        <Reading />
      </PrivatePage>
    ),
  },
  {
    path: '/conversation/:deckId',
    Component: () => (
      <PrivatePage>
        <Conversation />
      </PrivatePage>
    ),
  },
  {
    path: '/ai/:deckId',
    Component: () => (
      <PrivatePage>
        <AiDeckAssistant />
      </PrivatePage>
    ),
  },
  {
    path: '/import-export',
    Component: () => (
      <PrivatePage>
        <ImportExport />
      </PrivatePage>
    ),
  },
  {
    path: '/account',
    Component: () => (
      <PrivatePage>
        <Account />
      </PrivatePage>
    ),
  },
  {
    path: '/admin',
    Component: () => (
      <AdminPage>
        <Admin />
      </AdminPage>
    ),
  },
]);
