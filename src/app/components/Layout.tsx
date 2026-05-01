import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { StatusBar } from './StatusBar';
import { cn } from './ui/utils';
import type { LucideIcon } from 'lucide-react';
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
  Menu,
  MessageSquareText,
  PenTool,
  ScrollText,
  Settings,
  Shield,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
};

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  const publicNavItems: NavItem[] = [{ path: '/', label: 'Home', icon: Home }];

  const appNavItems: NavItem[] = [
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

  const currentDeckNavItems: NavItem[] = currentDeck
    ? [
        { path: `/deck/${currentDeck.id}`, label: 'Deck Operations', icon: Folder },
        { path: `/revision/${currentDeck.id}`, label: 'Revision', icon: GraduationCap },
        { path: `/practice/${currentDeck.id}`, label: 'Practice', icon: Gamepad2 },
        { path: `/reading/${currentDeck.id}`, label: 'Reading', icon: ScrollText },
        {
          path: `/conversation/${currentDeck.id}`,
          label: 'Conversation',
          icon: MessageSquareText,
        },
      ]
    : [];

  const handleLogout = async () => {
    const didLogout = await logout();
    if (didLogout) {
      navigate('/', { replace: true });
    }
  };

  const sidebarVisible = isAuthenticated;

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const active = isRouteActive(location.pathname, item.path);

    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className={cn('app-nav-link', active && 'app-nav-link-active')}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200 bg-white">
        <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
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

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {isAuthenticated ? (
                <>
                  <div className="max-w-full truncate rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                    {currentUser?.username}
                    {currentUser?.can_use_ai ? ' · AI' : ' · No AI'}
                    {currentUser?.can_use_ocr ? ' · OCR' : ' · No OCR'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(true)}
                    className="app-btn-secondary lg:hidden"
                    aria-expanded={mobileNavOpen}
                    aria-controls="mobile-navigation"
                  >
                    <Menu className="h-4 w-4" />
                    Menu
                  </button>
                  <Link to="/account" className="app-btn-secondary hidden sm:inline-flex">
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
                      className="hidden items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 sm:inline-flex"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => void handleLogout()}
                    className="app-btn-secondary hidden sm:inline-flex"
                  >
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

      {sidebarVisible && mobileNavOpen && (
        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Application navigation"
          className="fixed inset-0 z-[60] lg:hidden"
        >
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 h-full w-full bg-gray-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(22rem,calc(100vw-2rem))] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">Navigation</p>
                <p className="truncate text-xs text-gray-600">
                  {currentDeck?.name ?? currentUser?.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
              <div className="space-y-1">
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                  Workspace
                </p>
                {navItems.map(renderNavLink)}
              </div>

              {currentDeckNavItems.length > 0 && (
                <div className="space-y-1 border-t border-gray-200 pt-4">
                  <p className="mb-2 px-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                    Current Deck
                  </p>
                  {currentDeckNavItems.map(renderNavLink)}
                </div>
              )}

              <div className="space-y-2 border-t border-gray-200 pt-4">
                <Link to="/account" className="app-nav-link">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="truncate">Account</span>
                  {pendingInvites.length > 0 && (
                    <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                      {pendingInvites.length}
                    </span>
                  )}
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="app-nav-link">
                    <Shield className="h-4 w-4 shrink-0" />
                    <span className="truncate">Admin</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="app-nav-link w-full"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className={cn('w-full', sidebarVisible ? 'lg:flex' : '')}>
        {sidebarVisible && (
          <aside className="hidden min-h-[calc(100vh-89px)] w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
            <nav className="space-y-1 p-4">
              {navItems.map(renderNavLink)}

              {currentDeck && (
                <div className="mt-4 space-y-1 border-t border-gray-200 pt-4">
                  <p className="mb-2 px-3 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                    Current Deck
                  </p>
                  {currentDeckNavItems.map(renderNavLink)}
                </div>
              )}
            </nav>
          </aside>
        )}

        <main
          className={
            sidebarVisible
              ? 'min-w-0 flex-1 p-4 sm:p-5 lg:p-6'
              : 'w-full p-4 sm:p-5 lg:p-6'
          }
        >
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
