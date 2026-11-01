<template>
  <div class="page ai-page">
    <div class="page-header">
      <h2 class="page-title">智能助手</h2>
      <el-tag v-if="health.enabled" type="success" size="small">{{ health.model }} · 已接入</el-tag>
      <el-tag v-else type="danger" size="small">未配置大模型</el-tag>
    </div>

    <el-tabs v-model="tab" class="card-block">
      <!-- 智能问答 -->
      <el-tab-pane label="智能问答" name="chat">
        <div class="chat-layout">
          <aside class="conv-side">
            <el-button class="new-btn" type="primary" plain :icon="Plus" @click="newConversation">新建对话</el-button>
            <div class="conv-list">
              <div
                v-for="c in conversations"
                :key="c.id"
                class="conv-item"
                :class="{ active: c.id === currentId }"
                @click="openConversation(c.id)"
              >
                <el-icon class="conv-ico"><ChatDotRound /></el-icon>
                <span class="conv-title">{{ c.title || '新对话' }}</span>
                <span class="conv-del" title="删除" @click.stop="removeConversation(c)"><el-icon><Delete /></el-icon></span>
              </div>
              <div v-if="!conversations.length" class="conv-empty">暂无历史对话</div>
            </div>
          </aside>

          <div class="chat-main">
            <div class="chat-box" ref="chatBox">
              <div v-if="!messages.length" class="chat-empty">
                <el-icon :size="34"><MagicStick /></el-icon>
                <p>你好，我是海易贸智能助手，可以解答系统业务问题，也能实时查询数据。</p>
                <div class="examples">
                  <el-tag v-for="e in chatExamples" :key="e" class="ex" @click="send(e)">{{ e }}</el-tag>
                </div>
              </div>
              <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
                <div class="avatar">
                  <el-icon v-if="m.role === 'user'"><User /></el-icon>
                  <el-icon v-else><MagicStick /></el-icon>
                </div>
                <div class="bubble">
                  <div class="content" v-html="formatAnswer(m.content)"></div>
                  <div v-if="m.queries && m.queries.length" class="sql-block">
                    <el-collapse>
                      <el-collapse-item :title="`本次查询了 ${m.queries.length} 条 SQL`">
                        <div v-for="(q, qi) in m.queries" :key="qi" class="sql-item">
                          <pre class="mono">{{ q.sql }}</pre>
                          <div v-if="q.error" class="sql-err">执行错误：{{ q.error }}</div>
                          <div v-else class="muted">返回 {{ (q.rows || []).length }} 行 · {{ (q.columns || []).join('、') }}</div>
                        </div>
                      </el-collapse-item>
                    </el-collapse>
                  </div>
                </div>
              </div>
              <div v-if="loading" class="msg assistant">
                <div class="avatar"><el-icon><MagicStick /></el-icon></div>
                <div class="bubble"><el-icon class="is-loading"><Loading /></el-icon> 正在思考…</div>
              </div>
            </div>
            <div class="chat-input">
              <el-input v-model="input" type="textarea" :rows="2" resize="none" placeholder="输入问题，例如：哪些批次临近到期？" @keydown.enter.exact.prevent="send()" />
              <el-button type="primary" :loading="loading" @click="send()">发送</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 智能问数 -->
      <el-tab-pane label="智能问数" name="data">
        <div class="data-input">
          <el-input v-model="question" type="textarea" :rows="2" resize="none" placeholder="用自然语言描述你想查询的数据，例如：近6个月每月采购金额" @keydown.enter.exact.prevent="runQuery" />
          <el-button type="primary" :loading="querying" @click="runQuery">查询</el-button>
        </div>
        <div class="examples" style="margin: 10px 0">
          <el-tag v-for="e in dataExamples" :key="e" class="ex" @click="quickQuery(e)">{{ e }}</el-tag>
        </div>

        <div v-if="result" class="result-block">
          <el-alert v-if="result.summary" type="info" :closable="false" class="summary">
            <div v-html="formatAnswer(result.summary)"></div>
          </el-alert>

          <div class="result-tools">
            <span class="mono muted">SQL</span>
            <el-button size="small" @click="copySql">复制 SQL</el-button>
            <el-button size="small" @click="exportCsv" :disabled="!result.rows.length">导出 CSV</el-button>
          </div>
          <pre class="mono sql-preview">{{ result.sql }}</pre>

          <EChart v-if="chartOption" :option="chartOption" :height="280" />

          <el-table :data="result.rows" size="small" border max-height="420" empty-text="无数据" style="margin-top: 8px">
            <el-table-column v-for="c in result.columns" :key="c" :prop="c" :label="c" min-width="120" show-overflow-tooltip />
          </el-table>
          <div class="muted" style="margin-top: 6px">共 {{ result.rows.length }} 行（最多展示 200 行）</div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MagicStick, User, Loading, Plus, ChatDotRound, Delete } from '@element-plus/icons-vue';
