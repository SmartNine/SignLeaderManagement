<template>
  <div>
    <div class="toolbar">
      <el-input v-model="filters.keyword" clearable placeholder="搜索名称" />
      <el-select v-model="filters.type"><el-option label="全部类型" value="" /><el-option v-for="item in types" :key="item.value" :label="item.label" :value="item.value" /></el-select>
      <el-select v-model="filters.status"><el-option label="全部状态" value="" /><el-option label="草稿" value="draft" /><el-option label="已上线" value="active" /><el-option label="已归档" value="archived" /></el-select>
      <el-button type="primary" @click="startCreate">新增预设</el-button>
    </div>

    <el-table :data="presets" v-loading="loading" border>
      <el-table-column label="预览" width="110"><template #default="{row}"><img :src="row.preview_url" class="thumb" /></template></el-table-column>
      <el-table-column prop="name" label="名称" min-width="170" />
      <el-table-column label="类型" width="100"><template #default="{row}">{{ typeLabel(row.preset_type) }}</template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{row}"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
      <el-table-column prop="sort_order" label="排序" width="75" />
      <el-table-column prop="updated_at" label="更新时间" width="180" />
      <el-table-column label="操作" width="290" fixed="right"><template #default="{row}">
        <el-button text size="small" @click="startEdit(row)">编辑</el-button>
        <el-button text size="small" @click="copyPreset(row)">复制</el-button>
        <el-button v-if="row.status !== 'active'" text size="small" type="success" @click="setStatus(row, 'active')">上线</el-button>
        <el-button v-else text size="small" type="warning" @click="setStatus(row, 'draft')">下线</el-button>
        <el-button v-if="row.status !== 'archived'" text size="small" type="danger" @click="setStatus(row, 'archived')">归档</el-button>
      </template></el-table-column>
    </el-table>

    <el-dialog v-model="editorVisible" :title="editingId ? '编辑预设' : '新增预设'" width="900px" destroy-on-close :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @closed="handleEditorClosed">
      <el-form label-width="110px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.presetType" :disabled="Boolean(editingId)" @change="resetPresetData"><el-option v-for="item in types" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" :precision="0" /></el-form-item>
        <el-form-item label="预览图" required>
          <el-upload :auto-upload="false" :show-file-list="false" accept="image/png,image/jpeg,image/webp" :on-change="selectPreview">
            <el-button>选择图片</el-button>
          </el-upload>
          <img v-if="previewDisplayUrl" :src="previewDisplayUrl" class="preview-image" />
        </el-form-item>

        <template v-if="form.presetType === 'basic'">
          <el-divider content-position="left">设计画布</el-divider>
          <el-form-item label="参考尺寸">
            <el-input-number v-model="form.data.width" :min="1" />
            <span class="multiply">×</span>
            <el-input-number v-model="form.data.height" :min="1" />
          </el-form-item>
          <el-form-item label="字体授权"><el-checkbox v-model="form.data.fontLicenseConfirmed">已确认所用字体可用于本项目</el-checkbox></el-form-item>
          <div class="section-title"><strong>文字对象</strong><el-button size="small" @click="addSlot">添加文字</el-button></div>
          <el-card v-for="(slot, index) in form.data.objects" :key="index" shadow="never" class="slot-card">
            <div class="section-title"><span>文字 {{ index + 1 }}</span><span><el-button text :disabled="index === 0" @click="moveSlot(index, -1)">上移</el-button><el-button text :disabled="index === form.data.objects.length - 1" @click="moveSlot(index, 1)">下移</el-button><el-button text type="danger" @click="removeSlot(index)">删除</el-button></span></div>
            <div class="grid">
              <label class="wide"><span>示例文字</span><el-input v-model="slot.text" /></label>
              <label><span>字体</span><el-select v-model="slot.fontFamily" filterable placeholder="选择 DIY 已安装字体"><el-option v-for="font in fontOptions" :key="font.name" :label="font.name" :value="font.name" /></el-select></label>
              <label><span>字号</span><el-input-number v-model="slot.fontSize" :min="1" /></label>
              <label><span>文本框宽度</span><el-input-number v-model="slot.width" :min="1" /></label>
              <label><span>颜色</span><el-color-picker v-model="slot.fill" /></label>
              <label><span>字重</span><el-select v-model="slot.fontWeight"><el-option label="Normal" value="normal" /><el-option label="Bold" value="bold" /></el-select></label>
              <label><span>字形</span><el-select v-model="slot.fontStyle"><el-option label="Normal" value="normal" /><el-option label="Italic" value="italic" /></el-select></label>
              <label><span>对齐</span><el-select v-model="slot.textAlign"><el-option label="Left" value="left" /><el-option label="Center" value="center" /><el-option label="Right" value="right" /><el-option label="Justify" value="justify" /></el-select></label>
              <label><span>字距</span><el-input-number v-model="slot.charSpacing" /></label>
              <label><span>行距</span><el-input-number v-model="slot.lineHeight" :min="0.1" :step="0.1" /></label>
              <label><span>X</span><el-input-number v-model="slot.left" /></label>
              <label><span>Y</span><el-input-number v-model="slot.top" /></label>
              <label><span>旋转</span><el-input-number v-model="slot.angle" :min="-360" :max="360" /></label>
              <label><span>横向缩放</span><el-input-number v-model="slot.scaleX" :min="0.01" :step="0.1" /></label>
              <label><span>纵向缩放</span><el-input-number v-model="slot.scaleY" :min="0.01" :step="0.1" /></label>
            </div>
          </el-card>
        </template>

        <template v-else-if="form.presetType === 'curve'">
          <el-form-item label="曲线档位"><el-select v-model="form.data.curveKey" @change="syncCurveAmount"><el-option v-for="item in curveOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
          <el-form-item label="曲度"><el-input-number v-model="form.data.curveAmount" disabled /></el-form-item>
        </template>

        <template v-else-if="form.presetType === 'shadow'">
          <el-form-item label="阴影颜色"><el-color-picker v-model="form.data.shadowColor" /></el-form-item>
          <el-form-item label="透明度（%）"><el-input-number v-model="form.data.shadowOpacity" :min="0" :max="100" /></el-form-item>
          <el-form-item label="模糊（%）"><el-input-number v-model="form.data.blurPercent" :min="0" :max="100" /></el-form-item>
          <el-form-item label="X 偏移百分比"><el-input-number v-model="form.data.offsetXPercent" /></el-form-item>
          <el-form-item label="Y 偏移百分比"><el-input-number v-model="form.data.offsetYPercent" /></el-form-item>
        </template>

        <template v-else-if="form.presetType === 'outline'">
          <el-form-item label="文字颜色"><el-color-picker v-model="form.data.fillColor" /></el-form-item>
          <el-form-item label="描边颜色"><el-color-picker v-model="form.data.strokeColor" /></el-form-item>
          <el-form-item label="描边宽度（%）"><el-input-number v-model="form.data.strokeWidthPercent" :min="0" :max="100" /></el-form-item>
        </template>

        <template v-else-if="form.presetType === 'glow'">
          <el-form-item label="文字颜色"><el-color-picker v-model="form.data.fillColor" /></el-form-item>
          <el-form-item label="发光颜色"><el-color-picker v-model="form.data.glowColor" /></el-form-item>
          <el-form-item label="透明度（%）"><el-input-number v-model="form.data.glowOpacity" :min="0" :max="100" /></el-form-item>
          <el-form-item label="模糊（%）"><el-input-number v-model="form.data.blurPercent" :min="0" :max="100" /></el-form-item>
        </template>
      </el-form>
      <el-alert type="info" :closable="false" title="实时预览将在共享渲染方案确定后补充；当前预览图由美术上传。" />
      <template #footer><el-button :disabled="saving" @click="editorVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="savePreset">保存草稿</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import {ElMessage} from 'element-plus'

