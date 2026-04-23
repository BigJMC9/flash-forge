import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Folder,
  Gamepad2,
  GraduationCap,
  Library,
  MessageSquareText,
  PenTool,
  ScrollText,
  Shield,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="app-panel p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  to,
  onClick,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="app-panel group flex h-full flex-col gap-3 p-6 transition-colors hover:border-blue-200"
    >
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </Link>
  );
}

export function Home() {
  const {
    isAuthenticated,
    currentUser,
    dashboard,
    decks,
    currentDeck,
    setCurrentDeck,
    pendingInvites,
    isAdmin,
  } = useApp();

  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">
            Build Japanese learning workflows faster
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Create decks, review vocabulary, practice reading, and run shared study
            workflows in one calm workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="app-btn-primary">
              Create Account
            </Link>
            <Link to="/login" className="app-btn-secondary">
              Sign In
            </Link>
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="app-panel p-6">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <PenTool className="h-4 w-4" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Deck Building</h2>
            <p className="mt-2 text-sm text-gray-600">
              Create structured cards from dictionary entries or manual inputs
              without leaving the workspace.
            </p>
          </div>

          <div className="app-panel p-6">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <ScrollText className="h-4 w-4" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Reading Practice</h2>
            <p className="mt-2 text-sm text-gray-600">
              Turn deck vocabulary into focused reading and comprehension sessions
              that feel connected to real study goals.
            </p>
          </div>

          <div className="app-panel p-6">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Users className="h-4 w-4" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Shared Workspace</h2>
            <p className="mt-2 text-sm text-gray-600">
              Keep private collections separate while inviting collaborators onto
              the decks that need shared work.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const focusDeck = currentDeck ?? decks[0] ?? null;

  return (
    <div className="app-page space-y-6">
      <section className="app-panel p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="app-kicker">Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">
              Welcome back, {currentUser?.username}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              Continue building decks and move directly into revision, reading, and
              conversation from one home screen.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={focusDeck ? `/revision/${focusDeck.id}` : '/collections'}
                onClick={() => focusDeck && setCurrentDeck(focusDeck.id)}
                className="app-btn-primary"
              >
                {focusDeck ? 'Continue Studying' : 'Open Collections'}
              </Link>
              <Link to="/composer" className="app-btn-secondary">
                Compose Cards
              </Link>
            </div>
          </div>

          <div className="app-panel-muted p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
              Current focus
            </p>
            {focusDeck ? (
              <>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {focusDeck.name}
                </p>
                <p className="text-sm text-gray-600">
                  {focusDeck.collection_name} · {focusDeck.card_count} cards
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/deck/${focusDeck.id}`} className="app-btn-secondary">
                    Open Deck
                  </Link>
                  <Link to={`/revision/${focusDeck.id}`} className="app-btn-secondary">
                    Review
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                Select a deck from Collections to unlock revision, reading, and
                conversation flows.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Collections" value={dashboard.collection_count} />
        <MetricCard label="Decks" value={dashboard.deck_count} />
        <MetricCard label="Deck Cards" value={dashboard.card_count} />
        <MetricCard label="Pending Invites" value={pendingInvites.length} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Core areas</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title="Collections"
            description="Create and manage collections and their deck structure."
            icon={Folder}
            to="/collections"
          />
          <ActionCard
            title="Composer"
            description="Build cards and enrich entries with dictionary metadata."
            icon={PenTool}
            to="/composer"
          />
          <ActionCard
            title="Current Deck Study"
            description={
              focusDeck
                ? `Open revision, practice, reading, and conversation for ${focusDeck.name}.`
                : 'Select a deck to unlock revision, practice, reading, and conversation.'
            }
            icon={BookOpen}
            to={focusDeck ? `/revision/${focusDeck.id}` : '/collections'}
            onClick={() => focusDeck && setCurrentDeck(focusDeck.id)}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Decks</h2>
            <Link to="/collections" className="app-link text-sm font-medium">
              View all
            </Link>
          </div>

          {decks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No decks available yet. Create a collection and your first deck to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {decks.slice(0, 6).map((deck) => {
                const active = focusDeck?.id === deck.id;

                return (
                  <button
                    key={deck.id}
                    onClick={() => {
                      setCurrentDeck(deck.id);
                      void navigate(`/deck/${deck.id}`);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deck.name}</p>
                      <p className="text-xs text-gray-600">{deck.collection_name}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-500" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="app-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-gray-900">Pending Invites</h3>
            </div>
            {pendingInvites.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-700">
                {pendingInvites.slice(0, 4).map((invite) => (
                  <li
                    key={invite.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    Invite from {invite.owner_username}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">
                No pending invites right now.
              </p>
            )}
            <Link to="/account" className="mt-4 inline-flex app-link text-sm font-medium">
              Manage account and invites
            </Link>
          </div>

          <div className="app-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Library className="h-4 w-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-gray-900">Global Library</h3>
            </div>
            <p className="text-sm text-gray-600">
              Reuse vocabulary across decks and keep study content consistent.
            </p>
            <Link to="/global-library" className="mt-4 app-btn-secondary">
              Open library
            </Link>
          </div>

          {isAdmin && (
            <div className="app-panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-700" />
                <h3 className="text-sm font-semibold text-gray-900">Admin tools</h3>
              </div>
              <p className="text-sm text-gray-600">
                Monitor users, manage permissions, and review workspace health.
              </p>
              <Link to="/admin" className="mt-4 app-btn-secondary">
                Open admin
              </Link>
            </div>
          )}
        </div>
      </section>

      {focusDeck && (
        <section className="app-panel p-5">
          <h2 className="text-base font-semibold text-gray-900">Study flow</h2>
          <p className="mt-2 text-sm text-gray-600">
            Move from structured review into applied reading and conversation for
            <span className="font-medium text-gray-900"> {focusDeck.name}</span>.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link to={`/revision/${focusDeck.id}`} className="app-btn-secondary">
              <GraduationCap className="h-4 w-4" />
              Revision
            </Link>
            <Link to={`/practice/${focusDeck.id}`} className="app-btn-secondary">
              <Gamepad2 className="h-4 w-4" />
              Practice
            </Link>
            <Link to={`/reading/${focusDeck.id}`} className="app-btn-secondary">
              <ScrollText className="h-4 w-4" />
              Reading
            </Link>
            <Link to={`/conversation/${focusDeck.id}`} className="app-btn-secondary">
              <MessageSquareText className="h-4 w-4" />
              Conversation
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
