// 多维表格 JS SDK 的薄封装。
// 在 Base 侧边栏里打开时，从 SDK 取当前 Base、数据表、用户；在普通浏览器里打开（调试用）时，
// 从地址栏的 ?base=…&table=… 取，取不到就是空的。SDK 给的值只当提示，鉴权以服务端核实为准。
import { useEffect, useState } from 'react';
import { bitable } from '@lark-base-open/js-sdk';

export interface BaseContext {
  inBase: boolean;
  appToken: string;
  tableId: string;
  recordId: string;
  sdkUserId: string;
}

const EMPTY: BaseContext = { inBase: false, appToken: '', tableId: '', recordId: '', sdkUserId: '' };

const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

function fromQuery(): BaseContext {
  const q = new URLSearchParams(window.location.search);
  return {
    inBase: false,
    appToken: q.get('base') ?? '',
    tableId: q.get('table') ?? '',
    recordId: q.get('record') ?? '',
    sdkUserId: '',
  };
}

async function readContext(): Promise<BaseContext> {
  if (!embedded) return fromQuery();
  try {
    const [selection, userId] = await withTimeout(
      Promise.all([bitable.base.getSelection(), bitable.bridge.getUserId()]),
      5000,
    );
    return {
      inBase: true,
      appToken: selection.baseId ?? '',
      tableId: selection.tableId ?? '',
      recordId: selection.recordId ?? '',
      sdkUserId: userId ?? '',
    };
  } catch {
    // 嵌在别的页面里但不是 Base（比如预览），按普通浏览器处理
    return fromQuery();
  }
}

/** 当前 Base 和数据表；在 Base 里切换数据表时自动更新。 */
export function useBaseContext(): { ctx: BaseContext; loading: boolean } {
  const [ctx, setCtx] = useState<BaseContext>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let off: (() => void) | undefined;
    readContext().then((c) => {
      if (!alive) return;
      setCtx(c);
      setLoading(false);
      if (c.inBase) {
        off = bitable.base.onSelectionChange((ev) => {
          const sel = ev.data;
          setCtx((prev) => ({
            ...prev,
            appToken: sel.baseId ?? prev.appToken,
            tableId: sel.tableId ?? prev.tableId,
            recordId: sel.recordId ?? '',
          }));
        });
      }
    });
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  return { ctx, loading };
}

/** 当前数据表的名字，取不到时返回空字符串。 */
export async function tableName(tableId: string): Promise<string> {
  if (!embedded || !tableId) return '';
  try {
    const table = await bitable.base.getTableById(tableId);
    return await table.getName();
  } catch {
    return '';
  }
}
