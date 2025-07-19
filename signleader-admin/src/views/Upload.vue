<template>
  <el-card>
    <h2>上传中心</h2>

    <!-- 上传类型选择 -->
    <el-form label-width="100px">
      <el-form-item label="上传类型">
        <el-select v-model="uploadType" placeholder="请选择">
          <el-option label="SKU 资源" value="asset" />
          <el-option label="预置模板" value="template" />
          <el-option label="公共素材" value="global" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-form :model="form" label-width="100px" style="margin-top: 20px">
      <!-- 通用字段：name -->
      <el-form-item label="名称">
        <el-input v-model="form.name" />
      </el-form-item>

      <!-- SKU 字段（asset/template） -->
      <el-form-item
        v-if="uploadType === 'asset' || uploadType === 'template'"
        label="SKU"
      >
        <el-input v-model="form.sku" />
      </el-form-item>

      <!-- 类型字段（仅 asset） -->
      <el-form-item v-if="uploadType === 'asset'" label="资源类型">
        <el-select v-model="form.type" placeholder="选择类型">
          <el-option label="3D 模型" value="3d_model" />
          <el-option label="2D 模板" value="2d_template" />
        </el-select>
      </el-form-item>

      <!-- 上传主文件 -->
      <el-form-item label="主文件">
        <input type="file" @change="onFileChange" />
      </el-form-item>

      <!-- 上传预览图（asset/template 可选） -->
      <el-form-item v-if="uploadType !== 'global'" label="预览图">
        <input type="file" @change="onPreviewChange" />
      </el-form-item>

      <!-- 标签（template/global） -->
      <el-form-item
        v-if="uploadType === 'template' || uploadType === 'global'"
        label="标签"
      >
        <el-input v-model="form.tags" placeholder="用逗号分隔" />
      </el-form-item>

      <!-- 上传人（template） -->
      <el-form-item v-if="uploadType === 'template'" label="上传人">
        <el-input v-model="form.created_by" />
      </el-form-item>

      <!-- 类别（global） -->
      <el-form-item v-if="uploadType === 'global'" label="资源分类">
        <el-select v-model="form.category" placeholder="选择类型">
          <el-option label="图片" value="image" />
          <el-option label="字体" value="font" />
          <el-option label="图案" value="pattern" />
          <el-option label="文字模板" value="text_template" />
        </el-select>
      </el-form-item>

      <!-- 提交按钮 -->
      <el-form-item>
        <el-button type="primary" @click="submit">提交上传</el-button>
      </el-form-item>
    </el-form>

    <el-alert v-if="successMsg" type="success" :title="successMsg" show-icon />
    <el-alert v-if="errorMsg" type="error" :title="errorMsg" show-icon />
  </el-card>
</template>

<script setup>
import { ref } from "vue";

const uploadType = ref("asset");
const form = ref({
  sku: "",
  type: "",
  name: "",
  tags: "",
  created_by: "",
  category: "",
});

const file = ref(null);
const preview = ref(null);
const successMsg = ref("");
const errorMsg = ref("");

function onFileChange(e) {
  file.value = e.target.files[0];
}
function onPreviewChange(e) {
  preview.value = e.target.files[0];
}

async function submit() {
  if (!uploadType.value || !file.value) {
    errorMsg.value = "请选择上传类型并选择文件";
    return;
  }

  const formData = new FormData();
  let endpoint = "";

  if (uploadType.value === "asset") {
    endpoint = "/upload/asset";
    formData.append("sku", form.value.sku);
    formData.append("type", form.value.type);
    formData.append("name", form.value.name);
  } else if (uploadType.value === "template") {
    endpoint = "/upload/template";
    formData.append("sku", form.value.sku);
    formData.append("name", form.value.name);
    formData.append("tags", form.value.tags);
    formData.append("created_by", form.value.created_by);
  } else if (uploadType.value === "global") {
    endpoint = "/upload/global";
    formData.append("category", form.value.category);
    formData.append("name", form.value.name);
    formData.append("tags", form.value.tags);
  }

  formData.append("file", file.value);
  if (preview.value && uploadType.value !== "global") {
    formData.append("preview", preview.value);
  }

  try {
    const res = await fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      successMsg.value = data.message || "上传成功";
      errorMsg.value = "";
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    successMsg.value = "";
    errorMsg.value = err.message || "上传失败";
  }
}
</script>
