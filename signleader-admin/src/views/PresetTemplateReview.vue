<template>
  <div class="preset-template-review">
    <el-form inline style="margin-bottom: 16px">
      <el-form-item label="SKU">
        <el-input v-model="sku" placeholder="输入 SKU" style="width: 200px" @keyup.enter="loadNodes" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loadingNodes" @click="loadNodes">查询编辑面</el-button>
      </el-form-item>
      <el-form-item v-if="nodes.length > 0" label="编辑面">
        <el-select v-model="selectedNodeId" placeholder="选择编辑面" style="width: 240px" @change="onNodeChange">
          <el-option v-for="n in nodes" :key="n.id" :label="n.node_name" :value="n.id" />
        </el-select>
      </el-form-item>
    </el-form>

    <div v-if="selectedNodeId" class="main-area">
      <!-- 左侧：该编辑面下已有模板 -->
      <div class="template-list-panel">
        <div class="section-title">已有模板</div>
        <div v-if="templates.length === 0" style="color: #999; font-size: 13px">暂无模板</div>
        <div v-for="t in templates" :key="t.id" class="template-item">
          <img v-if="t.preview_url" :src="t.preview_url" class="template-thumb" />
          <div class="template-info">
            <div class="template-name">{{ t.name }}</div>
            <el-tag size="small" :type="statusTagType(t.status)">{{ statusLabel(t.status) }}</el-tag>
          </div>
          <div class="template-actions">
            <el-button size="small" text @click="editTemplate(t)">编辑</el-button>
            <el-tooltip
              v-if="t.status !== 'active' && !templateHasEditableText(t)"
              content="没有检测到可编辑文字对象，不能上线，请先编辑并确认分类结果"
            >
              <el-button size="small" text disabled>上线</el-button>
            </el-tooltip>
            <el-button
              v-else-if="t.status !== 'active'"
              size="small" text type="success"
              @click="setStatus(t, 'active')"
            >上线</el-button>
            <el-button
              v-if="t.status === 'active'"
              size="small" text type="warning"
              @click="setStatus(t, 'archived')"
            >下线</el-button>
            <el-button size="small" text type="danger" @click="removeTemplate(t)">删除</el-button>
          </div>
        </div>
        <el-button type="primary" style="width: 100%; margin-top: 12px" @click="startNewTemplate">
          + 新建模板
        </el-button>
      </div>

      <!-- 右侧：上传 / 审核编辑区 -->
      <div class="editor-panel" v-if="editing">
        <div class="section-title">{{ editingId ? '编辑模板' : '新建模板' }}</div>

        <el-form label-width="80px" style="margin-bottom: 12px">
          <el-form-item label="模板名称">
            <el-input v-model="templateName" style="width: 300px" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="sortOrder" :min="0" />
          </el-form-item>
        </el-form>

        <div v-if="!sourceSvgUrl" class="upload-zone">
          <input type="file" accept=".svg,.zip" @change="onSourceFileChange" />
          <p style="color: #999; font-size: 12px; margin-top: 6px">
            上传 .svg（自包含）或 .zip（svg + 引用的图片打包）
          </p>
        </div>

        <div v-else class="preview-and-objects">
          <div class="svg-preview">
            <img :src="sourceSvgUrl" />
          </div>

          <div class="object-list">
            <div v-if="parsing" style="color: #999">解析中...</div>
            <el-alert
              v-if="!parsing && objectEntries.length > 0 && noEditableTextDetected"
              type="warning"
              show-icon
              :closable="false"
              style="margin-bottom: 8px"
              title="未检测到任何可编辑文字对象"
              description="常见原因：美术导出 SVG 时文字被转成轮廓（outline/path），失去了可编辑性。请跟美术确认导出设置，不要直接当作正常模板保存。"
            />
            <div v-for="entry in objectEntries" :key="entry.index" class="object-row">
              <span class="object-type">{{ objectSummary(entry) }}</span>
              <el-select v-model="entry.role" size="small" style="width: 160px">
                <el-option v-for="r in ROLES" :key="r" :label="ROLE_LABELS[r]" :value="r" />
              </el-select>
            </div>
          </div>
        </div>

        <div style="margin-top: 16px; display: flex; gap: 8px">
          <el-button
            type="success"
            :disabled="!sourceSvgUrl || objectEntries.length === 0 || !templateName"
            @click="saveTemplate"
          >保存</el-button>
          <el-button @click="cancelEdit">取消</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { loadPresetTemplateSvg, serializeObject, ROLES, ROLE_LABELS } from '../libs/presetTemplateLoader'

