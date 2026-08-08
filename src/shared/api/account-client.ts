import { supabase } from '../../../lib/supabase';

export type AuthenticatedMethod = 'GET' | 'PATCH' | 'POST';

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  let accessToken = data.session?.access_token;

  if (!accessToken) {
    const refreshed = await supabase.auth.refreshSession();
    accessToken = refreshed.data.session?.access_token;
  }

  if (!accessToken) {
    throw new Error('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.');
  }

  return accessToken;
};

export const callAuthenticatedApi = async <T,>(
  path: string,
  method: AuthenticatedMethod,
  body?: Record<string, unknown>,
  fallbackMessage = 'Chưa thực hiện được. Vui lòng thử lại.',
): Promise<T> => {
  const sendRequest = (accessToken: string) =>
    fetch(path, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      method,
    });

  let response: Response;
  try {
    let accessToken = await getAccessToken();
    response = await sendRequest(accessToken);

    if (response.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token ?? '';
      if (accessToken) {
        response = await sendRequest(accessToken);
      }
    }
  } catch {
    throw new Error('Không kết nối được. Vui lòng kiểm tra mạng rồi thử lại.');
  }

  const result = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result;
};

export const callAccountApi = <T,>(
  method: Extract<AuthenticatedMethod, 'GET' | 'PATCH'>,
  body?: Record<string, unknown>,
) => callAuthenticatedApi<T>('/api/account', method, body);
