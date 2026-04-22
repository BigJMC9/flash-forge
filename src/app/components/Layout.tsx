import { Link, useLocation } from 'react-router';
import { useApp } from '../contexts/AppContext';
import { StatusBar } from './StatusBar';
import {
  BookOpen,
  Folder,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Library,
  PenTool,
  Upload,
} from 'lucide-react';

function isRouteActive(currentPath: string, targetPath: string): boolean {
  if (targetPath === '/') {
    return currentPath === '/';
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    appTitle,
    currentCollection,
    currentDeck,
    dashboard,
    isLoading,
  } = useApp();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/collections', label: 'Collections', icon: Folder },
    { path: '/dictionary', label: 'Dictionary', icon: BookOpen },
    { path: '/composer', label: 'Composer', icon: PenTool },
    { path: '/global-library', label: 'Global Library', icon: Library },
    { path: '/import-export', label: 'Import / Export', icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="font-semibold text-lg">{appTitle}</h1>
              {currentDeck ? (
                <p className="text-sm text-gray-600 mt-1">
                  Context: {currentCollection?.name ?? currentDeck.collection_name} /{' '}
                  {currentDeck.name}
                </p>
              ) : (
                <p className="text-sm text-gray-600 mt-1">
                  Select a deck to enable review and practice flows.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm min-w-[340px]">
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
          </div>

          {isLoading && (
            <div className="mt-3 text-sm text-blue-700">Loading workspace…</div>
          )}
        </div>
      </header>

      <div className="flex">
        <nav className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-89px)]">
          <div className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(location.pathname, item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {currentDeck && (
              <div className="pt-4 mt-4 border-t border-gray-200 space-y-1">
                <div className="text-xs text-gray-500 px-4 mb-2">
                  Current Deck
                </div>
                <Link
                  to={`/deck/${currentDeck.id}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Folder className="w-5 h-5" />
                  <span>Deck Operations</span>
                </Link>
                <Link
                  to={`/revision/${currentDeck.id}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <GraduationCap className="w-5 h-5" />
                  <span>Revision</span>
                </Link>
                <Link
                  to={`/practice/${currentDeck.id}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Gamepad2 className="w-5 h-5" />
                  <span>Practice</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>

      <StatusBar />
    </div>
  );
}