const sku = ref('')
const loadingNodes = ref(false)
const nodes = ref([])
const selectedNodeId = ref(null)

const templates = ref([])

const editing = ref(false)
const editingId = ref(null)
const templateName = ref('')
const sortOrder = ref(0)
const sourceSvgUrl = ref('')
const parsing = ref(false)
const objectEntries = ref([])
let canvasWidth = 0
let canvasHeight = 0

// 真实素材测试发现：Illustrator 导出 SVG 时文字有可能被转成轮廓（outline/path），
// 分类器完全检测不到任何文字对象 —— 这种情况不能悄悄当成"正常但没有文字"的模板保存，
// 必须提示审核人员去跟美术确认导出设置。
const noEditableTextDetected = computed(() =>
  objectEntries.value.every((e) => e.role !== 'editable_text')
)

async function loadNodes() {
  if (!sku.value.trim()) return
  loadingNodes.value = true
  // 切换 SKU 查询时清掉上一个 SKU 留下的选中节点/模板列表/编辑状态，
  // 否则旧 selectedNodeId 仍是 truthy，可能把新建的模板挂到上一个 SKU 的节点上。
  selectedNodeId.value = null
  templates.value = []
  editing.value = false
  resetEditor()
  try {
    const res = await fetch(`/api/query/uv-templates?sku=${encodeURIComponent(sku.value.trim())}`)
    nodes.value = await res.json()
    if (nodes.value.length === 0) {
      ElMessage.warning('未找到该 SKU 的编辑面（需先在「上传 UV 模板」里建好编辑面）')
    }
  } finally {
    loadingNodes.value = false
  }
}

async function onNodeChange() {
  editing.value = false
  await loadTemplates()
}

async function loadTemplates() {
  const res = await fetch(`/api/layer-preset-templates/by-node/${selectedNodeId.value}`)
  templates.value = await res.json()
}

// 跟后端 PATCH /:id/status 的强制校验保持一致的前端提示——真正拦截在后端，
// 这里只是不让审核人员点了"上线"却弹出后端拒绝的糟糕体验。
function templateHasEditableText(t) {
  const objects = t.layer_objects && t.layer_objects.objects
  return Array.isArray(objects) && objects.some((o) => o.role === 'editable_text')
}

function statusLabel(s) {
  return { draft: '草稿', active: '已上线', archived: '已下线' }[s] || s
}
function statusTagType(s) {
  return { draft: 'info', active: 'success', archived: 'warning' }[s] || 'info'
}

function objectSummary(entry) {
  const obj = entry.object || entry
  if (['text', 'i-text', 'textbox'].includes(obj.type)) {
    return `文字: ${(obj.text || '').slice(0, 12)}`
  }
  if (obj.type === 'image') {
    return `图片 #${entry.index}`
  }
  return `${obj.type} #${entry.index}`
}

function resetEditor() {
  editingId.value = null
  templateName.value = ''
  sortOrder.value = 0
  sourceSvgUrl.value = ''
  objectEntries.value = []
  canvasWidth = 0
  canvasHeight = 0
}

function startNewTemplate() {
  resetEditor()
  editing.value = true
}

function editTemplate(t) {
  resetEditor()
  editing.value = true
  editingId.value = t.id
  templateName.value = t.name
  sortOrder.value = t.sort_order
  const lo = t.layer_objects || {}
  sourceSvgUrl.value = lo.source_svg_url || t.preview_url || ''
  canvasWidth = lo.canvasWidth || 0
  canvasHeight = lo.canvasHeight || 0
  objectEntries.value = (lo.objects || []).map((o) => ({ index: o.index, role: o.role, object: o }))
}

