import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';

export function Login() {
  const { isLoading, login } = useApp();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const didLogin = await login(identifier, password);
    if (didLogin) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(145deg,_#0f172a,_#1d4ed8)] p-10 text-white">
          <p className="text-sm uppercase tracking-[0.18em] text-blue-100">
            Secure Sign In
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight">
            Continue where your decks, readings, and shared study sessions left
            off.
          </h2>
          <p className="mt-5 max-w-xl text-sm text-blue-100">
            Sessions are stored in an HTTP-only cookie. The browser never needs
            direct access to the session token.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8">
          <h3 className="text-2xl font-semibold">Login</h3>
          <p className="mt-2 text-sm text-gray-600">
            Use your username or email address.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Username or Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="you@example.com"
                autoComplete="username"
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
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-600">
            Need an account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
