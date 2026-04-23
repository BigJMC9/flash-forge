import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  BookOpen,
  Folder,
  Library,
  MessageSquareText,
  ScrollText,
  Shield,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function Home() {
  const {
    currentUser,
    dashboard,
    decks,
    isAuthenticated,
    isAdmin,
    pendingInvites,
    setCurrentDeck,
  } = useApp();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_35%),linear-gradient(135deg,_#0f172a,_#1d4ed8)] px-8 py-14 text-white">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-blue-100">
              Flash Forge
            </p>
            <h2 className="text-4xl font-semibold leading-tight">
              Build Japanese decks, AI reading drills, and shared study spaces in
              one workspace.
            </h2>
            <p className="mt-5 max-w-2xl text-base text-blue-50">
              Sign in to manage private decks, keep a user-scoped global pool,
              collaborate on shared decks, and control AI access per account.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200/40 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Folder,
              title: 'Per-user data',
              body: 'Collections, decks, and the global library are scoped to each account by default.',
            },
            {
              icon: MessageSquareText,
              title: 'Shared decks',
              body: 'Invite collaborators onto specific decks without exposing the rest of your workspace.',
            },
            {
              icon: Shield,
              title: 'Admin controls',
              body: 'Manage accounts, reset passwords, and grant or revoke AI access from one panel.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-gray-200 bg-white p-6"
              >
                <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 text-blue-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-8">
        <p className="text-sm uppercase tracking-[0.18em] text-blue-700">
          Welcome back
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">
              {currentUser?.username}, your workspace is ready.
            </h2>
            <p className="mt-2 max-w-2xl text-gray-600">
              Use the dashboard for the full deck view, or jump directly into
              collaboration, reading, or conversation on your active deck.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-black"
            >
              Open Dashboard
            </Link>
            <Link
              to="/account"
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Account Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          {
            icon: Folder,
            label: 'Collections',
            value: dashboard.collection_count,
            tone: 'bg-blue-50 text-blue-700',
          },
          {
            icon: BookOpen,
            label: 'Decks',
            value: dashboard.deck_count,
            tone: 'bg-green-50 text-green-700',
          },
          {
            icon: Library,
            label: 'Global Cards',
            value: dashboard.global_card_count,
            tone: 'bg-orange-50 text-orange-700',
          },
          {
            icon: MessageSquareText,
            label: 'Pending Invites',
            value: pendingInvites.length,
            tone: 'bg-purple-50 text-purple-700',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl border border-gray-200 bg-white p-6"
            >
              <div className={`inline-flex rounded-xl p-3 ${item.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm text-gray-600">{item.label}</div>
              <div className="mt-1 text-3xl font-semibold">{item.value}</div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Decks</h3>
            <Link to="/collections" className="text-sm text-blue-600 hover:text-blue-700">
              Manage collections
            </Link>
          </div>
          {decks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No decks yet. Create a collection first, then add a deck.
            </div>
          ) : (
            <div className="space-y-3">
              {decks.slice(0, 6).map((deck) => (
                <div
                  key={deck.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{deck.name}</div>
                    <div className="text-sm text-gray-600">
                      {deck.collection_name} · {deck.card_count} cards ·{' '}
                      {deck.is_owner ? 'Owner' : 'Shared'}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setCurrentDeck(deck.id);
                        void navigate(`/deck/${deck.id}`);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Open Deck
                    </button>
                    <button
                      onClick={() => setCurrentDeck(deck.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Set Context
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold">AI Study Paths</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <Link
                to={decks[0] ? `/reading/${decks[0].id}` : '/dashboard'}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="flex items-center gap-3">
                  <ScrollText className="h-4 w-4 text-blue-700" />
                  Reading scenarios
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={decks[0] ? `/conversation/${decks[0].id}` : '/dashboard'}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="flex items-center gap-3">
                  <MessageSquareText className="h-4 w-4 text-blue-700" />
                  Conversation scenarios
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pending Invites</h3>
              <Link to="/account" className="text-sm text-blue-600 hover:text-blue-700">
                View account
              </Link>
            </div>
            {pendingInvites.length === 0 ? (
              <p className="text-sm text-gray-500">No pending deck invites.</p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.slice(0, 4).map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl border border-gray-200 px-4 py-3"
                  >
                    <div className="font-medium text-gray-900">
                      {invite.collection_name} / {invite.deck_name}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Owner: {invite.owner_username}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-center gap-3 text-amber-900">
                <Shield className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Admin Access</h3>
              </div>
              <p className="mt-2 text-sm text-amber-800">
                Manage users, reset passwords, and control AI access from the
                admin panel.
              </p>
              <Link
                to="/admin"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-900 px-4 py-2 text-sm text-white hover:bg-amber-950"
              >
                Open Admin Panel
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
