// 登录后的首页：当前用户、当前 Base 的访问权限和接入状态。模板管理挂在接入完成之后。
import { useCallback, useEffect, useState } from 'react';
import { Banner, Button, Descriptions, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { ApiError, BaseInfo, User, get, post } from '../api';
import { BaseContext, tableName } from '../bitable';
import Templates from './Templates';

const { Text } = Typography;

interface Props {
  user: User;
  ctx: BaseContext;
  identityMatch: boolean | null;
  onLogout: () => void;
  onExpired: () => void;
}

type BaseState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'denied'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; info: BaseInfo };

const STATUS_TEXT: Record<string, string> = {
  active: '已接入',
  no_app_access: '应用还没有权限',
  disabled: '已被管理员停用',
};

export default function Home({ user, ctx, identityMatch, onLogout, onExpired }: Props) {
  const [base, setBase] = useState<BaseState>({ kind: 'loading' });
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [tname, setTname] = useState('');

  const load = useCallback(async () => {
    if (!ctx.appToken) {
      setBase({ kind: 'none' });
      return;
    }
    setBase({ kind: 'loading' });
    try {
      setBase({ kind: 'ok', info: await get<BaseInfo>(`platform/bases/${ctx.appToken}`) });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onExpired();
      const message = e instanceof ApiError ? e.message : '查询失败';
      setBase(e instanceof ApiError && e.status === 403 ? { kind: 'denied', message } : { kind: 'error', message });
    }
  }, [ctx.appToken, onExpired]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    tableName(ctx.tableId).then(setTname);
  }, [ctx.tableId]);

  const register = async () => {
    setRegistering(true);
    setRegisterError('');
    try {
      setBase({ kind: 'ok', info: await post<BaseInfo>(`platform/bases/${ctx.appToken}/register`) });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onExpired();
      setRegisterError(e instanceof ApiError ? e.message : '接入失败');
      load();
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="page">
      <div className="header">
        <Text strong>YUK 工具箱</Text>
        <span>
          <Text type="secondary" size="small">
            {user.name}
            {user.role === 'admin' && <Tag size="small" color="blue" className="ml">管理员</Tag>}
          </Text>
          <Button size="small" theme="borderless" onClick={onLogout}>
            退出
          </Button>
        </span>
      </div>

      {!ctx.inBase && (
        <Banner
          type="info"
          className="gap"
          closeIcon={null}
          description="当前不在多维表格里打开。调试时可以在地址后面加 ?base=<app_token>&table=<table_id>。"
        />
      )}

      <Descriptions
        className="gap"
        size="small"
        data={[
          { key: '多维表格', value: base.kind === 'ok' && base.info.name ? base.info.name : ctx.appToken || '—' },
          { key: '数据表', value: tname || ctx.tableId || '—' },
          {
            key: '接入状态',
            value:
              base.kind === 'loading' ? (
                <Spin size="small" />
              ) : base.kind === 'ok' ? (
                <Tag color={base.info.status === 'active' ? 'green' : 'orange'}>
                  {base.info.registered ? STATUS_TEXT[base.info.status ?? ''] ?? base.info.status : '未接入'}
                </Tag>
              ) : (
                '—'
              ),
          },
        ]}
      />

      {base.kind === 'denied' && <Banner type="danger" className="gap" closeIcon={null} description={base.message} />}
      {base.kind === 'error' && <Banner type="warning" className="gap" closeIcon={null} description={base.message} />}
      {registerError && <Banner type="warning" className="gap" closeIcon={null} description={registerError} />}

      {base.kind === 'ok' && base.info.status !== 'active' && base.info.status !== 'disabled' && (
        <div className="gap">
          <Text type="secondary" size="small">
            接入后，这个多维表格才能使用打印模板和生成文档节点。接入前需要先把「YUK-多维插件应用」添加为文档应用（可编辑）。
          </Text>
          <div className="gap">
            <Button theme="solid" loading={registering} onClick={register}>
              接入这个多维表格
            </Button>
          </div>
        </div>
      )}

      {base.kind === 'ok' && base.info.status === 'active' && ctx.tableId && (
        <Templates appToken={ctx.appToken} tableId={ctx.tableId} recordId={ctx.recordId} onExpired={onExpired} />
      )}

      {identityMatch === false && ctx.inBase && (
        <Text type="tertiary" size="small" className="gap block">
          提示：飞书登录的身份和多维表格里的用户标识不是同一套 ID（不影响使用）。
        </Text>
      )}
    </div>
  );
}
