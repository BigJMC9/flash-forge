import { useMemo, useState } from 'react';
import { Layers3, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, errorMessage } from '../lib/backend';
import { CardSchemaOption } from '../types';

const DEFAULT_FRONT_FIELDS = ['kanji'];
const DEFAULT_BACK_FIELDS = ['english'];

function uniqueFields(fields: string[]): string[] {
  const result: string[] = [];
  for (const field of fields) {
    if (field && !result.includes(field)) {
      result.push(field);
    }
  }
  return result;
}

export function Formats() {
  const {
    cardSchemaFields,
    cardSchemas,
    refreshBootstrap,
    setStatus,
  } = useApp();

  const [editingKey, setEditingKey] = useState('');
  const [label, setLabel] = useState('');
  const [frontFields, setFrontFields] = useState<string[]>(DEFAULT_FRONT_FIELDS);
  const [backFields, setBackFields] = useState<string[]>(DEFAULT_BACK_FIELDS);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fieldLabelByKey = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        cardSchemaFields.map((field) => [field.key, field.label]),
      ) as Record<string, string>,
    [cardSchemaFields],
  );

  const selectedFields = useMemo(
    () => uniqueFields([...frontFields, ...backFields]),
    [backFields, frontFields],
  );

  const customSchemas = cardSchemas.filter((schema) => !schema.is_builtin);
  const builtInSchemas = cardSchemas.filter((schema) => schema.is_builtin);

  const resetForm = () => {
    setEditingKey('');
    setLabel('');
    setFrontFields(DEFAULT_FRONT_FIELDS);
    setBackFields(DEFAULT_BACK_FIELDS);
    setFieldLabels({});
  };

  const beginEdit = (schema: CardSchemaOption) => {
    setEditingKey(schema.key);
    setLabel(schema.label);
    setFrontFields(schema.front_fields);
    setBackFields(schema.back_fields);
    setFieldLabels(schema.field_labels ?? {});
  };

  const toggleField = (
    side: 'front' | 'back',
    fieldKey: string,
    checked: boolean,
  ) => {
    const setter = side === 'front' ? setFrontFields : setBackFields;
    setter((previous) => {
      if (checked) {
        return uniqueFields([...previous, fieldKey]);
      }
      return previous.filter((field) => field !== fieldKey);
    });
  };

  const formatFieldList = (schema: CardSchemaOption, fields: string[]) =>
    fields
      .map((field) => schema.field_labels?.[field] || fieldLabelByKey[field] || field)
      .join(' + ');

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const action = editingKey ? 'update_card_schema' : 'create_card_schema';
      await callAction<{ schema: CardSchemaOption }>(action, {
        schema_key: editingKey,
        label,
        front_fields: frontFields,
        back_fields: backFields,
        field_labels: fieldLabels,
      });
      await refreshBootstrap();
      setStatus({
        type: 'success',
        message: editingKey ? 'Schema updated.' : 'Schema created.',
      });
      resetForm();
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (schema: CardSchemaOption) => {
    if (!window.confirm(`Delete "${schema.label}"?`)) {
      return;
    }

    try {
      await callAction('delete_card_schema', {
        schema_key: schema.key,
      });
      await refreshBootstrap();
      if (editingKey === schema.key) {
        resetForm();
      }
      setStatus({
        type: 'success',
        message: 'Schema deleted.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  return (
    <div className="app-page max-w-6xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Formats & Schemas</h2>
          <p className="app-page-description">
            Define which card fields appear on the front and back of custom cards.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <div className="app-panel p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">
              {editingKey ? 'Edit Schema' : 'New Schema'}
            </h3>
            {editingKey && (
              <button type="button" onClick={resetForm} className="app-btn-secondary">
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm text-gray-600">Name</label>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Kanji recognition"
              className="app-input"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {(['front', 'back'] as const).map((side) => {
              const activeFields = side === 'front' ? frontFields : backFields;
              return (
                <div key={side} className="app-panel-muted p-4">
                  <h4 className="mb-3 text-sm font-semibold capitalize text-gray-900">
                    {side}
                  </h4>
                  <div className="space-y-2">
                    {cardSchemaFields.map((field) => (
                      <label
                        key={`${side}-${field.key}`}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={activeFields.includes(field.key)}
                          onChange={(event) =>
                            toggleField(side, field.key, event.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedFields.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">
                Field Labels
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                {selectedFields.map((field) => (
                  <div key={field}>
                    <label className="mb-2 block text-sm text-gray-600">
                      {fieldLabelByKey[field] || field}
                    </label>
                    <input
                      type="text"
                      value={fieldLabels[field] ?? ''}
                      onChange={(event) =>
                        setFieldLabels((previous) => ({
                          ...previous,
                          [field]: event.target.value,
                        }))
                      }
                      placeholder={fieldLabelByKey[field] || field}
                      className="app-input"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="app-btn-primary"
            >
              {editingKey ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingKey ? 'Update Schema' : 'Create Schema'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-panel p-6">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Custom Schemas
            </h3>
            {customSchemas.length === 0 ? (
              <p className="text-sm text-gray-500">No custom schemas yet.</p>
            ) : (
              <div className="space-y-3">
                {customSchemas.map((schema) => (
                  <div key={schema.key} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">
                          {schema.label}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <div>Front: {formatFieldList(schema, schema.front_fields)}</div>
                          <div>Back: {formatFieldList(schema, schema.back_fields)}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(schema)}
                          className="app-btn-secondary"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(schema)}
                          className="app-btn-secondary"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="app-panel p-6">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900">
                Built-in Schemas
              </h3>
            </div>
            <div className="space-y-3">
              {builtInSchemas.map((schema) => (
                <div key={schema.key} className="rounded-lg border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900">{schema.label}</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>Front: {formatFieldList(schema, schema.front_fields)}</div>
                    <div>Back: {formatFieldList(schema, schema.back_fields)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
