import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Collections } from './pages/Collections';
import { Dictionary } from './pages/Dictionary';
import { Composer } from './pages/Composer';
import { GlobalLibrary } from './pages/GlobalLibrary';
import { DeckOperations } from './pages/DeckOperations';
import { Revision } from './pages/Revision';
import { Practice } from './pages/Practice';
import { ImportExport } from './pages/ImportExport';
import { Reading } from './pages/Reading';
import { Conversation } from './pages/Conversation';

function Root() {
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

function CollectionsPage() {
  return (
    <Layout>
      <Collections />
    </Layout>
  );
}

function DictionaryPage() {
  return (
    <Layout>
      <Dictionary />
    </Layout>
  );
}

function ComposerPage() {
  return (
    <Layout>
      <Composer />
    </Layout>
  );
}

function GlobalLibraryPage() {
  return (
    <Layout>
      <GlobalLibrary />
    </Layout>
  );
}

function DeckOperationsPage() {
  return (
    <Layout>
      <DeckOperations />
    </Layout>
  );
}

function RevisionPage() {
  return (
    <Layout>
      <Revision />
    </Layout>
  );
}

function PracticePage() {
  return (
    <Layout>
      <Practice />
    </Layout>
  );
}

function ReadingPage() {
  return (
    <Layout>
      <Reading />
    </Layout>
  );
}

function ConversationPage() {
  return (
    <Layout>
      <Conversation />
    </Layout>
  );
}

function ImportExportPage() {
  return (
    <Layout>
      <ImportExport />
    </Layout>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
  },
  {
    path: '/collections',
    Component: CollectionsPage,
  },
  {
    path: '/dictionary',
    Component: DictionaryPage,
  },
  {
    path: '/composer',
    Component: ComposerPage,
  },
  {
    path: '/global-library',
    Component: GlobalLibraryPage,
  },
  {
    path: '/deck/:deckId',
    Component: DeckOperationsPage,
  },
  {
    path: '/revision/:deckId',
    Component: RevisionPage,
  },
  {
    path: '/practice/:deckId',
    Component: PracticePage,
  },
  {
    path: '/reading/:deckId',
    Component: ReadingPage,
  },
  {
    path: '/conversation/:deckId',
    Component: ConversationPage,
  },
  {
    path: '/import-export',
    Component: ImportExportPage,
  },
]);
