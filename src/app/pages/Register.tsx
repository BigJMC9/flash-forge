import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';

export function Register() {
  const { isLoading, register } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [seedFromTemplate, setSeedFromTemplate] = useState(true);

  const passwordsMatch = useMemo(
    () => !confirmPassword || password === confirmPassword,
    [confirmPassword, password],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      return;
    }

    const didRegister = await register({
      username,
      email,
      password,
      seedFromTemplate,
    });
    if (didRegister) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center">
      <div className="grid w-full gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="app-panel-muted p-7 lg:p-8">
          <p className="app-kicker">New Workspace</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-gray-900">
            Create your account and start building focused decks.
          </h2>
          <p className="mt-4 text-sm text-gray-600">
            New users can begin with seeded template data and then branch into their
            own deck and card workflows.
          </p>
          <div className="mt-5 space-y-2 text-sm text-gray-700">
            <p className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              Passwords must be at least 8 characters.
            </p>
            <p className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              Invitations and permissions can be managed later from Account.
            </p>
          </div>
          <p className="mt-6 text-sm text-gray-600">
            Already registered?{' '}
            <Link to="/login" className="app-link font-medium">
              Sign in
            </Link>
          </p>
        </section>

        <section className="app-panel p-7 lg:p-8">
          <h3 className="text-2xl font-semibold text-gray-900">Register</h3>
          <p className="mt-2 text-sm text-gray-600">
            Set up your account credentials.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="app-input"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="app-input"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="app-input"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 ${
                  passwordsMatch
                    ? 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500/20'
                    : 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                }`}
                autoComplete="new-password"
              />
              {!passwordsMatch && (
                <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={seedFromTemplate}
                onChange={(event) => setSeedFromTemplate(event.target.checked)}
                className="mt-1"
              />
              <span>
                Seed this account from the current template decks and global pool.
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !passwordsMatch}
              className="app-btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
