<template>
  <el-card style="margin-top: 20px">
    <h2>上传记录查询</h2>

    <el-form inline>
      <el-form-item label="SKU">
        <el-input v-model="sku" placeholder="输入 SKU 查询" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadAssets">查询资源</el-button>
        <el-button type="primary" @click="loadTemplates">查询模板</el-button>
        <el-button type="primary" @click="loadGlobals">查询公共资源</el-button>
        <el-button type="primary" @click="loadUVTemplates"
          >查询UV模板</el-button
        >
      </el-form-item>
    </el-form>

    <el-tabs v-model="activeTab" style="margin-top: 20px">
      <el-tab-pane label="资源列表" name="assets">
        <el-table :data="assets" stripe style="width: 100%">
          <el-table-column label="SKU" prop="sku" width="150" />
          <el-table-column label="类型" prop="type" width="100" />
          <el-table-column label="名称" prop="name" />
          <el-table-column label="OSS 链接">
            <template #default="{ row }">
              <a :href="row.oss_url" target="_blank">下载</a>
            </template>
          </el-table-column>
          <el-table-column label="预览图" width="120">
            <template #default="{ row }">
              <img
                v-if="row.preview_url"
                :src="row.preview_url"
                style="width: 80px"
              />
            </template>
          </el-table-column>
          <!-- 新增：查看UV模板 -->
          <el-table-column
            label="UV模板"
            width="120"
            v-if="activeTab === 'assets'"
          >
            <template #default="{ row }">
              <el-button
                v-if="row.type === '3d_model'"
                size="small"
                @click="viewUVTemplates(row.id)"
              >
                查看UV模板
              </el-button>
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
              <img
                v-if="row.preview_url"
                :src="row.preview_url"
                style="width: 80px"
              />
            </template>
          </el-table-column>
          <el-table-column label="标签" prop="tags" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="公共资源" name="globals">
        <el-table :data="globals" stripe style="width: 100%">
          <el-table-column label="分类" prop="category" width="120" />
          <el-table-column label="名称" prop="name" />
          <el-table-column label="OSS 链接">
            <template #default="{ row }">
              <a :href="row.oss_url" target="_blank">下载</a>
            </template>
          </el-table-column>
          <el-table-column label="标签" prop="tags" />
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleString() }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="UV模板" name="uvtemplates">
        <el-table :data="uvTemplates" stripe style="width: 100%">
          <el-table-column label="SKU" prop="sku" width="120" />
          <el-table-column label="3D模型" prop="asset_name" width="200" />
          <el-table-column label="节点名称" prop="node_name" width="180" />
          <el-table-column label="模板名称" width="200">
            <template #default="{ row }">
              <span v-if="row.uv_template_url">
                {{ getTemplateFileName(row.uv_template_url) }}
              </span>
              <span v-else style="color: #999">-</span>
            </template>
          </el-table-column>
          <el-table-column label="UV模板">
            <template #default="{ row }">
              <div v-if="row.uv_template_url">
                <img
                  :src="row.uv_template_url"
                  style="width: 80px; display: block; margin-bottom: 5px"
                />
                <a
                  :href="row.uv_template_url"
                  target="_blank"
                  style="font-size: 12px"
                  >下载</a
                >
              </div>
              <span v-else style="color: #999">未上传</span>
            </template>
          </el-table-column>
          <el-table-column label="预览图" width="120">
            <template #default="{ row }">
              <img
                v-if="row.preview_url"
                :src="row.preview_url"
                style="width: 80px"
              />
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleString() }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup>
import { ref } from "vue";

const sku = ref("");
const assets = ref([]);
const templates = ref([]);
const activeTab = ref("assets");

const globals = ref([]);

const uvTemplates = ref([]);

// 从URL中提取文件名
function getTemplateFileName(url) {
  if (!url) return "-";
  const parts = url.split("/");
  const fileName = parts[parts.length - 1];
  // 移除时间戳前缀，只显示原始文件名
  const match = fileName.match(/^\d+_(.+)$/);
  return match ? match[1] : fileName;
}

async function loadUVTemplates() {
  try {
    const res = await fetch(
      `http://localhost:3000/query/uv-templates?sku=${sku.value}`
    );

    const data = await res.json();

    // 添加调试信息
    console.log("UV模板API返回数据:", data);
    console.log("数据类型:", typeof data);
    console.log("是否为数组:", Array.isArray(data));

    // 确保数据是数组
    if (Array.isArray(data)) {
      uvTemplates.value = data;
    } else {
      console.error("返回的数据不是数组:", data);
      uvTemplates.value = [];
    }
    activeTab.value = "uvtemplates";
  } catch (error) {
    console.error("获取UV模板失败:", error);
    uvTemplates.value = []; // 确保设置为空数组
  }
}

async function loadGlobals() {
  const res = await fetch(`http://localhost:3000/query/globals`);
  globals.value = await res.json();
  activeTab.value = "globals";
}

async function loadAssets() {
  const res = await fetch(
    `http://localhost:3000/query/assets?sku=${sku.value}`
  );
  assets.value = await res.json();
  activeTab.value = "assets";
}

async function loadTemplates() {
  const res = await fetch(
    `http://localhost:3000/query/templates?sku=${sku.value}`
  );
  templates.value = await res.json();
  activeTab.value = "templates";
}

async function viewUVTemplates(assetId) {
  try {
    const res = await fetch(`http://localhost:3000/nodes/by-asset/${assetId}`);
    const nodes = await res.json();

    // 显示UV模板信息
    const templateInfo = nodes.map((node) => ({
      node: node.node_name,
      template: node.uv_template_url ? "已上传" : "未上传",
      url: node.uv_template_url,
    }));

    // 可以用ElementPlus的Dialog显示详情
    console.log("UV模板信息:", templateInfo);
    // 或者跳转到UV模板页面
  } catch (error) {
    console.error("获取UV模板失败:", error);
  }
}
</script>
