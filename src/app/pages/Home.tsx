import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Folder,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Library,
  MessageSquareText,
  PenTool,
  ScrollText,
  Shield,
  Upload,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';

function MetricCard({ label, value }: { label: string; value: number }) {
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
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="app-panel group flex h-full flex-col gap-3 p-5 transition-colors hover:border-blue-200"
    >
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-blue-700">
        Open
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export function Home() {
  const {
    isAuthenticated,
    currentUser,
    dashboard,
    collections,
    decks,
    currentDeck,
    setCurrentDeck,
    pendingInvites,
    isAdmin,
  } = useApp();

  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="app-page space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(140deg,#0f172a,#1e3a8a)] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.24),transparent_42%)]" />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                Flash Forge
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                Build Japanese decks with one workflow for writing, reading, and
                practice.
              </h1>
              <p className="mt-4 max-w-xl text-sm text-slate-200 sm:text-base">
                Keep vocabulary, sentence context, and review flows in sync for every
                learner on your team.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="app-btn-primary bg-white text-slate-900 hover:bg-slate-100"
                >
                  Create account
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-white/30 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Log in
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">
                Built for real study loops
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-100">
                <li className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 h-4 w-4 text-blue-200" />
                  Import or compose card content with dictionary support.
                </li>
                <li className="flex items-start gap-3">
                  <GraduationCap className="mt-0.5 h-4 w-4 text-blue-200" />
                  Track deck-level revision without leaving your workspace.
                </li>
                <li className="flex items-start gap-3">
                  <MessageSquareText className="mt-0.5 h-4 w-4 text-blue-200" />
                  Move from structured review to conversation naturally.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="app-panel p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <PenTool className="h-4 w-4" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-gray-900">Authoring</h2>
            <p className="mt-2 text-sm text-gray-600">
              Compose cards quickly with structured fields that stay reusable across
              decks.
            </p>
          </div>

          <div className="app-panel p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Library className="h-4 w-4" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-gray-900">Organization</h2>
            <p className="mt-2 text-sm text-gray-600">
              Keep collections, deck ownership, and shared visibility clean for every
              collaborator.
            </p>
          </div>

          <div className="app-panel p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Gamepad2 className="h-4 w-4" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-gray-900">Practice</h2>
            <p className="mt-2 text-sm text-gray-600">
              Reinforce learning through revision, reading, and conversation in one
              connected loop.
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
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="app-kicker">Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">
              Welcome back, {currentUser?.username}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              Continue building cards, reviewing progress, and practicing from a
              single shared workspace.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/collections" className="app-btn-primary">
                Open collections
              </Link>
              <Link to="/composer" className="app-btn-secondary">
                Compose cards
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
                  {focusDeck.collection_name} collection
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/deck/${focusDeck.id}`} className="app-btn-secondary">
                    Open deck
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
          <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
          <Link to="/import-export" className="app-link text-sm font-medium">
            Manage imports and exports
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            title="Global Library"
            description="Browse reusable global cards and copy into your decks."
            icon={Library}
            to="/global-library"
          />
          <ActionCard
            title="Import and Export"
            description="Move deck content in and out with consistent templates."
            icon={Upload}
            to="/import-export"
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
              <h3 className="text-sm font-semibold text-gray-900">Collaborators</h3>
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
                No pending invites. Shared workspace updates will appear here.
              </p>
            )}
            <Link to="/account" className="mt-4 inline-flex app-link text-sm font-medium">
              Manage account and invites
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

      <section className="app-panel-muted p-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <LayoutDashboard className="h-4 w-4 text-blue-700" />
          {collections.length} collections and {decks.length} decks in your workspace.
        </div>
      </section>
    </div>
  );
}
