const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const ossClient = require("../services/ossClient");
const fs = require("fs").promises;
const path = require("path");
const { extractEditableNodes } = require("../utils/glbUtils");

const {
  ProductAsset,
  PresetTemplate,
  GlobalAsset,
  EditableNode,
} = require("../models");

// 通用上传并保存到 OSS
async function uploadAndSave({ file, preview, ossKeyPrefix }) {
  const correctOriginalName = Buffer.from(file.originalname, "latin1").toString(
    "utf8"
  );
  const encodedFileName = encodeURIComponent(correctOriginalName);
  const ossKey = `${ossKeyPrefix}/${Date.now()}_${encodedFileName}`;

  console.log("1. file.originalname:", file.originalname);
  console.log("2. correctOriginalName:", correctOriginalName);
  console.log("3. encodedFileName:", encodedFileName);
  console.log("4. ossKey:", ossKey);

  const options = {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFileName}`,
    },
  };

  const result = await ossClient.put(ossKey, file.path, options);
  await fs.unlink(file.path);

  let previewUrl = null;
  if (preview) {
    const correctPreviewName = Buffer.from(
      preview.originalname,
      "latin1"
    ).toString("utf8");
    const encodedPreviewName = encodeURIComponent(correctPreviewName);
    const previewKey = `${ossKeyPrefix}/preview_${Date.now()}_${encodedPreviewName}`;

    console.log("1. preview.originalname:", preview.originalname);
    console.log("2. correctPreviewName:", correctPreviewName);
    console.log("3. encodedPreviewName:", encodedPreviewName);
    console.log("4. previewKey:", previewKey);

    const previewOptions = {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedPreviewName}`,
      },
    };
    const r2 = await ossClient.put(previewKey, preview.path, previewOptions);
    await fs.unlink(preview.path);
    previewUrl = r2.url;
  }

  return { url: result.url, preview_url: previewUrl };
}

// 上传 SKU 资源
router.post("/asset", upload, async (req, res) => {
  try {
    const { sku, type, name } = req.body;
    const { file, preview } = req.files;

    const { url, preview_url } = await uploadAndSave({
      file: file[0],
      preview: preview ? preview[0] : null,
      ossKeyPrefix: `product-assets/${sku}`,
    });

    // 创建主资源记录
    const asset = await ProductAsset.create({
      sku,
      type,
      name,
      oss_url: url,
      preview_url,
    });

    let editableNodes = [];

    // ✅ 如果是 3D 模型，解析可编辑节点
    if (type === "3d_model") {
      const glbPath = file[0].path;
      editableNodes = await extractEditableNodes(glbPath);

      // 可选：存入 editable_nodes 表
      for (const nodeName of editableNodes) {
        await EditableNode.create({
          asset_id: asset.id,
          node_name: nodeName,
          uv_template_url: "", // 后续上传时填入
          preview_url: "",
        });
      }
    }

    res.json({
      success: true,
      message: "上传成功",
      editable_nodes: editableNodes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 上传预置模板
router.post("/template", upload, async (req, res) => {
  try {
    const { sku, name, tags, created_by } = req.body;
    const { file, preview } = req.files;

    const { url, preview_url } = await uploadAndSave({
      file: file[0],
      preview: preview ? preview[0] : null,
      ossKeyPrefix: `preset-templates/${sku}`,
    });

    await PresetTemplate.create({
      sku,
      name,
      oss_json_url: url,
      preview_url,
      tags,
      created_by,
    });

    res.json({ success: true, message: "模板上传成功" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 上传公共素材
router.post("/global", upload, async (req, res) => {
  try {
    const { category, name, tags } = req.body;
    const { file } = req.files;

    const correctOriginalName = Buffer.from(
      file[0].originalname,
      "latin1"
    ).toString("utf8");
    const encodedFileName = encodeURIComponent(correctOriginalName);
    const ossKey = `global-assets/${category}/${Date.now()}_${encodedFileName}`;
    const options = {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedFileName}`,
      },
    };

    console.log("1. file[0].originalname:", file[0].originalname);
    console.log("2. correctOriginalName:", correctOriginalName);
    console.log("3. encodedFileName:", encodedFileName);
    console.log("4. ossKey:", ossKey);

    const result = await ossClient.put(ossKey, file[0].path, options);
    await fs.unlink(file[0].path);

    await GlobalAsset.create({
      category,
      name,
      oss_url: result.url,
      tags,
    });

    res.json({ success: true, message: "全局资源上传成功" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
