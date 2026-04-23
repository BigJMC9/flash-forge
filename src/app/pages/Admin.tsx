import { useEffect, useState } from 'react';
import { callAction, errorMessage } from '../lib/backend';
import { useApp } from '../contexts/AppContext';
import { UserAccountRow } from '../types';

type PasswordDrafts = Record<string, string>;

export function Admin() {
  const { refreshBootstrap, setStatus } = useApp();
  const [rows, setRows] = useState<UserAccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [passwords, setPasswords] = useState<PasswordDrafts>({});

  const loadRows = async () => {
    try {
      setIsLoading(true);
      const response = await callAction<{ rows: UserAccountRow[] }>('list_users');
      setRows(response.rows ?? []);
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const patchRow = (userId: string, updates: Partial<UserAccountRow>) => {
    setRows((previous) =>
      previous.map((row) => (row.id === userId ? { ...row, ...updates } : row)),
    );
  };

  const handleSave = async (row: UserAccountRow) => {
    try {
      const response = await callAction<{ user: UserAccountRow }>(
        'admin_update_user',
        {
          user_id: row.id,
          is_admin: row.is_admin,
          can_use_ai: row.can_use_ai,
          can_use_ocr: row.can_use_ocr,
          is_active: row.is_active,
        },
      );
      patchRow(row.id, response.user);
      await refreshBootstrap();
      setStatus({
        type: 'success',
        message: `Updated ${row.username}.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const handleResetPassword = async (row: UserAccountRow) => {
    const newPassword = passwords[row.id]?.trim() ?? '';
    if (newPassword.length < 8) {
      setStatus({
        type: 'warning',
        message: 'Reset passwords must be at least 8 characters.',
      });
      return;
    }

    try {
      await callAction('admin_reset_password', {
        user_id: row.id,
        new_password: newPassword,
      });
      setPasswords((previous) => ({ ...previous, [row.id]: '' }));
      setStatus({
        type: 'success',
        message: `Reset password for ${row.username}.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  return (
    <div className="app-page max-w-7xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Admin Panel</h2>
          <p className="app-page-description">
            Manage account status, AI access, OCR access, and password resets.
            Changes apply immediately.
          </p>
        </div>
      </div>

      <div className="app-banner-warning">
        <p>
          Manage account status, AI access, OCR access, and password resets.
          Changes apply immediately.
        </p>
      </div>

      <div className="app-panel p-6">
        <div className="app-section-header mb-4">
          <div>
            <h3 className="app-section-title">Accounts</h3>
            <p className="app-section-copy">
              Update permissions, deactivate access, and issue temporary reset credentials.
            </p>
          </div>
          <button
            onClick={() => void loadRows()}
            className="app-btn-secondary"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading users…</div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="app-panel-muted p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {row.username}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">{row.email}</div>
                    <div className="mt-2 text-xs text-gray-500">
                      Created {new Date(row.created_at * 1000).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.is_admin}
                        onChange={(event) =>
                          patchRow(row.id, { is_admin: event.target.checked })
                        }
                      />
                      Admin
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.can_use_ai}
                        onChange={(event) =>
                          patchRow(row.id, { can_use_ai: event.target.checked })
                        }
                      />
                      AI Access
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.can_use_ocr}
                        onChange={(event) =>
                          patchRow(row.id, { can_use_ocr: event.target.checked })
                        }
                      />
                      OCR Access
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(event) =>
                          patchRow(row.id, { is_active: event.target.checked })
                        }
                      />
                      Active
                    </label>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-end">
                  <button
                    onClick={() => void handleSave(row)}
                    className="app-btn-primary"
                  >
                    Save Permissions
                  </button>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Reset Password
                    </label>
                    <input
                      type="password"
                      value={passwords[row.id] ?? ''}
                      onChange={(event) =>
                        setPasswords((previous) => ({
                          ...previous,
                          [row.id]: event.target.value,
                        }))
                      }
                      placeholder="Temporary password"
                      className="app-input"
                    />
                  </div>

                  <button
                    onClick={() => void handleResetPassword(row)}
                    className="app-btn-secondary"
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
