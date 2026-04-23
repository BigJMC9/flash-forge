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
    <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center">
      <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-teal-200 bg-[linear-gradient(145deg,_#022c22,_#0f766e)] p-10 text-white">
          <p className="text-sm uppercase tracking-[0.18em] text-teal-100">
            Multi-User Workspace
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight">
            Create a personal workspace, then branch into shared decks when you
            need collaboration.
          </h2>
          <p className="mt-5 max-w-xl text-sm text-teal-100">
            New accounts can start with a seeded copy of the current template
            decks and global pool, then diverge into their own private data.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8">
          <h3 className="text-2xl font-semibold">Register</h3>
          <p className="mt-2 text-sm text-gray-600">
            Passwords must be at least 8 characters.
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 ${
                  passwordsMatch
                    ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                    : 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                }`}
                autoComplete="new-password"
              />
              {!passwordsMatch && (
                <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
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
              className="w-full rounded-xl bg-teal-700 px-5 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-600">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