import api, { toastError } from '../api';
import EChart from '../components/EChart.vue';
import { downloadBlob } from '../utils/file';

const tab = ref('chat');
const health = ref({});
const input = ref('');
const messages = ref([]);
const loading = ref(false);
const chatBox = ref(null);

const conversations = ref([]);
const currentId = ref(null);

const question = ref('');
const querying = ref(false);
const result = ref(null);

const chatExamples = [
  '现在有哪些临期库存批次？',
  '本月采购总额是多少？',
  '哪些批次被温度告警锁定了？',
  'FEFO 出库规则是什么？',
];
const dataExamples = [
  '各温区的库存箱数和净重',
  '近6个月每月采购金额',
  '各供应商的在途采购金额排名',
  '当前各状态的采购订单数量',
];

function formatAnswer(text) {
  const esc = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n/g, '<br/>');
}

async function scrollBottom() {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
}

async function send(text) {
  const content = (text != null ? text : input.value).trim();
  if (!content || loading.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content });
  loading.value = true;
  await scrollBottom();
  try {
    const history = messages.value.map((m) => ({ role: m.role, content: m.content }));
    const res = await api.post('/ai/chat', { messages: history, conversation_id: currentId.value });
    messages.value.push({ role: 'assistant', content: res.data.answer, queries: res.data.queries });
    if (!currentId.value && res.data.conversation_id) currentId.value = res.data.conversation_id;
    await loadConversations();
  } catch (e) {
    messages.value.push({ role: 'assistant', content: `抱歉，出错了：${e.message}` });
    toastError(e);
  } finally {
    loading.value = false;
    scrollBottom();
  }
}

async function loadConversations() {
  try {
    const res = await api.get('/ai/conversations');
    conversations.value = res.data || [];
  } catch (e) {
    /* ignore */
  }
}

function newConversation() {
  currentId.value = null;
  messages.value = [];
  input.value = '';
}

async function openConversation(id) {
  if (id === currentId.value) return;
  try {
    const res = await api.get(`/ai/conversations/${id}`);
    currentId.value = id;
    messages.value = (res.data.messages || []).map((m) => ({ role: m.role, content: m.content, queries: m.queries }));
    scrollBottom();
  } catch (e) {
    toastError(e);
  }
}

async function removeConversation(c) {
  try {
    await ElMessageBox.confirm(`删除对话「${c.title || '新对话'}」？`, '提示', { type: 'warning' });
  } catch (e) {
    return;
  }
  try {
    await api.delete(`/ai/conversations/${c.id}`);
    if (currentId.value === c.id) newConversation();
    await loadConversations();
  } catch (e) {
    toastError(e);
  }
}

function quickQuery(e) {
  question.value = e;
  runQuery();
}

async function runQuery() {
  const q = question.value.trim();
  if (!q || querying.value) return;
  querying.value = true;
  result.value = null;
  try {
    const res = await api.post('/ai/query', { question: q });
    result.value = res.data;
    if (!res.data.rows || !res.data.rows.length) ElMessage.warning('未查询到数据');
  } catch (e) {
    toastError(e);
  } finally {
    querying.value = false;
  }
}

function copySql() {
  navigator.clipboard && navigator.clipboard.writeText(result.value.sql);
  ElMessage.success('SQL 已复制');
}

