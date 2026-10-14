# 海易贸 · 生鲜外贸ERP

面向生鲜外贸企业的一体化 ERP 系统，覆盖采购、国际货运、仓储、财务成本、销售出库、冷链监控与智能助手全链路。

前后端分离：前端 Vue 3 + Element Plus，后端 Node.js + Express + SQLite。

## 功能特性

- **采购管理**：采购订单状态机（草稿 → 待审批 → 已确认 → 运输中 → 已到货 → 完成/已取消）、供应商管理、多角色审批。
- **国际货运**：货运批次与单证矩阵、节点推进、3D 海图轨迹（`定位`）、全球货运态势（3D 地球总览）。
- **仓储管理（WMS）**：入库理算与重量公差校验、批次库存、温区结构、FEFO 先进先出。
- **财务成本**：落地成本分摊、关税 / 增值税倒算。
- **销售出库**：销售订单、按批次 FEFO 出库。
- **冷链温控监控**：温度记录与超限告警。
- **审批中心**：采购、磅差、临期出库等审批流。
- **智能助手**：大模型智能问答与自然语言问数（只读 SQL 安全校验）。
- **权限与审计**：RBAC 6 角色权限矩阵、菜单/路由/按钮级鉴权、操作日志、账号管理。
- **帮助中心与版本记录**：按角色提供操作指引与截图，展示版本更新历史。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite 6、Vue Router、Pinia、Element Plus、ECharts、globe.gl（three.js） |
| 后端 | Node.js、Express、better-sqlite3、jsonwebtoken、multer |
| 存储 | SQLite（本地文件数据库） |

## 目录结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── index.js         # 入口（Express 装配、静态代理集成）
│   │   ├── config.js        # 配置与 .env 加载
│   │   ├── db.js            # SQLite 连接与建表
│   │   ├── seed.js          # 初始化数据与演示数据
│   │   ├── permissions.js   # RBAC 权限矩阵
│   │   ├── auth.js          # JWT 鉴权
│   │   ├── routes/          # 各业务模块接口
│   │   └── services/        # 成本/货运/大模型等业务服务
│   ├── .env.example         # 环境变量示例
│   └── data/                # SQLite 数据文件（运行时生成，不入库）
├── frontend/                # 前端工程
│   ├── src/
│   │   ├── views/           # 页面
│   │   ├── components/      # 组件（3D 地球、助手机器人、轨迹等）
│   │   ├── layout/          # 布局与侧边菜单
│   │   ├── router/          # 路由与权限守卫
│   │   └── version.js       # 版本记录数据
│   ├── public/              # 静态资源（登录背景、帮助截图、下载包）
│   └── vite.config.js       # 代理 / 分包 / allowedHosts 配置
├── docs/                    # 操作手册
├── scripts/                 # 截图等辅助脚本
├── start.sh                 # 一键启动（生产预览模式）
├── stop.sh                  # 停止服务
└── CHANGELOG.md             # 版本记录
```

## 快速开始

前置：Node.js 18+（推荐 20/22）、npm。

```bash
# 1. 配置环境变量（可选，用于启用智能助手）
cp backend/.env.example backend/.env

# 2. 一键启动（安装依赖 → 生产构建 → 初始化数据 → 启动前后端）
bash start.sh

# 3. 浏览器访问前端
#    http://localhost:5173
```

停止服务：

```bash
bash stop.sh
```

`start.sh` 退出码约定：`0` 表示服务已启动（含本就在运行），`2` 表示启动失败。

### 手动启动

```bash
# 后端
cd backend
npm install
node src/seed.js
npm start            # 监听 0.0.0.0:3001

# 前端（另开终端）
cd frontend
npm install
npm run build
npm run preview      # 监听 0.0.0.0:5173，/api 反向代理到 3001
```

## 演示账号

密码规则：账号名 + `123`。

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin | admin123 | 系统管理员 |
| manager | manager123 | 采购经理 |
| buyer | buyer123 | 采购员 |
| warehouse | warehouse123 | 仓储主管 |
| finance | finance123 | 财务专员 |
| quality | quality123 | 生鲜品质主管 |

## 端口与环境变量

- 端口：后端 `3001`、前端 `5173`；对外统一访问前端 `5173`，`/api` 反向代理到后端。
- 环境变量（`backend/.env`，参考 `backend/.env.example`）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端端口 | `3001` |
| `JWT_SECRET` | JWT 签名密钥 | 开发默认值 |
| `DB_FILE` | SQLite 文件路径 | `backend/data/erp.db` |
| `LLM_BASE_URL` | 大模型接口地址 | `https://gpt.cosmoplat.com/v1` |
| `LLM_API_KEY` | 大模型密钥（缺省则智能助手不可用） | 空 |
| `LLM_MODEL` | 大模型名称 | `cosmo-mind` |

## 生产构建与内存

- 一律使用**生产构建**运行（`vite build` + `vite preview`），避免 dev 热重载的内存峰值触发 OOM。
- 构建/运行设置 `NODE_OPTIONS=--max-old-space-size=1400` 限制 Node 内存。
- 3D 相关重型依赖（three.js / globe.gl）单独分包并懒加载。

## 相关文档

- 操作手册：[`docs/海易贸生鲜外贸ERP-操作手册.md`](docs/海易贸生鲜外贸ERP-操作手册.md)
- 版本记录：[`CHANGELOG.md`](CHANGELOG.md)（前端「版本记录」页面同源）
- 应用内「帮助中心」按角色提供操作指引与系统截图

## 说明

- 原方案计划使用 MySQL，部署环境无 MySQL，改用 SQLite（better-sqlite3），表结构与接口契约保持一致。
- 业务数据删除一律为**软删除**（`is_deleted` 标记）。
- 大模型密钥仅存于服务端 `backend/.env`（已忽略入库），前端不接触。
