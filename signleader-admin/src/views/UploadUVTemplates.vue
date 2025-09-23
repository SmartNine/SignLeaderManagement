<template>
  <el-card>
    <h2>为 3D 模型上传 UV 模板</h2>

    <el-form :inline="true" @submit.prevent>
      <el-form-item label="选择3D模型">
        <el-select
          v-model="selectedAsset"
          placeholder="请选择3D模型"
          filterable
          clearable
          style="width: 300px"
        >
          <el-option
            v-for="asset in assets3D"
            :key="asset.id"
            :label="`${asset.sku} - ${asset.name}`"
            :value="asset"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="selectedAsset" label="已选模型">
        <el-tag type="success">
          SKU: {{ selectedAsset.sku }} | 名称: {{ selectedAsset.name }}
        </el-tag>
      </el-form-item>
      <el-button type="primary" @click="loadNodes">查询节点</el-button>
      <el-form-item v-if="nodes.length > 0" label="上传模式">
        <el-radio-group v-model="uploadMode">
          <el-radio value="universal"
            >整体上传（一个SVG应用到所有节点）</el-radio
          >
          <el-radio value="individual">单个上传（每个节点独立设置）</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <el-divider />

    <!-- 整体上传模式 -->
    <div v-if="uploadMode === 'universal' && nodes.length > 0">
      <h3>整体上传模式</h3>
      <p style="color: #666; margin-bottom: 20px">
        上传一个SVG模板，将应用到所有 {{ nodes.length }} 个编辑节点
      </p>

      <el-form-item label="选择SVG模板">
        <input type="file" accept=".svg" @change="onUniversalFileChange" />
      </el-form-item>

      <el-form-item label="预览图（可选）">
        <input
          type="file"
          accept="image/*"
          @change="onUniversalPreviewChange"
        />
      </el-form-item>

      <el-button
        type="primary"
        @click="universalSubmit"
        :disabled="!universalFile"
      >
        上传
      </el-button>
    </div>

    <el-table :data="nodes" v-if="uploadMode === 'individual' && nodes.length">
      <el-table-column prop="node_name" label="节点名称" width="200" />
      <el-table-column label="UV 模板图">
        <template #default="{ row }">
          <img
            v-if="row.uv_template_url"
            :src="row.uv_template_url"
            style="width: 80px"
          />
        </template>
      </el-table-column>
      <el-table-column label="上传新模板">
        <template #default="{ row }">
          <input
            type="file"
            :ref="`fileInput_${row.id}`"
            @change="onFileChange($event, row.id)"
          />
        </template>
      </el-table-column>
      <el-table-column label="预览图（可选）">
        <template #default="{ row }">
          <input
            type="file"
            :ref="`previewInput_${row.id}`"
            @change="onPreviewChange($event, row.id)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="submit(row.id)"
            >上传</el-button
          >
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { ref, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";

// 获取 API 基础地址
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4200";

const selectedAsset = ref(null);
const assets3D = ref([]);
const nodes = ref([]);
const files = ref({});
const previews = ref({});
const uploadMode = ref("individual");
const universalFile = ref(null);
const universalPreview = ref(null);

const fileInputRefs = ref({});
const previewInputRefs = ref({});

async function loadNodes() {
  if (!selectedAsset.value) {
    ElMessage.warning("请先选择3D模型");
    return;
  }
  const res = await fetch(
    `${API_BASE_URL}/nodes/by-asset/${selectedAsset.value.id}`
  );
  nodes.value = await res.json();
}

function onFileChange(e, id) {
  files.value[id] = e.target.files[0];

  // 保存input元素的引用
  fileInputRefs.value[id] = e.target;
}

function onPreviewChange(e, id) {
  previews.value[id] = e.target.files[0];

  // 保存input元素的引用
  previewInputRefs.value[id] = e.target;
}

async function submit(nodeId) {
  const formData = new FormData();
  if (!files.value[nodeId]) {
    return ElMessage.error("请先选择 UV 模板图");
  }

  formData.append("uv_file", files.value[nodeId]);
  if (previews.value[nodeId]) {
    formData.append("preview", previews.value[nodeId]);
  }

  const res = await fetch(`${API_BASE_URL}/nodes/${nodeId}/upload-uv`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (data.success) {
    ElMessage.success("上传成功");

    // 清除数据引用
    delete files.value[nodeId];
    delete previews.value[nodeId];

    // 直接清除对应的输入框
    if (fileInputRefs.value[nodeId]) {
      fileInputRefs.value[nodeId].value = "";
      delete fileInputRefs.value[nodeId];
    }
    if (previewInputRefs.value[nodeId]) {
      previewInputRefs.value[nodeId].value = "";
      delete previewInputRefs.value[nodeId];
    }

    await loadNodes(); // 刷新预览图
  } else {
    ElMessage.error(data.message);
  }
}

function onUniversalFileChange(e) {
  universalFile.value = e.target.files[0];
}

function onUniversalPreviewChange(e) {
  universalPreview.value = e.target.files[0];
}

async function universalSubmit() {
  if (!universalFile.value) {
    ElMessage.error("请选择SVG文件");
    return;
  }

  try {
    let successCount = 0;
    for (const node of nodes.value) {
      const formData = new FormData();
      formData.append("uv_file", universalFile.value);
      if (universalPreview.value) {
        formData.append("preview", universalPreview.value);
      }

      const res = await fetch(`${API_BASE_URL}/nodes/${node.id}/upload-uv`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        successCount++;
      }
    }

    if (successCount === nodes.value.length) {
      ElMessage.success(`上传成功！已应用到所有 ${nodes.value.length} 个节点`);
    } else {
      ElMessage.warning(
        `部分上传成功：${successCount}/${nodes.value.length} 个节点`
      );
    }

    // 清空表单
    universalFile.value = null;
    universalPreview.value = null;
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => (input.value = ""));

    await loadNodes();
  } catch (error) {
    ElMessage.error("上传失败：" + error.message);
  }
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/query/assets`);
    const allAssets = await res.json();
    assets3D.value = allAssets.filter((asset) => asset.type === "3d_model");
  } catch (error) {
    console.error("获取3D模型列表失败:", error);
  }
});
</script>
