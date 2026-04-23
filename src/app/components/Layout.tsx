import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { StatusBar } from './StatusBar';
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-lg font-semibold">{appTitle}</h1>
              {isAuthenticated ? (
                currentDeck ? (
                  <p className="mt-1 text-sm text-gray-600">
                    Context: {currentCollection?.name ?? currentDeck.collection_name} /{' '}
                    {currentDeck.name}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">
                    Signed in as {currentUser?.username}. Select a deck to enable
                    revision, practice, reading, and conversation flows.
                  </p>
                )
              ) : (
                <p className="mt-1 text-sm text-gray-600">
                  Multi-user Japanese deck building, reading, and collaboration.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <>
                  <div className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
                    {currentUser?.username}
                    {currentUser?.can_use_ai ? ' · AI enabled' : ' · AI disabled'}
                  </div>
                  <Link
                    to="/account"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
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
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 hover:bg-amber-100"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => void handleLogout()}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    <UserPlus className="h-4 w-4" />
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          {isAuthenticated && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div className="text-center">
                <div className="text-gray-600">Collections</div>
                <div className="font-semibold">{dashboard.collection_count}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Decks</div>
                <div className="font-semibold">{dashboard.deck_count}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Deck Cards</div>
                <div className="font-semibold">{dashboard.card_count}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Global Cards</div>
                <div className="font-semibold">{dashboard.global_card_count}</div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="mt-3 text-sm text-blue-700">Loading workspace…</div>
          )}
        </div>
      </header>

      <div className={sidebarVisible ? 'flex' : ''}>
        {sidebarVisible && (
          <nav className="min-h-[calc(100vh-89px)] w-64 border-r border-gray-200 bg-white">
            <div className="space-y-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(location.pathname, item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {currentDeck && (
                <div className="mt-4 space-y-1 border-t border-gray-200 pt-4">
                  <div className="mb-2 px-4 text-xs text-gray-500">Current Deck</div>
                  <Link
                    to={`/deck/${currentDeck.id}`}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                      isRouteActive(location.pathname, `/deck/${currentDeck.id}`)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Folder className="h-5 w-5" />
                    <span>Deck Operations</span>
                  </Link>
                  <Link
                    to={`/revision/${currentDeck.id}`}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                      isRouteActive(location.pathname, `/revision/${currentDeck.id}`)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <GraduationCap className="h-5 w-5" />
                    <span>Revision</span>
                  </Link>
                  <Link
                    to={`/practice/${currentDeck.id}`}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                      isRouteActive(location.pathname, `/practice/${currentDeck.id}`)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Gamepad2 className="h-5 w-5" />
                    <span>Practice</span>
                  </Link>
                  <Link
                    to={`/reading/${currentDeck.id}`}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                      isRouteActive(location.pathname, `/reading/${currentDeck.id}`)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ScrollText className="h-5 w-5" />
                    <span>Reading</span>
                  </Link>
                  <Link
                    to={`/conversation/${currentDeck.id}`}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                      isRouteActive(location.pathname, `/conversation/${currentDeck.id}`)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <MessageSquareText className="h-5 w-5" />
                    <span>Conversation</span>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}

        <main className={sidebarVisible ? 'flex-1 p-6' : 'p-6'}>{children}</main>
      </div>

      <StatusBar />
    </div>
  );
}
