<template>
  <el-card>
    <h2>上传预设模板（.zip）</h2>

    <el-upload
      class="upload-demo"
      :before-upload="beforeUpload"
      :http-request="customUpload"
      :show-file-list="true"
      accept=".zip"
      drag
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">拖拽或点击上传 <b>.zip</b> 文件</div>
    </el-upload>

    <el-divider />

    <div v-if="jsonUrl">
      <el-alert type="success" title="模板已处理成功！" />
      <p>
        修复后的模板 JSON 链接：
        <a :href="jsonUrl" target="_blank">{{ jsonUrl }}</a>
      </p>

      <el-table :data="resourcesList" stripe style="width: 100%;">
        <el-table-column prop="name" label="原始路径" />
        <el-table-column prop="url" label="OSS 链接">
          <template #default="{ row }">
            <a :href="row.url" target="_blank">{{ row.url }}</a>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';

// 获取 API 基础地址
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4200";

const jsonUrl = ref('');
const resourcesList = ref([]);

function beforeUpload(file) {
  const isZip = file.type === 'application/zip' || file.name.endsWith('.zip');
  if (!isZip) {
    ElMessage.error('只能上传 .zip 文件');
    return false;
  }
  return true;
}

async function customUpload({ file }) {
  const formData = new FormData();
  formData.append('zipfile', file);

  try {
    const res = await fetch('${API_BASE_URL}/zip/upload-template-zip', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      jsonUrl.value = data.json_url;
      resourcesList.value = Object.entries(data.resources).map(([name, url]) => ({
        name,
        url
      }));
    } else {
      ElMessage.error(data.message || '上传失败');
    }
  } catch (err) {
    console.error(err);
    ElMessage.error(err.message);
  }
}
</script>