function exportCsv() {
  const cols = result.value.columns;
  const lines = [cols.join(',')];
  for (const row of result.value.rows) {
    lines.push(cols.map((c) => `"${String(row[c] == null ? '' : row[c]).replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `ai-query-${Date.now()}.csv`);
}

const chartOption = computed(() => {
  if (!result.value || !result.value.rows.length) return null;
  const { columns, rows } = result.value;
  if (columns.length < 2 || rows.length > 30) return null;
  const labelKey = columns[0];
  const valueKey = columns.find((c, i) => i > 0 && rows.every((r) => typeof r[c] === 'number'));
  if (!valueKey) return null;
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: rows.map((r) => r[labelKey]), axisLabel: { rotate: rows.length > 6 ? 30 : 0, hideOverlap: true } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: rows.map((r) => r[valueKey]), itemStyle: { color: '#16508f' }, barMaxWidth: 40 }],
  };
});

onMounted(async () => {
  try {
    const res = await api.get('/ai/health');
    health.value = res.data;
  } catch (e) {
    /* ignore */
  }
  await loadConversations();
  if (conversations.value.length) {
    await openConversation(conversations.value[0].id);
  }
});
</script>

<style scoped>
.ai-page { display: flex; flex-direction: column; }
.chat-layout { display: flex; gap: 14px; }
.conv-side { width: 210px; flex-shrink: 0; border-right: 1px solid #eef1f6; padding-right: 12px; display: flex; flex-direction: column; }
.new-btn { width: 100%; margin-bottom: 10px; }
.conv-list { flex: 1; overflow-y: auto; max-height: calc(100vh - 330px); }
.conv-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: #35455e; font-size: 13px; }
.conv-item:hover { background: #f2f6fc; }
.conv-item.active { background: #e8f2ff; color: #16508f; }
.conv-ico { flex-shrink: 0; }
.conv-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-del { opacity: 0; color: #9aa6b8; display: inline-flex; }
.conv-item:hover .conv-del { opacity: 1; }
.conv-del:hover { color: #f56c6c; }
.conv-empty { color: #9aa6b8; font-size: 12.5px; padding: 12px 10px; }
.chat-main { flex: 1; min-width: 0; }
.chat-box {
  height: calc(100vh - 320px);
  min-height: 320px;
  overflow-y: auto;
  padding: 8px 4px;
}
.chat-empty { text-align: center; color: #8a94a6; padding: 40px 10px; }
.chat-empty p { margin: 12px 0 16px; }
.msg { display: flex; gap: 10px; margin-bottom: 16px; }
.msg.user { flex-direction: row-reverse; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: #eaf3ff; color: #16508f;
}
.msg.user .avatar { background: #e8f6ec; color: #2f9e6b; }
.bubble {
  max-width: 78%; background: #f4f7fb; border-radius: 10px; padding: 10px 14px;
  line-height: 1.75; font-size: 13.5px; color: #1f2d3d;
}
.msg.user .bubble { background: #e8f3ff; }
.content :deep(code) { background: #e6ecf5; padding: 0 4px; border-radius: 4px; }
.sql-block { margin-top: 8px; }
.sql-item pre { background: #0f2039; color: #d6e4f5; padding: 8px; border-radius: 6px; overflow-x: auto; font-size: 12px; margin: 4px 0; }
.sql-err { color: #f56c6c; font-size: 12px; }
.chat-input { display: flex; gap: 10px; align-items: flex-end; margin-top: 10px; }
.data-input { display: flex; gap: 10px; align-items: flex-end; }
.result-block { margin-top: 14px; }
.summary { margin-bottom: 10px; }
.result-tools { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; }
.sql-preview { background: #0f2039; color: #d6e4f5; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
.ex { cursor: pointer; margin: 0 6px 6px 0; }
.examples { display: inline-block; }
@media (max-width: 768px) {
  .bubble { max-width: 100%; }
  .chat-box { height: auto; max-height: 60vh; }
  .chat-layout { flex-direction: column; }
  .conv-side { width: 100%; border-right: none; border-bottom: 1px solid #eef1f6; padding: 0 0 10px; }
  .conv-list { max-height: 150px; }
}
</style>
