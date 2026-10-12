# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[生鲜外贸 ERP 本地构建与运行方式]
- Date: 2026-10-12
- Context: Agent 在执行「根据 PRD 搭建生鲜外贸 ERP」任务时发现
- Category: 构建方法
- Instructions:
  - 项目为前后端分离结构：后端 `backend/`（Node.js + Express + better-sqlite3），前端 `frontend/`（Vue 3 + Vite + Element Plus）。
  - 后端启动：`cd backend && npm install && node src/seed.js`（初始化示例数据，仅在空库时执行）后 `npm start`，监听 `0.0.0.0:3001`。
  - 前端启动：`cd frontend && npm install && npm run dev`，监听 `0.0.0.0:5173`，通过 Vite proxy 将 `/api` 转发到后端 3001，对外只暴露 5173 单一端口。
  - 生产构建：`cd frontend && npm run build`。
  - 一键启动：仓库根目录执行 `bash start.sh`。
  - 数据库为 SQLite 文件，位于 `backend/data/erp.db`，已在 `.gitignore` 中忽略，运行数据不纳入版本管理。

[演示账号信息]
- Date: 2026-10-12
- Context: Agent 在执行「根据 PRD 搭建生鲜外贸 ERP」任务时发现
- Category: 环境配置
- Instructions:
  - 系统内置 6 个演示角色（密码为「账号名+123」）：admin（系统管理员，全部权限）、manager/manager123（采购经理）、buyer/buyer123（采购员）、warehouse/warehouse123（仓储主管）、finance/finance123（财务专员）、quality/quality123（生鲜品质主管）。
  - RBAC 采用代码内静态权限矩阵（`backend/src/permissions.js`），权限码形如 `purchase:approve`；后端通过 `requirePermission(code)` 中间件鉴权，前端通过 `auth.hasPerm(code)` 与路由 `meta.permission` 控制菜单/页面/按钮。
  - 采购订单列表对 `purchase` 角色做数据范围隔离（仅见本人创建的单）。

[一键启停脚本]
- Date: 2026-10-12
- Context: Agent 在生成并测试 start.sh / stop.sh 时发现
- Category: 运维部署
- Instructions:
  - 仓库根目录 `start.sh` 启动、`stop.sh` 停止；端口固定为后端 3001、前端 5173（对外只访问 5173，`/api` 反向代理到 3001）。
  - `start.sh` 退出码：已运行或启动成功返回 0，启动失败返回 2；启动前先判断两端口是否都在监听，已启动则直接返回 0。
  - 采用生产模式启动（先 `npm run build` 再用 `vite preview` 提供静态服务），避免 dev 热重载内存峰值触发 OOM；通过 `NODE_OPTIONS=--max-old-space-size=1024` 限制 Node 内存。
  - 服务进程用 `setsid node ... </dev/null > logs/*.log 2>&1 &` 完全脱离终端启动；不要用 `timeout` 包裹启动命令，不要用 `nohup MODE=online node` 形式（前置环境变量需先 `export`）。
  - `stop.sh` 通过 `ss -ltnp "sport = :端口"` 提取 PID 并递归 kill 子进程，不使用 fuser/lsof；日志输出到 `logs/backend.log`、`logs/frontend.log`。

[系统截图生成方式（帮助中心配图）]
- Date: 2026-10-12
- Context: Agent 为帮助中心生成系统真实截图时发现
- Category: 构建方法
- Instructions:
  - 截图脚本：`scripts/capture-screenshots.cjs`，输出到 `frontend/public/help/*.png`；运行方式 `NODE_PATH="$(npm root -g)" node scripts/capture-screenshots.cjs`（依赖全局 `playwright`）。
  - 无头浏览器使用系统 `chromium`（apt 安装，`/usr/bin/chromium`），通过 `playwright` 的 `executablePath` 指定，启动参数需带 `--no-sandbox --disable-dev-shm-usage`。
  - 截图前必须安装中文字体 `fonts-noto-cjk`，否则页面中文会渲染成方框（tofu）。
  - 截图需先启动服务（5173 由 `start.sh` 提供），脚本通过 API 登录后写入 `localStorage` 的 `erp_token`/`erp_user` 完成鉴权。

[附件存储方式]
- Date: 2026-10-12
- Context: Agent 在补齐文件上传下载功能时发现
- Category: 构建方法
- Instructions:
  - 上传文件实体存放于 `backend/data/uploads/`，元数据记录在 `t_file` 表（软删除字段 `is_deleted`）。
  - 文件接口：`POST /api/v1/files` 上传、`GET /api/v1/files/:id/download` 下载、`DELETE /api/v1/files/:id` 软删除；前端下载使用 axios blob 方式（`src/utils/file.js`）。
  - 业务实体（供应商/采购单/货运批次等）的删除统一采用软删除（`is_deleted` 置 1），不做物理删除。