// 功能一分支只开放 basic；stage2 再扩展特效类型。
const types = [{value: 'basic', label: '基础文字'}]
const curveValues = {strongUp: 100, mildUp: 40, flat: 0, mildDown: -40, strongDown: -100}
const curveOptions = [{value: 'strongUp', label: '强上弯'}, {value: 'mildUp', label: '轻上弯'}, {value: 'flat', label: '直线'}, {value: 'mildDown', label: '轻下弯'}, {value: 'strongDown', label: '强下弯'}]
const presets = ref([])
const fontOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const editorVisible = ref(false)
const editingId = ref(null)
const selectedPreview = ref(null)
const previewObjectUrl = ref('')
const filters = reactive({keyword: '', type: '', status: ''})
const form = reactive({name: '', presetType: 'basic', sortOrder: 0, previewUrl: '', data: {}})
const previewDisplayUrl = computed(() => previewObjectUrl.value || form.previewUrl)
const diyBackendUrl = import.meta.env.VITE_DIY_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://diy.signleaderdisplay.com')

const newSlot = () => ({type: 'textbox', text: 'Your Text', originalText: 'Your Text', styles: {}, fontFamily: 'Arial', fontSize: 64, width: 300, fill: '#141737', fontWeight: 'normal', fontStyle: 'normal', charSpacing: 0, lineHeight: 1.16, textAlign: 'left', left: 80, top: 80, angle: 0, scaleX: 1, scaleY: 1, editable: true, selectable: true, evented: true})
function defaultData(type) {
  if (type === 'basic') return {version: 1, width: 480, height: 320, fontLicenseConfirmed: false, objects: [newSlot()]}
  if (type === 'curve') return {curveKey: 'flat', curveAmount: 0}
  if (type === 'shadow') return {shadowColor: '#000000', shadowOpacity: 80, blurPercent: 15, offsetXPercent: 5, offsetYPercent: 5}
  if (type === 'outline') return {strokeColor: '#000000', strokeWidthPercent: 8, fillColor: '#FFFFFF'}
  return {glowColor: '#E11A60', glowOpacity: 90, blurPercent: 25, fillColor: '#FFFFFF'}
}
function resetPresetData() { form.data = defaultData(form.presetType) }
function resetForm() { editingId.value = null; form.name = ''; form.presetType = 'basic'; form.sortOrder = 0; form.previewUrl = ''; selectedPreview.value = null; clearObjectUrl(); resetPresetData() }
function startCreate() { resetForm(); editorVisible.value = true }
function startEdit(row) { editingId.value = row.id; form.name = row.name; form.presetType = row.preset_type; form.sortOrder = row.sort_order; form.previewUrl = row.preview_url; form.data = JSON.parse(JSON.stringify(row.preset_data)); selectedPreview.value = null; clearObjectUrl(); editorVisible.value = true }
function addSlot() { form.data.objects.push(newSlot()) }
function removeSlot(index) { if (form.data.objects.length === 1) return ElMessage.warning('至少保留一个文字对象'); form.data.objects.splice(index, 1) }
function moveSlot(index, direction) { const target = index + direction; if (target < 0 || target >= form.data.objects.length) return; const [slot] = form.data.objects.splice(index, 1); form.data.objects.splice(target, 0, slot) }
function syncCurveAmount() { form.data.curveAmount = curveValues[form.data.curveKey] }
function clearObjectUrl() { if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value); previewObjectUrl.value = '' }
function selectPreview(file) { if (!file.raw) return; selectedPreview.value = file.raw; clearObjectUrl(); previewObjectUrl.value = URL.createObjectURL(file.raw) }
function handleEditorClosed() { clearObjectUrl(); selectedPreview.value = null }

