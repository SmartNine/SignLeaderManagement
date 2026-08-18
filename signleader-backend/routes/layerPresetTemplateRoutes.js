const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const { LayerPresetTemplate, EditableNode } = require("../models");
const ossClient = require("../services/ossClient");
const rewriteSvgAssets = require("../utils/svgAssetRewrite");

const upload = multer({ dest: "uploads/", limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// POST /layer-preset-templates/upload-source
// 上传模板源文件：单个 .svg（自包含，无外链图片）或 .zip（svg + 引用的位图打包）
router.post("/upload-source", upload.single("file"), async (req, res) => {
  // rewriteSvgAssets 内部自己会清理 zip；.svg/不支持格式两种场景下 req.file.path
  // 都需要我们自己清理——放进 finally，覆盖 OSS 上传失败等任何异常路径，
  // 不然每次失败都会在 uploads/ 下留一个文件。
  let cleanupUploadPath = req.file ? req.file.path : null;
  try {
    const { node_id } = req.body;
    if (!node_id) return res.status(400).json({ message: "缺少 node_id" });

    const node = await EditableNode.findByPk(node_id);
    if (!node) return res.status(404).json({ message: "编辑面不存在" });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const ossKeyPrefix = `layer-preset-templates/${node_id}/source`;

    if (ext === ".zip") {
      cleanupUploadPath = null; // rewriteSvgAssets 自己的 finally 会清理这个 zip
      const { svg_url, resources } = await rewriteSvgAssets(req.file.path, ossKeyPrefix);
      return res.json({ success: true, svg_url, resources });
    }

    if (ext === ".svg") {
      const svgKey = `${ossKeyPrefix}/${uuidv4()}.svg`;
      const result = await ossClient.put(svgKey, req.file.path);
      return res.json({ success: true, svg_url: result.url, resources: {} });
    }

    return res.status(400).json({ message: "只支持 .svg 或 .zip（svg+图片打包）" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    if (cleanupUploadPath) {
      await fs.unlink(cleanupUploadPath).catch(() => {});
    }
  }
});

// POST /layer-preset-templates/upload-preview
// 上传模板缩略图
router.post("/upload-preview", upload.single("file"), async (req, res) => {
  try {
    const { node_id } = req.body;
    const ossKey = `layer-preset-templates/${node_id || "misc"}/preview/${uuidv4()}${path.extname(
      req.file.originalname
    )}`;
    const result = await ossClient.put(ossKey, req.file.path);
    res.json({ success: true, preview_url: result.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});

// GET /layer-preset-templates/by-node/:nodeId
router.get("/by-node/:nodeId", async (req, res) => {
  try {
    const templates = await LayerPresetTemplate.findAll({
      where: { node_id: req.params.nodeId },
      order: [
        ["sort_order", "ASC"],
        ["id", "ASC"],
      ],
    });
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET /layer-preset-templates/:id
router.get("/:id", async (req, res) => {
  try {
    const template = await LayerPresetTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: "模板不存在" });
    res.json(template);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// POST /layer-preset-templates
// 创建模板（人工审核确认分类结果后保存，默认 draft）
router.post("/", async (req, res) => {
  try {
    const { node_id, name, preview_url, layer_objects, slot_manifest, sort_order } = req.body;
    if (!node_id || !name || !layer_objects) {
      return res.status(400).json({ message: "缺少 node_id / name / layer_objects" });
    }
    const template = await LayerPresetTemplate.create({
      node_id,
      name,
      preview_url,
      layer_objects,
      slot_manifest,
      sort_order: sort_order || 0,
    });
    res.json({ success: true, id: template.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /layer-preset-templates/:id
// 更新模板内容（人工重新纠正分类结果 / 改名 / 改缩略图 / 改排序）
router.put("/:id", async (req, res) => {
  try {
    const template = await LayerPresetTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: "模板不存在" });

    const { name, preview_url, layer_objects, slot_manifest, sort_order } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (preview_url !== undefined) updates.preview_url = preview_url;
    if (layer_objects !== undefined) updates.layer_objects = layer_objects;
    if (slot_manifest !== undefined) updates.slot_manifest = slot_manifest;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    await template.update(updates);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// 没有任何 editable_text 角色的模板不能上线——常见原因是美术导出 SVG 时文字被转成了
// 轮廓（outline/path），后端在这里兜底，不能只靠前端审核 UI 的警告，否则可以绕过。
function hasEditableText(layerObjects) {
  const objects = layerObjects && layerObjects.objects;
  return Array.isArray(objects) && objects.some((o) => o.role === "editable_text");
}

// PATCH /layer-preset-templates/:id/status
// 上下线管理：draft / active / archived 状态切换
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "active", "archived"].includes(status)) {
      return res.status(400).json({ message: "非法状态值" });
    }
    const template = await LayerPresetTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: "模板不存在" });

    if (status === "active" && !hasEditableText(template.layer_objects)) {
      return res.status(400).json({ message: "该模板没有检测到任何可编辑文字对象，不能上线，请先跟美术确认导出设置" });
    }

    await template.update({ status });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /layer-preset-templates/:id
router.delete("/:id", async (req, res) => {
  try {
    const template = await LayerPresetTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: "模板不存在" });
    await template.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
