import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../contexts/AppContext';

export function Login() {
  const { isLoading, login } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const redirectTo =
    (location.state as { redirectTo?: string } | null)?.redirectTo ?? '/dashboard';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const didLogin = await login(identifier, password);
    if (didLogin) {
      navigate(redirectTo.startsWith('/') ? redirectTo : '/dashboard', { replace: true });
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center">
      <div className="grid w-full gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="app-panel-muted p-7 lg:p-8">
          <p className="app-kicker">Secure Access</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-gray-900">
            Sign in and continue your workspace flow.
          </h2>
          <p className="mt-4 text-sm text-gray-600">
            Sessions are stored in an HTTP-only cookie and never exposed to client-side
            scripts.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-gray-700">
            <li className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              Continue where deck operations and revision left off.
            </li>
            <li className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              Use your username or email for authentication.
            </li>
          </ul>
          <p className="mt-6 text-sm text-gray-600">
            Need an account?{' '}
            <Link to="/register" className="app-link font-medium">
              Register
            </Link>
          </p>
        </section>

        <section className="app-panel p-7 lg:p-8">
          <h3 className="text-2xl font-semibold text-gray-900">Login</h3>
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
                className="app-input"
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
                className="app-input"
                placeholder="********"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="app-btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
