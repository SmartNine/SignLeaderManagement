<template>
  <el-card style="margin-top: 20px;">
    <h2>上传记录查询</h2>

    <el-form inline>
      <el-form-item label="SKU">
        <el-input v-model="sku" placeholder="输入 SKU 查询" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadAssets">查询资源</el-button>
        <el-button type="primary" @click="loadTemplates">查询模板</el-button>
      </el-form-item>
    </el-form>

    <el-tabs v-model="activeTab" style="margin-top: 20px;">
      <el-tab-pane label="资源列表" name="assets">
        <el-table :data="assets" stripe style="width: 100%">
          <el-table-column label="类型" prop="type" width="100" />
          <el-table-column label="名称" prop="name" />
          <el-table-column label="OSS 链接">
            <template #default="{ row }">
              <a :href="row.oss_url" target="_blank">下载</a>
            </template>
          </el-table-column>
          <el-table-column label="预览图" width="120">
            <template #default="{ row }">
              <img v-if="row.preview_url" :src="row.preview_url" style="width: 80px;" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="预置模板" name="templates">
        <el-table :data="templates" stripe style="width: 100%">
          <el-table-column label="模板名称" prop="name" />
          <el-table-column label="模板 JSON">
            <template #default="{ row }">
              <a :href="row.oss_json_url" target="_blank">查看</a>
            </template>
          </el-table-column>
          <el-table-column label="预览图" width="120">
            <template #default="{ row }">
              <img v-if="row.preview_url" :src="row.preview_url" style="width: 80px;" />
            </template>
          </el-table-column>
          <el-table-column label="标签" prop="tags" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';

const sku = ref('');
const assets = ref([]);
const templates = ref([]);
const activeTab = ref('assets');

async function loadAssets() {
  const res = await fetch(`http://localhost:3000/query/assets?sku=${sku.value}`);
  assets.value = await res.json();
  activeTab.value = 'assets';
}

async function loadTemplates() {
  const res = await fetch(`http://localhost:3000/query/templates?sku=${sku.value}`);
  templates.value = await res.json();
  activeTab.value = 'templates';
}
</script>
