const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const ossClient = require('../services/ossClient');
const fs = require('fs').promises;
const path = require('path');

const { ProductAsset, PresetTemplate, GlobalAsset } = require('../models');

// 通用上传并保存到 OSS
async function uploadAndSave({ file, preview, ossKeyPrefix }) {
  const ossKey = `${ossKeyPrefix}/${Date.now()}_${file.originalname}`;
  const result = await ossClient.put(ossKey, file.path);
  await fs.unlink(file.path);

  let previewUrl = null;
  if (preview) {
    const previewKey = `${ossKeyPrefix}/preview_${Date.now()}_${preview.originalname}`;
    const r2 = await ossClient.put(previewKey, preview.path);
    await fs.unlink(preview.path);
    previewUrl = r2.url;
  }

  return { url: result.url, preview_url: previewUrl };
}

// 上传 SKU 资源
router.post('/asset', upload, async (req, res) => {
  try {
    const { sku, type, name } = req.body;
    const { file, preview } = req.files;

    const { url, preview_url } = await uploadAndSave({
      file: file[0],
      preview: preview ? preview[0] : null,
      ossKeyPrefix: `product-assets/${sku}`
    });

    await ProductAsset.create({ sku, type, name, oss_url: url, preview_url });
    res.json({ success: true, message: '上传成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 上传预置模板
router.post('/template', upload, async (req, res) => {
  try {
    const { sku, name, tags, created_by } = req.body;
    const { file, preview } = req.files;

    const { url, preview_url } = await uploadAndSave({
      file: file[0],
      preview: preview ? preview[0] : null,
      ossKeyPrefix: `preset-templates/${sku}`
    });

    await PresetTemplate.create({
      sku,
      name,
      oss_json_url: url,
      preview_url,
      tags,
      created_by
    });

    res.json({ success: true, message: '模板上传成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 上传公共素材
router.post('/global', upload, async (req, res) => {
  try {
    const { category, name, tags } = req.body;
    const { file } = req.files;

    const ossKey = `global-assets/${category}/${Date.now()}_${file[0].originalname}`;
    const result = await ossClient.put(ossKey, file[0].path);
    await fs.unlink(file[0].path);

    await GlobalAsset.create({
      category,
      name,
      oss_url: result.url,
      tags
    });

    res.json({ success: true, message: '全局资源上传成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
