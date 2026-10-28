import { useCallback, useEffect, useState } from 'react';
import { Spin } from '@douyinfe/semi-ui';
import { ApiError, User, get, getToken, post, setToken } from './api';
import { useBaseContext } from './bitable';
import Home from './pages/Home';
import Login from './pages/Login';

type Session = { kind: 'checking' } | { kind: 'anonymous' } | { kind: 'user'; user: User };

export default function App() {
  const { ctx, loading } = useBaseContext();
  const [session, setSession] = useState<Session>({ kind: 'checking' });
  const [identityMatch, setIdentityMatch] = useState<boolean | null>(null);

  // 打开时用已保存的令牌恢复登录，令牌过期才回到登录页。
  // 用户的飞书授权只在服务端内存里（任务书第 3 节），服务重启后就没了；这时先不催登录，
  // 等真要查 Base 权限、服务端返回 401 时，各页面再通过 onExpired 回到登录页。管理员不查权限，不受影响。
  useEffect(() => {
    if (!getToken()) {
      setSession({ kind: 'anonymous' });
      return;
    }
    get<User>('auth/me')
      .then((me) => setSession({ kind: 'user', user: me }))
      .catch(() => setSession({ kind: 'anonymous' }));
  }, []);

  const expired = useCallback(() => {
    setToken(null);
    setSession({ kind: 'anonymous' });
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('auth/logout');
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
    expired();
  }, [expired]);

  if (loading || session.kind === 'checking') {
    return (
      <div className="page center">
        <Spin />
      </div>
    );
  }
  if (session.kind === 'anonymous') {
    return (
      <Login
        sdkUserId={ctx.sdkUserId}
        sdkBaseId={ctx.appToken}
        onLoggedIn={(user, info) => {
          setIdentityMatch(info.identityMatch);
          setSession({ kind: 'user', user });
        }}
      />
    );
  }
  return (
    <Home user={session.user} ctx={ctx} identityMatch={identityMatch} onLogout={logout} onExpired={expired} />
  );
}
