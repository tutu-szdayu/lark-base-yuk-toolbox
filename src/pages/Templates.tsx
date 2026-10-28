// 打印模板管理：当前数据表的模板（上传检查、版本、试打、下载、归档）、生成节点 v4 的用法、同步模板到单选字段。
// 模板、保存字段、写入方式都在工作流的「YUK 生成文档（新版）」节点里选（2026-10-23 用户确认），
// 原来的「打印配置」只给旧的 v3 节点用，侧边栏不再显示，服务端接口留到 v3 下架。
import { useCallback, useEffect, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Collapse,
  Empty,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
  Upload,
} from '@douyinfe/semi-ui';
import { ApiError, api, get, post, upload } from '../api';

const { Text } = Typography;

interface Props {
  appToken: string;
  tableId: string;
  recordId: string;
  onExpired: () => void;
}

interface Field {
  id: string;
  name: string;
  type: number;
  typeName: string;
  isPrimary: boolean;
}

interface Template {
  id: number;
  name: string;
  version: number;
  versions: number;
  variables: string[];
  unknownFields: string[];
  unsupported: string[];
  status: 'active' | 'archived';
  uploadedBy: string;
  createdAt: string | null;
}

const SINGLE = 3;

export default function Templates({ appToken, tableId, recordId, onExpired }: Props) {
  const base = `print/bases/${appToken}/tables/${tableId}`;
  const [fields, setFields] = useState<Field[]>([]);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState('');

  const handle = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError && e.status === 401) return onExpired();
      const message = e instanceof ApiError ? e.message : fallback;
      Toast.error({ content: message, duration: 5 });
    },
    [onExpired],
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const [f, t] = await Promise.all([get<Field[]>(`${base}/fields`), get<Template[]>(`${base}/templates`)]);
      setFields(f);
      setTemplates(t);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onExpired();
      setError(e instanceof ApiError ? e.message : '加载失败');
      setTemplates([]);
    }
  }, [base, onExpired]);

  useEffect(() => {
    setTemplates(null);
    load();
  }, [load]);

  if (templates === null) return <Spin className="gap" />;

  return (
    <div className="gap">
      {error && <Banner type="warning" closeIcon={null} description={error} />}
      <TemplateList base={base} templates={templates} recordId={recordId} onChanged={load} onError={handle} />
      <Collapse className="gap" defaultActiveKey={['guide']}>
        <Collapse.Panel header="在工作流里生成文档" itemKey="guide">
          <NodeGuide />
        </Collapse.Panel>
        <Collapse.Panel header="按记录选模板" itemKey="pick">
          <SyncOptions base={base} fields={fields} hasTemplates={templates.length > 0} onError={handle} />
        </Collapse.Panel>
      </Collapse>
    </div>
  );
}

// ---------------------------------------------------------------------- 模板

interface ListProps {
  base: string;
  templates: Template[];
  recordId: string;
  onChanged: () => void;
  onError: (e: unknown, fallback: string) => void;
}

