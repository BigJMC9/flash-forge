type JsonObject = Record<string, unknown>;

type UploadMode = 'single' | 'array';

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `${response.status} ${response.statusText}`;
    throw new Error(String(message));
  }

  if (!payload?.ok) {
    throw new Error(String(payload?.error?.message ?? 'Request failed.'));
  }

  return payload.data as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read file "${file.name}".`));
    };

    reader.readAsDataURL(file);
  });
}

async function encodeFiles(files: File[]): Promise<
  Array<{ name: string; type: string; base64: string }>
> {
  const encodedFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      base64: await fileToBase64(file),
    })),
  );

  return encodedFiles;
}

export async function callAction<T>(
  action: string,
  payload: JsonObject = {},
): Promise<T> {
  const response = await fetch('/api/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      payload,
    }),
  });

  return parseResponse<T>(response);
}

export async function callActionWithFiles<T>(
  action: string,
  payload: JsonObject,
  fileField: string,
  files: File[],
  fileMode: UploadMode = 'array',
): Promise<T> {
  const response = await fetch('/api/action-with-files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      payload,
      fileField,
      fileMode,
      files: await encodeFiles(files),
    }),
  });

  return parseResponse<T>(response);
}

function readFilenameFromDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? null;
}

export async function exportDeckPackage(deckId: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await fetch('/api/export-deck', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deck_id: deckId,
    }),
  });

  if (!response.ok) {
    try {
      const payload = await response.json();
      throw new Error(
        String(payload?.error?.message ?? payload?.message ?? response.statusText),
      );
    } catch (error) {
      throw new Error(asErrorMessage(error));
    }
  }

  return {
    blob: await response.blob(),
    filename:
      readFilenameFromDisposition(response.headers.get('content-disposition')) ??
      'anki-export.apkg',
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  return asErrorMessage(error);
}
