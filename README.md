# YUK 工具箱（多维表格侧边栏）

多维表格侧边栏插件，管理「YUK 生成文档」节点用的 Word 模板：上传、检查、试打、版本、按记录选模板。
服务端是 lark-base-plugin-platform，接口地址见 `.env.production`。

这个仓库只用于在多维表格开发者中心发布，代码由主仓库的 `web-plugins` 同步过来（`scripts/sync-sidebar-repo.sh`），不要在这里直接改。

```bash
npm install
npm run dev     # 本地调试
npm run build   # 产物在 dist/
```
