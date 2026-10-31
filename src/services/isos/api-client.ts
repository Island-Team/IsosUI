/** Versioned API client for the local IsOS process. */
const BASE = `${ISOSUI_API_ORIGIN}/api/isos/v2`;

interface Envelope<T> { schema_version: 2; ok: boolean; data: T | null; error: string | null }
type LoopbackRequestInit = RequestInit & { targetAddressSpace?: 'loopback' };

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    const options: LoopbackRequestInit = {
      method,
      credentials: 'omit',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // Chrome uses this hint for HTTPS-to-HTTP loopback permission and address verification.
      mode: 'cors',
      targetAddressSpace: 'loopback',
    };
    response = await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error(`Cannot reach IsOS at ${ISOSUI_API_ORIGIN}. Run isos serve and check the service address and port.`);
  }
  let envelope: Envelope<T> | null = null;
  try { envelope = await response.json() as Envelope<T>; } catch { /* HTTP failures can be plain text. */ }
  if (response.ok && !envelope) {
    throw new Error('The IsOS API address returned a page instead of API data. Check the API port, then run isos serve.');
  }
  if (envelope && envelope.schema_version !== 2) {
    throw new Error('This IsosUI build needs the IsOS v2 API. Update IsOS or use a compatible UI release.');
  }
  if (!response.ok || !envelope?.ok || envelope.data === null) {
    if (response.status === 409) throw new Error('This graph changed in another editor. Refresh before applying.');
    throw new Error(envelope?.error || `IsOS request failed (${response.status}).`);
  }
  return envelope.data;
}
