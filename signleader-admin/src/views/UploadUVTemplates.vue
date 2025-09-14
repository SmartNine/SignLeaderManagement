<template>
  <el-card>
    <h2>为 3D 模型上传 UV 模板</h2>

    <el-form :inline="true" @submit.prevent>
      <el-form-item label="模型 asset_id">
        <el-input v-model="assetId" placeholder="请输入 asset_id" style="width: 200px" />
      </el-form-item>
      <el-button type="primary" @click="loadNodes">查询节点</el-button>
    </el-form>

    <el-divider />

    <el-table :data="nodes" v-if="nodes.length">
      <el-table-column prop="node_name" label="节点名称" width="200" />
      <el-table-column label="UV 模板图">
        <template #default="{ row }">
          <img v-if="row.uv_template_url" :src="row.uv_template_url" style="width: 80px;" />
        </template>
      </el-table-column>
      <el-table-column label="上传新模板">
        <template #default="{ row }">
          <input type="file" @change="onFileChange($event, row.id)" />
        </template>
      </el-table-column>
      <el-table-column label="预览图（可选）">
        <template #default="{ row }">
          <input type="file" @change="onPreviewChange($event, row.id)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="submit(row.id)">上传</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';

const assetId = ref('');
const nodes = ref([]);
const files = ref({});
const previews = ref({});

async function loadNodes() {
  const res = await fetch(`http://localhost:3000/nodes/by-asset/${assetId.value}`);
  nodes.value = await res.json();
}

function onFileChange(e, id) {
  files.value[id] = e.target.files[0];
}

function onPreviewChange(e, id) {
  previews.value[id] = e.target.files[0];
}

async function submit(nodeId) {
  const formData = new FormData();
  if (!files.value[nodeId]) {
    return ElMessage.error('请先选择 UV 模板图');
  }

  formData.append('uv_file', files.value[nodeId]);
  if (previews.value[nodeId]) {
    formData.append('preview', previews.value[nodeId]);
  }

  const res = await fetch(`http://localhost:3000/nodes/${nodeId}/upload-uv`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (data.success) {
    ElMessage.success('上传成功');
    await loadNodes(); // 刷新预览图
  } else {
    ElMessage.error(data.message);
  }
}
</script>
