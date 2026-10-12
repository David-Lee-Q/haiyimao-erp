#!/bin/bash
# 海易贸生鲜外贸ERP 启动脚本（生产预览模式，避免 dev 热重载内存峰值引发 OOM）
#
# 退出码约定：
#   0 —— 服务已启动（含"本就在运行"）并校验通过
#   2 —— 启动失败
#
# 端口约定（保持不变）：后端 3001，前端 5173（对外统一访问 5173，/api 反向代理到 3001）

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=3001
FRONTEND_PORT=5173
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# 判断端口是否被监听
port_in_use() {
  ss -ltn "sport = :$1" | grep -q ":$1"
}

# 1. 已在运行则直接返回 0
if port_in_use "$BACKEND_PORT" && port_in_use "$FRONTEND_PORT"; then
  echo "[start] 服务已在运行（后端:$BACKEND_PORT 前端:$FRONTEND_PORT），无需重复启动"
  exit 0
fi

# 2. 清理残留进程（避免子进程占端口）
bash "$ROOT/stop.sh"

# 3. 安装依赖（仅缺失时）
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "[start] 安装后端依赖 ..."
  ( cd "$ROOT/backend" && npm install --no-audit --no-fund ) || { echo "[start] 后端依赖安装失败"; exit 2; }
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "[start] 安装前端依赖 ..."
  ( cd "$ROOT/frontend" && npm install --no-audit --no-fund ) || { echo "[start] 前端依赖安装失败"; exit 2; }
fi

# 限制 Node 运行时内存，防止 OOM（容器内存有限且无 swap）
export NODE_OPTIONS="--max-old-space-size=1024"

# 4. 清理前端构建缓存并生产构建
rm -rf "$ROOT/frontend/dist"
echo "[start] 构建前端生产包 ..."
( cd "$ROOT/frontend" && npm run build ) || { echo "[start] 前端构建失败"; exit 2; }

# 5. 初始化数据并启动后端
( cd "$ROOT/backend" && node src/seed.js )
export NODE_ENV=production
echo "[start] 启动后端 (0.0.0.0:$BACKEND_PORT) ..."
( cd "$ROOT/backend" && setsid node src/index.js </dev/null > "$LOG_DIR/backend.log" 2>&1 & )

ok=0
for i in $(seq 1 40); do
  if curl -s --max-time 2 "http://127.0.0.1:$BACKEND_PORT/api/v1/health" | grep -q "backend running"; then
    ok=1
    break
  fi
  sleep 0.5
done
if [ "$ok" -ne 1 ]; then
  echo "[start] 后端启动失败，日志如下："
  cat "$LOG_DIR/backend.log"
  exit 2
fi

# 6. 启动前端静态服务（vite preview：根路径返回 index.html，/api 反向代理到后端）
echo "[start] 启动前端 (0.0.0.0:$FRONTEND_PORT) ..."
( cd "$ROOT/frontend" && setsid node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port "$FRONTEND_PORT" </dev/null > "$LOG_DIR/frontend.log" 2>&1 & )

ok=0
for i in $(seq 1 40); do
  CODE="$(curl -s --max-time 2 -o /dev/null -w "%{http_code}" "http://127.0.0.1:$FRONTEND_PORT/")"
  if [ "$CODE" = "200" ]; then
    ok=1
    break
  fi
  sleep 0.5
done
if [ "$ok" -ne 1 ]; then
  echo "[start] 前端启动失败，日志如下："
  cat "$LOG_DIR/frontend.log"
  exit 2
fi

echo "[start] 启动成功：前端 http://0.0.0.0:$FRONTEND_PORT ，后端 http://0.0.0.0:$BACKEND_PORT"
exit 0