async function request(url, options) { const res = await fetch(url, options); const data = await res.json(); if (!res.ok) throw new Error(data.message || '请求失败'); return data }
async function loadPresets() {
  loading.value = true
  const params = new URLSearchParams()
  if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
  if (filters.type) params.set('preset_type', filters.type)
  if (filters.status) params.set('status', filters.status)
  try { presets.value = await request(`/api/text-presets?${params}`) } catch (err) { ElMessage.error(err.message) } finally { loading.value = false }
}
async function loadFontOptions() {
  try {
    const res = await fetch(`${diyBackendUrl}/api/get-font-options`)
    const data = await res.json()
    if (!res.ok || data.code !== 0 || !Array.isArray(data.results)) throw new Error(data.message || '字体列表加载失败')
    fontOptions.value = data.results
  } catch (err) {
    ElMessage.error(`DIY 字体列表加载失败：${err.message}`)
  }
}
async function uploadPreview(file, currentUrl) {
  if (!file) return {previewUrl: currentUrl, objectKey: ''}
  const body = new FormData()
  body.append('file', file)
  const data = await request('/api/text-presets/upload-preview', {method: 'POST', body})
  return {previewUrl: data.preview_url, objectKey: data.object_key}
}
async function cleanupUploadedPreview(objectKey) {
  if (!objectKey) return
  try { await request('/api/text-presets/upload-preview', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({object_key: objectKey})}) } catch (err) { console.error('清理预览图失败:', err) }
}
async function savePreset() {
  if (!form.name.trim()) return ElMessage.warning('请填写名称')
  if (!selectedPreview.value && !form.previewUrl) return ElMessage.warning('请选择预览图')
  if (form.presetType === 'basic' && form.data.fontLicenseConfirmed !== true) return ElMessage.warning('请先确认字体授权')
  saving.value = true
  let uploadedObjectKey = ''
  try {
    const targetId = editingId.value
    const snapshot = {name: form.name.trim(), preset_type: form.presetType, preset_data: JSON.parse(JSON.stringify(form.data)), sort_order: form.sortOrder}
    const uploaded = await uploadPreview(selectedPreview.value, form.previewUrl)
    uploadedObjectKey = uploaded.objectKey
    const payload = {...snapshot, preview_url: uploaded.previewUrl}
    await request(targetId ? `/api/text-presets/${targetId}` : '/api/text-presets', {method: targetId ? 'PUT' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})
    uploadedObjectKey = ''
    ElMessage.success(targetId ? '保存成功' : '已保存为草稿'); editorVisible.value = false; await loadPresets()
  } catch (err) { await cleanupUploadedPreview(uploadedObjectKey); ElMessage.error(err.message) } finally { saving.value = false }
}
async function setStatus(row, status) { try { await request(`/api/text-presets/${row.id}/status`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status})}); await loadPresets() } catch (err) { ElMessage.error(err.message) } }
async function copyPreset(row) { try { await request(`/api/text-presets/${row.id}/copy`, {method: 'POST'}); ElMessage.success('已复制为草稿'); await loadPresets() } catch (err) { ElMessage.error(err.message) } }
const typeLabel = (value) => types.find((item) => item.value === value)?.label || value
const statusLabel = (value) => ({draft: '草稿', active: '已上线', archived: '已归档'}[value] || value)
const statusType = (value) => ({draft: 'info', active: 'success', archived: 'warning'}[value] || 'info')
let filterTimer
watch(filters, () => { clearTimeout(filterTimer); filterTimer = setTimeout(loadPresets, 250) })
onMounted(() => Promise.all([loadPresets(), loadFontOptions()]))
onBeforeUnmount(() => { clearTimeout(filterTimer); clearObjectUrl() })
</script>

<style scoped>
.toolbar { display: grid; grid-template-columns: 220px 150px 150px auto; gap: 12px; margin-bottom: 16px; }
.thumb { width: 80px; height: 54px; object-fit: contain; background: #f5f7fa; }
.preview-image { width: 150px; height: 100px; object-fit: contain; margin-left: 16px; border: 1px solid #dcdfe6; }
.multiply { padding: 0 10px; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; }
.slot-card { margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.grid label { display: flex; flex-direction: column; gap: 5px; color: #606266; font-size: 12px; }
.grid .wide { grid-column: span 2; }
</style>
