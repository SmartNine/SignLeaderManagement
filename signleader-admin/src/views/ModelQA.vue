<template>
  <div class="model-qa">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <el-upload
        accept=".glb,.gltf"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="onFileChange"
      >
        <el-button type="primary" :loading="loadingGlb">上传 GLB 模型</el-button>
      </el-upload>
      <span v-if="fileName" class="file-name">{{ fileName }}</span>
    </div>

    <!-- 主区域：加载中或已加载后显示 -->
    <div v-if="sceneReady || loadingGlb" class="main-area">
      <!-- 左侧：3D 视口 -->
      <div class="preview-panel">
        <div ref="canvasContainer" class="canvas-container" />
        <div v-if="loadingGlb" class="canvas-overlay">加载模型中...</div>
      </div>

      <!-- 右侧：验收面板 -->
      <div class="config-panel">

        <!-- 灯光预设 -->
        <div class="section">
          <div class="section-title">灯光预设</div>
          <el-radio-group v-model="lightPreset" size="small" @change="applyLightPreset">
            <el-radio-button value="production">生产环境</el-radio-button>
            <el-radio-button value="art">艺术三点光</el-radio-button>
          </el-radio-group>
          <div class="hint-text">
            {{ lightPreset === 'production'
              ? '与生产编辑器完全一致，验收用户实际看到的效果'
              : '三点布光，判断模型造型和材质质量' }}
          </div>
        </div>

        <!-- UV 检查 -->
        <div class="section">
          <div class="section-title">UV 检查</div>
          <el-button
            :type="uvCheckActive ? 'warning' : 'default'"
            size="small"
            :disabled="!sceneReady"
            @click="toggleUVCheck"
          >
            {{ uvCheckActive ? '恢复原材质' : '应用 UV Checker' }}
          </el-button>
          <div class="hint-text">标准格检图，检查 UV 拉伸、翻转、接缝和贴图密度不均</div>
        </div>

        <!-- 节点列表 -->
        <div class="section section-nodes">
          <div class="section-title">
            节点列表
            <span class="node-count">共 {{ nodeList.length }} 个</span>
          </div>
          <div class="legend">
            <span class="dot dot-edit" /><span>_edit 可编辑面</span>
            <span class="dot dot-warn" /><span>命名警告</span>
            <span class="dot dot-normal" /><span>普通节点</span>
          </div>
          <div class="node-list">
            <div
              v-for="node in nodeList"
              :key="node.name"
              class="node-item"
              :class="[`type-${node.type}`, { highlighted: hoveredNode === node.name }]"
              @mouseenter="highlightNode(node.name)"
              @mouseleave="clearHighlight"
            >
              <span class="node-name">{{ node.name }}</span>
              <el-tag
                v-if="node.warn"
                size="small"
                type="warning"
                effect="plain"
                style="margin-left: 4px; flex-shrink: 0"
              >{{ node.warn }}</el-tag>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 未上传时的提示 -->
    <div v-else class="empty-hint">上传 GLB 文件开始验收</div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, nextTick } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ElMessage } from 'element-plus'

// ─── 响应式状态 ────────────────────────────────────────────────
const fileName    = ref('')
const loadingGlb  = ref(false)
const sceneReady  = ref(false)
const lightPreset = ref('production')
const uvCheckActive = ref(false)
const nodeList    = ref([])   // [{ name, type: 'edit'|'warn'|'normal', warn }]
const hoveredNode = ref('')

const canvasContainer = ref(null)

// ─── Three.js 变量 ─────────────────────────────────────────────
let renderer = null, scene = null, camera = null, controls = null
let animationId = null, resizeObserver = null

// 灯光
let ambientLight = null, hemisphereLight = null
let productionLights = []
let artLights = []   // [keyLight, fillLight, backLight]

// 材质管理
const meshMap           = new Map()   // name → Object3D
const originalMaterials = new Map()   // name → material（原始，UV检查恢复用）
let   uvCheckerTexture  = null

// ─── 文件上传入口 ───────────────────────────────────────────────
function onFileChange(file) {
  const raw = file.raw
  if (!raw) return
  fileName.value = raw.name
  loadGLB(raw)
}

