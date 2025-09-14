const express = require('express');
const router = express.Router();
const { PresetTemplate } = require('../models');

router.post('/save-template', async (req, res) => {
  try {
    const { sku, name, json_url, preview_url, color_scheme, tags, created_by } = req.body;

    if (!sku || !json_url) {
      return res.status(400).json({ success: false, message: '缺少 sku 或 json_url' });
    }

    const result = await PresetTemplate.create({
      sku,
      name,
      json_url,
      preview_url,
      color_scheme,
      tags,
      created_by
    });

    res.json({ success: true, id: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
