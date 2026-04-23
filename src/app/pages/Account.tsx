import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';

function formatTimestamp(timestamp: number): string {
  if (!timestamp) {
    return 'Unknown';
  }
  return new Date(timestamp * 1000).toLocaleString();
}

export function Account() {
  const {
    acceptInvite,
    changePassword,
    currentUser,
    pendingInvites,
    refreshBootstrap,
  } = useApp();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      return;
    }

    const updated = await changePassword(currentPassword, newPassword);
    if (updated) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    const deckId = await acceptInvite({ inviteId });
    if (deckId) {
      navigate(`/deck/${deckId}`);
    }
  };

  const handleAcceptToken = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedToken = inviteToken.trim();
    if (!trimmedToken) {
      return;
    }

    const deckId = await acceptInvite({ inviteToken: trimmedToken });
    if (deckId) {
      setInviteToken('');
      navigate(`/deck/${deckId}`);
      return;
    }

    await refreshBootstrap();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-2xl font-semibold">Account Settings</h2>
        <p className="mt-2 text-gray-600">
          Manage your password, AI access status, and deck invitations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Profile</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
              <dt className="text-gray-500">Username</dt>
              <dd className="font-medium text-gray-900">{currentUser?.username}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{currentUser?.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
              <dt className="text-gray-500">AI Access</dt>
              <dd className="font-medium text-gray-900">
                {currentUser?.can_use_ai ? 'Granted' : 'Not granted'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
              <dt className="text-gray-500">OCR Access</dt>
              <dd className="font-medium text-gray-900">
                {currentUser?.can_use_ocr ? 'Granted' : 'Not granted'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium text-gray-900">
                {currentUser?.is_admin ? 'Administrator' : 'Standard user'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Change Password</h3>
          <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 ${
                !confirmPassword || confirmPassword === newPassword
                  ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                  : 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              }`}
              autoComplete="new-password"
            />
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-black"
            >
              Update Password
            </button>
          </form>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Pending Deck Invites</h3>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
              {pendingInvites.length}
            </span>
          </div>
          {pendingInvites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No pending invites matched to your username or email.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {invite.collection_name} / {invite.deck_name}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Owner: {invite.owner_username}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Invite preview: {invite.token_preview} · Expires{' '}
                        {formatTimestamp(invite.expires_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleAcceptInvite(invite.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold">Accept Token Manually</h3>
          <p className="mt-2 text-sm text-gray-600">
            Use this if someone shares a raw invite token directly instead of the
            account-matched invite flow.
          </p>
          <form className="mt-4 space-y-4" onSubmit={handleAcceptToken}>
            <input
              type="text"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              placeholder="Paste invite token"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Accept Token
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
