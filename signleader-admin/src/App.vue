<template>
  <el-container style="height: 100vh">
    <el-header>
      <h1 style="color: white">🖨️ Signleader 资源管理后台</h1>
    </el-header>
    <el-main>
      <upload />
      <hr />
      <list />
    </el-main>
  </el-container>
</template>

<script setup>
import Upload from "./views/Upload.vue";
import List from "./views/List.vue";
</script>

<style>
.el-header {
  background: #409eff;
  padding: 16px;
}
</style>
