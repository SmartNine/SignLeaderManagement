<template>
  <div class="accessory-config">
    <el-form inline style="margin-bottom: 16px">
      <el-form-item label="SKU">
        <el-input v-model="sku" placeholder="输入 SKU" style="width: 240px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="loadAsset">查询</el-button>
      </el-form-item>
    </el-form>

    <div v-if="assetLoaded" class="main-area">
      <!-- 左侧：3D 预览 -->
      <div class="preview-panel">
        <div ref="canvasContainer" class="canvas-container" />
        <div v-if="loadingGlb" class="canvas-overlay">加载模型中...</div>
      </div>

      <!-- 右侧：配件配置 -->
      <div class="config-panel">
        <!-- 节点列表 -->
        <div class="section">
          <div class="section-title">模型节点（点击高亮）</div>
          <div class="node-list">
            <div
              v-for="name in nodeNames"
              :key="name"
              class="node-item"
              :class="{ active: selectedNodes.includes(name), highlighted: highlightedNode === name }"
              @click="toggleNodeSelect(name)"
              @mouseenter="highlightNode(name)"
              @mouseleave="clearHighlight"
            >
              {{ name }}
            </div>
          </div>
        </div>

        <!-- 添加配件 -->
        <div class="section">
          <div class="section-title">添加配件</div>
          <el-form inline>
            <el-form-item label="配件 ID">
              <el-input v-model="newAccessoryId" placeholder="如 led、case" style="width: 140px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :disabled="!newAccessoryId || selectedNodes.length === 0" @click="addAccessory">
                添加（已选 {{ selectedNodes.length }} 个节点）
              </el-button>
            </el-form-item>
          </el-form>
          <div v-if="selectedNodes.length > 0" class="selected-nodes-preview">
            已选节点：{{ selectedNodes.join('、') }}
          </div>
        </div>

        <!-- 已配置列表 -->
        <div class="section">
          <div class="section-title">已配置配件</div>
          <div v-if="Object.keys(accessoryGroups).length === 0" style="color: #999; font-size: 13px">
            暂无配置
          </div>
          <el-table v-else :data="accessoryTableData" size="small" style="width: 100%">
            <el-table-column label="配件 ID" prop="id" width="120" />
            <el-table-column label="绑定节点" prop="nodes">
              <template #default="{ row }">
                <el-tag v-for="n in row.nodes" :key="n" size="small" style="margin-right: 4px">{{ n }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button type="danger" size="small" text @click="removeAccessory(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-button type="success" style="margin-top: 16px; width: 100%" @click="save">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const sku = ref('')
const loading = ref(false)
const assetLoaded = ref(false)
const loadingGlb = ref(false)

const nodeNames = ref([])
const selectedNodes = ref([])
const highlightedNode = ref(null)
const newAccessoryId = ref('')
const accessoryGroups = ref({})

const canvasContainer = ref(null)

// Three.js 相关
let renderer, scene, camera, controls, animationId
const meshMap = new Map()        // nodeName -> mesh
const originalMaterials = new Map() // nodeName -> original material

const accessoryTableData = computed(() =>
  Object.entries(accessoryGroups.value).map(([id, nodes]) => ({ id, nodes }))
)

async function loadAsset() {
  if (!sku.value.trim()) return
  loading.value = true
  try {
    const res = await fetch(`/api/accessories/product-asset?sku=${encodeURIComponent(sku.value.trim())}`)
    if (!res.ok) {
      const err = await res.json()
      ElMessage.error(err.error || '查询失败')
      return
    }
    const data = await res.json()
    accessoryGroups.value = data.accessory_groups || {}
    assetLoaded.value = true
    await initThree(data.oss_url)
  } finally {
    loading.value = false
  }
}

async function initThree(glbUrl) {
  loadingGlb.value = true
  disposeThree()

  await nextTick()

  const container = canvasContainer.value
  const width = container.clientWidth
  const height = container.clientHeight

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000)
  camera.position.set(0, 1.5, 3)

  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const loader = new GLTFLoader()
  loader.load(glbUrl, (gltf) => {
    scene.add(gltf.scene)

    // 收集所有命名节点
    gltf.scene.traverse((node) => {
      if ((node.isMesh || node.isGroup) && node.name) {
        meshMap.set(node.name, node)
        if (node.isMesh) {
          originalMaterials.set(node.name, node.material)
        }
      }
    })
    nodeNames.value = [...meshMap.keys()].sort()

    // 自动对准模型
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 1.5)
    controls.target.copy(center)
    controls.update()

    loadingGlb.value = false
  }, undefined, () => {
    ElMessage.error('GLB 加载失败')
    loadingGlb.value = false
  })

  function animate() {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
}

function highlightNode(name) {
  highlightedNode.value = name
  const mesh = meshMap.get(name)
  if (!mesh || !mesh.isMesh) return
  const clone = mesh.material.clone()
  clone.emissive = new THREE.Color(0xff6600)
  clone.emissiveIntensity = 0.6
  mesh.material = clone
}

function clearHighlight() {
  if (!highlightedNode.value) return
  const mesh = meshMap.get(highlightedNode.value)
  if (mesh && mesh.isMesh) {
    const orig = originalMaterials.get(highlightedNode.value)
    if (orig) mesh.material = orig
  }
  highlightedNode.value = null
}

function toggleNodeSelect(name) {
  const idx = selectedNodes.value.indexOf(name)
  if (idx === -1) {
    selectedNodes.value.push(name)
  } else {
    selectedNodes.value.splice(idx, 1)
  }
}

function addAccessory() {
  const id = newAccessoryId.value.trim()
  if (!id || selectedNodes.value.length === 0) return
  accessoryGroups.value[id] = [...selectedNodes.value]
  newAccessoryId.value = ''
  selectedNodes.value = []
}

function removeAccessory(id) {
  delete accessoryGroups.value[id]
  accessoryGroups.value = { ...accessoryGroups.value }
}

async function save() {
  try {
    const res = await fetch('/api/accessories/product-asset/accessory-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: sku.value.trim(), accessory_groups: accessoryGroups.value }),
    })
    if (!res.ok) {
      const err = await res.json()
      ElMessage.error(err.error || '保存失败')
      return
    }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

function disposeThree() {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  meshMap.clear()
  originalMaterials.clear()
  nodeNames.value = []
  selectedNodes.value = []
}

onBeforeUnmount(disposeThree)
</script>

<style scoped>
.accessory-config {
  padding: 8px 0;
}

.main-area {
  display: flex;
  gap: 16px;
  height: 620px;
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
  background: rgba(240, 240, 240, 0.8);
  font-size: 14px;
  color: #666;
}

.config-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.section {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.node-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.node-item {
  padding: 3px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}

.node-item:hover,
.node-item.highlighted {
  border-color: #ff6600;
  color: #ff6600;
}

.node-item.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.selected-nodes-preview {
  margin-top: 6px;
  font-size: 12px;
  color: #606266;
}
</style>