// ─── GLB 加载 ──────────────────────────────────────────────────
async function loadGLB(file) {
  loadingGlb.value = true
  sceneReady.value = false
  uvCheckActive.value = false
  nodeList.value = []

  disposeThree()
  await nextTick()   // 等 canvasContainer 挂载到 DOM

  initScene()

  const url = URL.createObjectURL(file)
  const loader = new GLTFLoader()
  loader.load(
    url,
    (gltf) => {
      scene.add(gltf.scene)

      // 遍历节点：收集 mesh、保存原始材质
      const nodes = []
      gltf.scene.traverse((node) => {
        if (!node.name) return
        meshMap.set(node.name, node)
        if (node.isMesh) {
          originalMaterials.set(node.name, node.material)
          nodes.push(parseNodeName(node.name))
        }
      })

      // 排序：_edit 优先，其次命名警告，最后普通节点
      nodeList.value = nodes.sort((a, b) => {
        const order = { edit: 0, warn: 1, normal: 2 }
        return order[a.type] - order[b.type] || a.name.localeCompare(b.name)
      })

      // 自动调整相机
      const box = new THREE.Box3().setFromObject(gltf.scene)
      const center = box.getCenter(new THREE.Vector3())
      const size   = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 1.5)
      controls.target.copy(center)
      controls.update()

      loadingGlb.value = false
      sceneReady.value = true
      URL.revokeObjectURL(url)
    },
    undefined,
    () => {
      ElMessage.error('GLB 加载失败')
      loadingGlb.value = false
      URL.revokeObjectURL(url)
    }
  )
}

// ─── 节点命名解析 ───────────────────────────────────────────────
function parseNodeName(name) {
  const isEdit = name.endsWith('_edit')
  const base   = isEdit ? name.slice(0, -'_edit'.length) : name
  if (/\s/.test(base))                return { name, type: 'warn', warn: '含空格' }
  if (/[^a-zA-Z0-9_.\-]/.test(base))  return { name, type: 'warn', warn: '含特殊字符' }
  if (isEdit) return { name, type: 'edit', warn: null }
  return { name, type: 'normal', warn: null }
}

// ─── Three.js 场景初始化 ────────────────────────────────────────
function initScene() {
  const container = canvasContainer.value
  const width  = container.clientWidth
  const height = container.clientHeight

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping   // 与生产编辑器一致
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000)
  camera.position.set(0, 1.5, 5)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  initLights()

  resizeObserver = new ResizeObserver(() => {
    if (!renderer) return
    const w = container.clientWidth
    const h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(container)

  function animate() {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
}

// ─── 灯光初始化（两套预设同时挂载，通过 visible 切换）────────────
function initLights() {
  // 环境光（两套预设共用，强度随预设切换）
  ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  // ── 生产预设：半球光 + 8方向光（来自 EnvironmentManage.js）──
  hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
  scene.add(hemisphereLight)

  const prodPositions = [
    [5, 5, 5], [-5, 5, 5], [5, 5, -5], [-5, 5, -5],
    [5, -5, 5], [-5, -5, 5], [0, 10, 0], [0, -10, 0],
  ]
  productionLights = prodPositions.map(([x, y, z]) => {
    const l = new THREE.DirectionalLight(0xffffff, 0.5)
    l.position.set(x, y, z)
    scene.add(l)
    return l
  })

  // ── 艺术预设：三点布光（来自 glb-viewer 工具）──
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
  keyLight.position.set(-4, 4, 6)   // 近似 X=-45°, Y=25° 偏移
  keyLight.visible = false
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.7)
  fillLight.position.set(4, 2, 6)   // 近似 X=-30°, Y=15° 偏移
  fillLight.visible = false
  scene.add(fillLight)

  const backLight = new THREE.DirectionalLight(0xffffff, 0.7)
  backLight.position.set(0, 4, -6)  // 近似 X=0°, Y=-45° 偏移
  backLight.visible = false
  scene.add(backLight)

  artLights = [keyLight, fillLight, backLight]
}

// ─── 切换灯光预设 ───────────────────────────────────────────────
function applyLightPreset(preset) {
  if (!scene) return
  if (preset === 'production') {
    ambientLight.intensity = 0.8
    hemisphereLight.visible = true
    productionLights.forEach(l => { l.visible = true })
    artLights.forEach(l => { l.visible = false })
    renderer.toneMapping = THREE.NoToneMapping
  } else {
    ambientLight.intensity = 0.4
    hemisphereLight.visible = false
    productionLights.forEach(l => { l.visible = false })
    artLights.forEach(l => { l.visible = true })
    renderer.toneMapping = THREE.LinearToneMapping
    renderer.toneMappingExposure = 1.0
  }
}

// ─── UV Checker ────────────────────────────────────────────────
function makeUVCheckerTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 8×8 彩色格子（行色相 + 明暗交替）
  const cols = 8
  const cell = size / cols
  const hues = [200, 30, 120, 0, 270, 160, 45, 220]

  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const hue   = hues[row % hues.length]
      const light = (row + col) % 2 === 0 ? 75 : 35
      ctx.fillStyle = `hsl(${hue}, 65%, ${light}%)`
      ctx.fillRect(col * cell, row * cell, cell, cell)
    }
  }

  // 网格线
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth   = 1
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0);    ctx.lineTo(i * cell, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell);    ctx.lineTo(size, i * cell); ctx.stroke()
  }

  // 角落方向标注
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font      = 'bold 22px monospace'
  ctx.fillText('U→', 8, 28)
  ctx.save()
  ctx.translate(28, size - 8)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('V→', 0, 0)
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY      = false
  return tex
}

