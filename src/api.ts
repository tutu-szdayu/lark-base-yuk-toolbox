// 平台接口封装。页面挂在 <前缀>/sidebar/ 下时，接口在 <前缀>/api/ 下，按页面地址推出来，不写死前缀；
// 发布到开发者中心的版本由飞书托管，页面不在我们的域名下，构建时用 VITE_LBP_API_BASE 指定接口地址。
// 登录令牌放在 localStorage，请求时放进 Authorization: Bearer。

const API_BASE = import.meta.env.VITE_LBP_API_BASE || new URL('../api/', window.location.href).toString();
const TOKEN_KEY = 'lbp.token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 无痕窗口等场景下 localStorage 不可用：只是每次都要重新登录
  }
}

async function parse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let message = `请求失败（${resp.status}）`;
    try {
      const body = await resp.json();
      if (typeof body.detail === 'string') message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg?: string }) => d.msg).join('；');
    } catch {
      // 不是 JSON，用默认提示
    }
    throw new ApiError(resp.status, message);
  }
  const ctype = resp.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) return (await resp.json()) as T;
  return (await resp.blob()) as unknown as T;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = getToken();
  const resp = await fetch(API_BASE + path.replace(/^\//, ''), {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  return parse<T>(resp);
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export async function upload<T>(path: string, form: FormData): Promise<T> {
  return api<T>(path, { method: 'POST', body: form });
}

export interface User {
  id: number;
  name: string;
  openId: string;
  tenantKey: string;
  role: 'user' | 'admin';
}

export interface LoginStart {
  state: string;
  authorizeUrl: string;
  expiresIn: number;
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'error'; message: string }
  | {
      status: 'done';
      token: string;
      expiresIn: number;
      user: User;
      sdkUserId: string;
      identityMatch: boolean | null;
    };

export interface BaseInfo {
  registered: boolean;
  appToken?: string;
  name?: string;
  status?: 'active' | 'no_app_access' | 'disabled';
  registeredAt?: string | null;
}
