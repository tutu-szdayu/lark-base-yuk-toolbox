/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 接口地址（以 / 结尾），只有飞书托管的版本需要；不设就按页面地址推出来
  readonly VITE_LBP_API_BASE?: string;
}