function toggleUVCheck() {
  if (!sceneReady.value) return
  uvCheckActive.value = !uvCheckActive.value

  if (uvCheckActive.value) {
    if (!uvCheckerTexture) uvCheckerTexture = makeUVCheckerTexture()
    meshMap.forEach((obj, name) => {
      if (!obj.isMesh) return
      obj.material = new THREE.MeshStandardMaterial({
        map: uvCheckerTexture,
        roughness: 1,
        metalness: 0,
      })
    })
  } else {
    meshMap.forEach((obj, name) => {
      if (!obj.isMesh) return
      const orig = originalMaterials.get(name)
      if (orig) obj.material = orig
    })
  }
}

// ─── 节点高亮（hover）──────────────────────────────────────────
function highlightNode(name) {
  if (uvCheckActive.value) return   // UV 检查期间跳过高亮
  hoveredNode.value = name
  const obj = meshMap.get(name)
  if (!obj || !obj.isMesh) return
  const mat = obj.material.clone()
  mat.emissive          = new THREE.Color(0xff6600)
  mat.emissiveIntensity = 0.6
  obj.material = mat
}

function clearHighlight() {
  const name = hoveredNode.value
  hoveredNode.value = ''
  if (!name || uvCheckActive.value) return
  const obj  = meshMap.get(name)
  const orig = originalMaterials.get(name)
  if (obj && obj.isMesh && orig) obj.material = orig
}

// ─── 销毁 Three.js 场景 ─────────────────────────────────────────
function disposeMaterial(material) {
  if (!material) return
  Object.values(material).forEach((value) => {
    if (value && value.isTexture) value.dispose()
  })
  material.dispose()
}

function disposeThree() {
  if (animationId)    cancelAnimationFrame(animationId)
  if (resizeObserver) resizeObserver.disconnect()

  // 释放已加载 GLB 的 geometry/material/texture（含 UV Checker 替换后的材质），
  // 避免连续上传多个模型对比验收时 GPU 资源累积
  meshMap.forEach((obj) => {
    if (!obj.isMesh) return
    obj.geometry?.dispose()
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
    materials.forEach(disposeMaterial)
  })
  originalMaterials.forEach(disposeMaterial)

  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
    renderer = null
  }
  if (uvCheckerTexture) {
    uvCheckerTexture.dispose()
    uvCheckerTexture = null
  }
  scene = null; camera = null; controls = null
  ambientLight = null; hemisphereLight = null
  productionLights = []; artLights = []
  meshMap.clear()
  originalMaterials.clear()
}

onBeforeUnmount(disposeThree)
</script>

<style scoped>
.model-qa {
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-name {
  font-size: 13px;
  color: #606266;
}

/* ── 主区域 ── */
.main-area {
  display: flex;
  gap: 16px;
  height: 640px;
}

.preview-panel {
  flex: 1;
  position: relative;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.canvas-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(240, 240, 240, 0.85);
  font-size: 14px;
  color: #666;
}

/* ── 右侧面板 ── */
.config-panel {
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.section {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-nodes {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-count {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.hint-text {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

/* ── 图例 ── */
.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #606266;
  flex-wrap: wrap;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.dot-edit   { background: #67c23a; }
.dot-warn   { background: #e6a23c; }
.dot-normal { background: #dcdfe6; }

/* ── 节点列表 ── */
.node-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  cursor: default;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.node-item.type-edit {
  border-left-color: #67c23a;
  background: #f0f9eb;
  color: #529b2e;
}

.node-item.type-warn {
  border-left-color: #e6a23c;
  background: #fdf6ec;
  color: #b88230;
}

.node-item.type-normal {
  border-left-color: #dcdfe6;
  color: #606266;
}

.node-item.highlighted {
  filter: brightness(0.9);
  border-left-color: #ff6600 !important;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 空状态 ── */
.empty-hint {
  color: #909399;
  font-size: 14px;
  padding: 40px 0;
  text-align: center;
}
</style>
