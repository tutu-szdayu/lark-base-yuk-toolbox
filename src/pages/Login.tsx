// 飞书登录：侧边栏里不能免登，走 OAuth 弹窗 + 轮询（见 docs/spikes.md S3）。
// 授权地址在页面打开时就先取好，点击按钮时同步 window.open，避免被当成弹窗拦截。
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, Button, Spin, Typography } from '@douyinfe/semi-ui';
import { ApiError, LoginStart, PollResult, User, get, post, setToken } from '../api';

const { Title, Text } = Typography;

// 在飞书客户端里，window.open 会跳到系统默认浏览器，那里不一定登录了飞书。
// 改用 AppLink 让授权页在飞书客户端自带的浏览器里打开，用户已经是登录状态。
const IN_FEISHU_CLIENT = /\bLark\//.test(navigator.userAgent);

function authorizeLink(url: string): string {
  return IN_FEISHU_CLIENT
    ? `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(url)}`
    : url;
}

interface Props {
  sdkUserId: string;
  sdkBaseId: string;
  onLoggedIn: (user: User, info: { sdkUserId: string; identityMatch: boolean | null }) => void;
}

export default function Login({ sdkUserId, sdkBaseId, onLoggedIn }: Props) {
  const [start, setStart] = useState<LoginStart | null>(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<number>();

  const prepare = useCallback(async () => {
    setError('');
    try {
      setStart(await post<LoginStart>('auth/login', { sdkUserId, sdkBaseId }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '连接服务失败，请稍后重试');
    }
  }, [sdkUserId, sdkBaseId]);

  useEffect(() => {
    prepare();
    return () => window.clearTimeout(timer.current);
  }, [prepare]);

  const poll = useCallback(
    async (state: string) => {
      try {
        const res = await get<PollResult>(`auth/poll?state=${encodeURIComponent(state)}`);
        if (res.status === 'pending') {
          timer.current = window.setTimeout(() => poll(state), 1500);
          return;
        }
        setWaiting(false);
        if (res.status === 'done') {
          setToken(res.token);
          onLoggedIn(res.user, { sdkUserId: res.sdkUserId, identityMatch: res.identityMatch });
          return;
        }
        setError(res.status === 'expired' ? '登录超时，请重新点击登录' : res.message);
        prepare();
      } catch (e) {
        setWaiting(false);
        setError(e instanceof ApiError ? e.message : '查询登录结果失败');
        prepare();
      }
    },
    [onLoggedIn, prepare],
  );

  const login = () => {
    if (!start) return;
    window.open(authorizeLink(start.authorizeUrl), '_blank');
    setWaiting(true);
    setError('');
    window.clearTimeout(timer.current);
    poll(start.state);
  };

  return (
    <div className="page center">
      <Title heading={4}>YUK 工具箱</Title>
      <Text type="secondary">用飞书账号登录后，可以管理这个多维表格的打印模板。</Text>
      {error && <Banner type="danger" description={error} closeIcon={null} className="gap" />}
      {waiting ? (
        <div className="gap">
          <Spin /> <Text>请在新打开的窗口里完成飞书授权…</Text>
          {IN_FEISHU_CLIENT && start && (
            <div className="gap">
              <Text type="tertiary" size="small">
                没有弹出窗口？
                <Text link={{ href: start.authorizeUrl, target: '_blank' }} size="small">
                  在浏览器中打开
                </Text>
              </Text>
            </div>
          )}
          <div className="gap">
            <Button theme="borderless" onClick={() => (window.clearTimeout(timer.current), setWaiting(false), prepare())}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <Button theme="solid" size="large" className="gap" disabled={!start} onClick={login}>
          飞书登录
        </Button>
      )}
    </div>
  );
}