function TemplateList({ base, templates, recordId, onChanged, onError }: ListProps) {
  const [preview, setPreview] = useState<{ name: string; pages: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(0);

  // name 为空时按文件名新建模板；给了 name 就是这个模板的新版本（文件名随意）
  const [uploading, setUploading] = useState<string | null>(null);
  const doUpload = async (file: File, name = '') => {
    setUploading(name);
    try {
      const form = new FormData();
      form.append('file', file);
      if (name) form.append('name', name);
      const t = await upload<Template>(`${base}/templates`, form);
      Toast.success(`已上传「${t.name}」第 ${t.version} 版`);
      onChanged();
    } catch (e) {
      onError(e, '上传失败');
    } finally {
      setUploading(null);
    }
  };

  const uploadButton = (label: string, name = '', props: Record<string, unknown> = {}) => (
    <Upload
      action=""
      accept=".docx"
      showUploadList={false}
      customRequest={({ fileInstance, onSuccess }) => {
        doUpload(fileInstance, name).finally(() => onSuccess({}));
      }}
    >
      <Button loading={uploading === name} {...props}>
        {label}
      </Button>
    </Upload>
  );

  const doPreview = async (t: Template) => {
    setPreviewing(t.id);
    try {
      const res = await post<{ recordId: string; pages: string[] }>(`${base}/templates/${t.id}/preview`, {
        recordId,
      });
      setPreview({ name: t.name, pages: res.pages });
    } catch (e) {
      onError(e, '试打失败');
    } finally {
      setPreviewing(0);
    }
  };

  const doDownload = async (t: Template) => {
    try {
      const blob = await api<Blob>(`${base}/templates/${t.id}/file`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${t.name}-v${t.version}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (e) {
      onError(e, '下载失败');
    }
  };

  const doArchive = async (t: Template) => {
    try {
      await post(`${base}/templates/${t.id}/archive`);
      onChanged();
    } catch (e) {
      onError(e, '归档失败');
    }
  };

  return (
    <div>
      {uploadButton('上传新模板', '', { theme: 'solid' })}
      <Text type="tertiary" size="small" className="block gap">
        新模板按文件名命名。改模板时先「下载」，在 Word 里改好，再点模板上的「上传新版本」，生成文档时用最新版本。模板写法和排版打印一样。
      </Text>

      {templates.length === 0 ? (
        <Empty className="gap" description="这张表还没有模板" />
      ) : (
        templates.map((t) => (
          <Card key={t.id} className="gap" bodyStyle={{ padding: 12 }}>
            <div className="row">
              <Text strong>{t.name}</Text>
              <Tag size="small" color={t.status === 'active' ? 'green' : 'grey'}>
                {t.status === 'active' ? `第 ${t.version} 版` : '已归档'}
              </Tag>
            </div>
            <Text type="tertiary" size="small" className="block">
              共 {t.versions} 个版本 · {t.uploadedBy || '—'} · {t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}
            </Text>
            {t.unknownFields.length > 0 && (
              <Banner
                type="warning"
                className="gap"
                closeIcon={null}
                description={`这张表里没有这些字段，生成时会是空白：${t.unknownFields.join('、')}`}
              />
            )}
            {t.unsupported.map((u) => (
              <Text key={u} type="tertiary" size="small" className="block gap">
                提示：{u}
              </Text>
            ))}
            <Space className="gap">
              <Button size="small" loading={previewing === t.id} onClick={() => doPreview(t)}>
                试打
              </Button>
              <Button size="small" theme="borderless" onClick={() => doDownload(t)}>
                下载
              </Button>
              {uploadButton(t.status === 'active' ? '上传新版本' : '上传新版本并启用', t.name, {
                size: 'small',
                theme: 'borderless',
              })}
              {t.status === 'active' && (
                <Popconfirm title="归档后生成文档时不能再选这个模板，确定归档？" onConfirm={() => doArchive(t)}>
                  <Button size="small" theme="borderless" type="danger">
                    归档
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </Card>
        ))
      )}

      <Modal
        title={preview ? `试打：${preview.name}` : ''}
        visible={preview !== null}
        onCancel={() => setPreview(null)}
        footer={null}
        fullScreen
      >
        <Text type="tertiary" size="small" className="block">
          {recordId ? '用当前选中的记录生成，不会写回表里。' : '没有选中记录，用的是第一条记录，不会写回表里。'}
        </Text>
        {preview?.pages.map((src, i) => (
          <img key={i} src={src} alt={`第 ${i + 1} 页`} className="preview-page" />
        ))}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------- 节点用法

function NodeGuide() {
  return (
    <div>
      <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
        <li>在上面上传 docx 模板，写法和排版打印一样；可以先「试打」看看效果。</li>
        <li>在表里加一个「按钮」字段，执行操作选「执行工作流」→「新建工作流」。</li>
        <li>
          工作流里添加节点「YUK 生成文档（新版）」，依次选：文档模板、导出类型（PDF / Word）、附件写入模式（追加 /
          替换）、生成的文档保存字段（附件字段）、运行状态写入字段（文本字段，可不选）；「操作人」插入「触发人」。
        </li>
        <li>保存并启用，在记录上点按钮，文档会写进选好的附件字段，状态字段写「✅ 时间」和任务编号。</li>
      </ol>
      <Text type="tertiary" size="small" className="block gap">
        第一次打开节点里的下拉框，可能转一会儿圈后是空的，关掉再打开就有。上传了新模板以后，要关掉节点面板重新打开，下拉框里才会出现。生成失败时，状态字段写「❌
        时间 原因」，节点的输出里也有原因，可以接着给操作人发消息。
      </Text>
    </div>
  );
}

// ---------------------------------------------------------------------- 按记录选模板

interface SyncProps {
  base: string;
  fields: Field[];
  hasTemplates: boolean;
  onError: (e: unknown, fallback: string) => void;
}

function SyncOptions({ base, fields, hasTemplates, onError }: SyncProps) {
  const singles = fields.filter((f) => f.type === SINGLE);
  const [fieldId, setFieldId] = useState('');
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await post<{ field: string; added: string[]; unmatched: string[] }>(`${base}/templates/sync-options`, {
        fieldId,
      });
      const lines = [
        res.added.length ? `已给「${res.field}」加上选项：${res.added.join('、')}` : `「${res.field}」的选项已经齐了`,
      ];
      if (res.unmatched.length) lines.push(`这些选项没有对应的启用模板，选了会生成失败：${res.unmatched.join('、')}`);
      Toast.info({ content: lines.join('。'), duration: 6 });
    } catch (e) {
      onError(e, '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <Text type="tertiary" size="small" className="block">
        一张表有几份模板、每条记录用的不一样时：在表里建一个单选字段（比如「选模板」），在这里把模板名同步成它的选项，记录里选好模板再点按钮。节点的「文档模板」选「按记录里的「选模板」选模板」。只加选项不删，记录里已经选的值不受影响。
      </Text>
      {singles.length === 0 ? (
        <Text type="tertiary" size="small" className="block gap">
          这张表还没有单选字段，先在表里加一个。
        </Text>
      ) : (
        <Space className="gap" wrap>
          <Select
            placeholder="选择单选字段"
            value={fieldId || undefined}
            onChange={(v) => setFieldId(String(v ?? ''))}
            optionList={singles.map((f) => ({ label: f.name, value: f.id }))}
            style={{ width: 200 }}
          />
          <Button disabled={!fieldId || !hasTemplates} loading={syncing} onClick={sync}>
            同步模板到选项
          </Button>
        </Space>
      )}
    </div>
  );
}