function cancelEdit() {
  editing.value = false
  resetEditor()
}

async function onSourceFileChange(e) {
  const file = e.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)
  formData.append('node_id', selectedNodeId.value)

  parsing.value = true
  try {
    const res = await fetch('/api/layer-preset-templates/upload-source', { method: 'POST', body: formData })
    const data = await res.json()
    if (!data.success) {
      ElMessage.error(data.message || '上传失败')
      return
    }
    sourceSvgUrl.value = data.svg_url

    const { classified, canvasWidth: w, canvasHeight: h } = await loadPresetTemplateSvg(data.svg_url)
    canvasWidth = w
    canvasHeight = h
    objectEntries.value = classified
  } catch (err) {
    ElMessage.error('解析失败：' + err.message)
    sourceSvgUrl.value = ''
  } finally {
    parsing.value = false
  }
}

function buildLayerObjects() {
  // serializeObject 只做简单属性读取（obj.left/obj.text/...），对 Fabric 实例（新解析）
  // 和已存过的纯 JSON 对象（编辑已有模板）都适用，不需要区分来源
  const objects = objectEntries.value.map((entry) => serializeObject(entry))
  return {
    source_svg_url: sourceSvgUrl.value,
    canvasWidth,
    canvasHeight,
    objects,
  }
}

function buildSlotManifest(layerObjects) {
  const manifest = {}
  for (const role of ROLES) manifest[role] = 0
  for (const obj of layerObjects.objects) {
    manifest[obj.role] = (manifest[obj.role] || 0) + 1
  }
  return manifest
}

async function saveTemplate() {
  const layer_objects = buildLayerObjects()
  const slot_manifest = buildSlotManifest(layer_objects)
  const payload = {
    node_id: selectedNodeId.value,
    name: templateName.value,
    preview_url: sourceSvgUrl.value,
    layer_objects,
    slot_manifest,
    sort_order: sortOrder.value,
  }

  const url = editingId.value ? `/api/layer-preset-templates/${editingId.value}` : '/api/layer-preset-templates'
  const method = editingId.value ? 'PUT' : 'POST'

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!data.success) {
    ElMessage.error(data.message || '保存失败')
    return
  }
  ElMessage.success('保存成功')
  editing.value = false
  resetEditor()
  await loadTemplates()
}

async function setStatus(t, status) {
  const res = await fetch(`/api/layer-preset-templates/${t.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  const data = await res.json()
  if (!data.success) {
    ElMessage.error(data.message || '操作失败')
    return
  }
  await loadTemplates()
}

async function removeTemplate(t) {
  try {
    await ElMessageBox.confirm(`确定删除模板「${t.name}」吗？此操作不可撤销。`, '删除模板', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const res = await fetch(`/api/layer-preset-templates/${t.id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!data.success) {
    ElMessage.error(data.message || '删除失败')
    return
  }
  await loadTemplates()
}
</script>

<style scoped>
.preset-template-review {
  padding: 8px 0;
}

.main-area {
  display: flex;
  gap: 16px;
}

.template-list-panel {
  width: 320px;
  flex-shrink: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.template-thumb {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: #f5f5f5;
  border-radius: 2px;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-actions {
  display: flex;
  flex-direction: column;
}

.editor-panel {
  flex: 1;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
}

.upload-zone {
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  padding: 24px;
  text-align: center;
}

.preview-and-objects {
  display: flex;
  gap: 16px;
}

.svg-preview {
  width: 320px;
  flex-shrink: 0;
  background: #f5f5f5;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.svg-preview img {
  max-width: 100%;
  max-height: 400px;
}

.object-list {
  flex: 1;
  max-height: 400px;
  overflow-y: auto;
}

.object-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.object-type {
  font-size: 12px;
  color: #606266;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
