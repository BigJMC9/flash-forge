import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { StatusBar } from './StatusBar';
import { cn } from './ui/utils';
import {
  BookOpen,
  Folder,
  Gamepad2,
  GraduationCap,
  Home,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  MessageSquareText,
  PenTool,
  ScrollText,
  Settings,
  Shield,
  Upload,
  UserPlus,
} from 'lucide-react';

function isRouteActive(currentPath: string, targetPath: string): boolean {
  if (targetPath === '/') {
    return currentPath === '/';
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function Layout({ children }: { children: ReactNode }) {
  const {
    appTitle,
    currentCollection,
    currentDeck,
    currentUser,
    dashboard,
    isAuthenticated,
    isAdmin,
    isLoading,
    logout,
    pendingInvites,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const publicNavItems = [{ path: '/', label: 'Home', icon: Home }];

  const appNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/collections', label: 'Collections', icon: Folder },
    { path: '/dictionary', label: 'Dictionary', icon: BookOpen },
    { path: '/composer', label: 'Composer', icon: PenTool },
    { path: '/global-library', label: 'Global Library', icon: Library },
    { path: '/import-export', label: 'Import / Export', icon: Upload },
  ];

  const navItems = isAuthenticated
    ? [...publicNavItems, ...appNavItems]
    : publicNavItems;

  const handleLogout = async () => {
    const didLogout = await logout();
    if (didLogout) {
      navigate('/', { replace: true });
    }
  };

  const sidebarVisible = isAuthenticated;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200 bg-white">
        <div className="w-full px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">{appTitle}</h1>
              {isAuthenticated ? (
                currentDeck ? (
                  <p className="mt-1 text-sm text-gray-600">
                    Context: {currentCollection?.name ?? currentDeck.collection_name} /{' '}
                    {currentDeck.name}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">
                    Signed in as {currentUser?.username}. Select a deck to start revision,
                    practice, reading, and conversation.
                  </p>
                )
              ) : (
                <p className="mt-1 text-sm text-gray-600">
                  Multi-user Japanese deck building, reading, and collaboration.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAuthenticated ? (
                <>
                  <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                    {currentUser?.username}
                    {currentUser?.can_use_ai ? ' · AI' : ' · No AI'}
                    {currentUser?.can_use_ocr ? ' · OCR' : ' · No OCR'}
                  </div>
                  <Link to="/account" className="app-btn-secondary">
                    <Settings className="h-4 w-4" />
                    Account
                    {pendingInvites.length > 0 && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                        {pendingInvites.length}
                      </span>
                    )}
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  <button onClick={() => void handleLogout()} className="app-btn-secondary">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="app-btn-secondary">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link to="/register" className="app-btn-primary">
                    <UserPlus className="h-4 w-4" />
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          {isAuthenticated && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Collections', value: dashboard.collection_count },
                { label: 'Decks', value: dashboard.deck_count },
                { label: 'Deck Cards', value: dashboard.card_count },
                { label: 'Global Cards', value: dashboard.global_card_count },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="text-sm font-semibold text-gray-900">{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {sidebarVisible && isLoading && (
            <p className="mt-3 text-sm text-gray-600">Loading workspace…</p>
          )}
        </div>
      </header>

      <div className={cn('w-full', sidebarVisible ? 'flex' : '')}>
        {sidebarVisible && (
          <aside className="min-h-[calc(100vh-89px)] w-64 shrink-0 border-r border-gray-200 bg-white">
            <nav className="space-y-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(location.pathname, item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn('app-nav-link', active && 'app-nav-link-active')}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {currentDeck && (
                <div className="mt-4 space-y-1 border-t border-gray-200 pt-4">
                  <p className="mb-2 px-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                    Current Deck
                  </p>
                  <Link
                    to={`/deck/${currentDeck.id}`}
                    className={cn(
                      'app-nav-link',
                      isRouteActive(location.pathname, `/deck/${currentDeck.id}`) &&
                        'app-nav-link-active',
                    )}
                  >
                    <Folder className="h-4 w-4" />
                    <span>Deck Operations</span>
                  </Link>
                  <Link
                    to={`/revision/${currentDeck.id}`}
                    className={cn(
                      'app-nav-link',
                      isRouteActive(location.pathname, `/revision/${currentDeck.id}`) &&
                        'app-nav-link-active',
                    )}
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Revision</span>
                  </Link>
                  <Link
                    to={`/practice/${currentDeck.id}`}
                    className={cn(
                      'app-nav-link',
                      isRouteActive(location.pathname, `/practice/${currentDeck.id}`) &&
                        'app-nav-link-active',
                    )}
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>Practice</span>
                  </Link>
                  <Link
                    to={`/reading/${currentDeck.id}`}
                    className={cn(
                      'app-nav-link',
                      isRouteActive(location.pathname, `/reading/${currentDeck.id}`) &&
                        'app-nav-link-active',
                    )}
                  >
                    <ScrollText className="h-4 w-4" />
                    <span>Reading</span>
                  </Link>
                  <Link
                    to={`/conversation/${currentDeck.id}`}
                    className={cn(
                      'app-nav-link',
                      isRouteActive(location.pathname, `/conversation/${currentDeck.id}`) &&
                        'app-nav-link-active',
                    )}
                  >
                    <MessageSquareText className="h-4 w-4" />
                    <span>Conversation</span>
                  </Link>
                </div>
              )}
            </nav>
          </aside>
        )}

        <main className={sidebarVisible ? 'min-w-0 flex-1 p-6' : 'w-full p-6'}>
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
