<template>
  <el-container style="height: 100vh">
    <el-header>
      <h1 style="color: white">🖨️ Signleader 资源管理后台</h1>
    </el-header>
    <el-main>
      <el-card>
        <el-tabs v-model="activeTab" type="border-card">
          <el-tab-pane label="上传 SKU 资源" name="asset">
            <Upload />
          </el-tab-pane>
          <!-- <el-tab-pane label="上传 ZIP 模板" name="zip">
            <TemplateZipUpload />
          </el-tab-pane> -->
          <el-tab-pane label="上传 UV 模板" name="uv">
            <UploadUVTemplates />
          </el-tab-pane>
          <!-- <el-tab-pane label="保存模板" name="save">
            <SaveTemplateForm />
          </el-tab-pane> -->
        </el-tabs>
      </el-card>
      <hr />
      <list />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from "vue";
import Upload from "./views/Upload.vue";
import TemplateZipUpload from "./views/TemplateZipUpload.vue";
import UploadUVTemplates from "./views/UploadUVTemplates.vue";
import SaveTemplateForm from "./views/SaveTemplateForm.vue";
import List from "./views/List.vue";

const activeTab = ref("asset");
</script>

<style>
.el-header {
  background: #409eff;
  padding: 16px;
}
</style>
