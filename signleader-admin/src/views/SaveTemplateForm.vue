<template>
  <el-card>
    <h2>保存预设模板信息</h2>

    <el-form :model="form" label-width="100px" style="max-width: 600px;">
      <el-form-item label="SKU">
        <el-input v-model="form.sku" placeholder="产品 SKU" />
      </el-form-item>

      <el-form-item label="模板名称">
        <el-input v-model="form.name" placeholder="模板名称" />
      </el-form-item>

      <el-form-item label="JSON 地址">
        <el-input v-model="form.json_url" placeholder="JSON 链接地址" />
      </el-form-item>

      <el-form-item label="缩略图 URL">
        <el-input v-model="form.preview_url" placeholder="可选：预览图链接" />
      </el-form-item>

      <el-form-item label="色系">
        <el-input v-model="form.color_scheme" placeholder="如 black_gold / red_silver" />
      </el-form-item>

      <el-form-item label="标签">
        <el-input v-model="form.tags" placeholder="标签，用英文逗号分隔" />
      </el-form-item>

      <el-form-item label="上传人">
        <el-input v-model="form.created_by" placeholder="上传人或设计师姓名" />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="submit">提交保存</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="successMsg"
      type="success"
      :title="successMsg"
      show-icon
      style="margin-top: 20px;"
    />
    <el-alert
      v-if="errorMsg"
      type="error"
      :title="errorMsg"
      show-icon
      style="margin-top: 20px;"
    />
  </el-card>
</template>

<script setup>
import { ref } from 'vue';

// 获取 API 基础地址
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4200";

const form = ref({
  sku: '',
  name: '',
  json_url: '',       // 可在页面跳转时自动预填
  preview_url: '',
  color_scheme: '',
  tags: '',
  created_by: ''
});

const successMsg = ref('');
const errorMsg = ref('');

async function submit() {
  if (!form.value.sku || !form.value.json_url) {
    errorMsg.value = 'SKU 和 JSON 地址是必填项';
    return;
  }

  try {
    const res = await fetch('${API_BASE_URL}/templates/save-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    const data = await res.json();
    if (data.success) {
      successMsg.value = '保存成功，模板 ID：' + data.id;
      errorMsg.value = '';
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    successMsg.value = '';
    errorMsg.value = err.message;
  }
}
</script>
