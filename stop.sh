#!/bin/bash
# 海易贸生鲜外贸ERP 停止脚本
# 通过 ss 提取监听端口上的进程 PID 并终止，避免子进程残留占用端口。
# 注意：不使用 fuser/lsof；不添加 2>/dev/null 以免吞掉错误。

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORTS="3001 5173"

# 获取监听指定端口的 PID 列表
get_pids() {
  ss -ltnp "sport = :$1" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
}

# 递归终止进程及其子进程（避免 npm/node 包装进程残留）
kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid"); do
    kill_tree "$child"
  done
  kill "$pid" || true
}

echo "[stop] 开始停止海易贸生鲜外贸ERP 服务"

for PORT in $PORTS; do
  PIDS="$(get_pids "$PORT")"
  if [ -n "$PIDS" ]; then
    echo "[stop] 端口 $PORT 被占用，终止进程: $(echo $PIDS | tr '\n' ' ')"
    for PID in $PIDS; do
      kill_tree "$PID"
    done
  else
    echo "[stop] 端口 $PORT 未被占用"
  fi
done

# 等待端口释放
for i in $(seq 1 20); do
  BUSY=0
  for PORT in $PORTS; do
    if [ -n "$(get_pids "$PORT")" ]; then
      BUSY=1
    fi
  done
  [ "$BUSY" -eq 0 ] && break
  sleep 0.5
done

# 仍未释放则强制终止
for PORT in $PORTS; do
  PIDS="$(get_pids "$PORT")"
  if [ -n "$PIDS" ]; then
    echo "[stop] 端口 $PORT 仍被占用，强制终止: $(echo $PIDS | tr '\n' ' ')"
    for PID in $PIDS; do
      kill -9 "$PID"
    done
  fi
done

echo "[stop] 完成"
exit 0
