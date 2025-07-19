const express = require('express');
const router = express.Router();
const { ProductAsset, PresetTemplate, GlobalAsset } = require('../models');

router.get('/assets', async (req, res) => {
  const { sku } = req.query;
  const list = await ProductAsset.findAll({
    where: sku ? { sku } : undefined,
    order: [['createdAt', 'DESC']]
  });
  res.json(list);
});

router.get('/templates', async (req, res) => {
  const { sku } = req.query;
  const list = await PresetTemplate.findAll({
    where: sku ? { sku } : undefined,
    order: [['createdAt', 'DESC']]
  });
  res.json(list);
});

router.get('/globals', async (req, res) => {
  const list = await GlobalAsset.findAll({
    order: [['createdAt', 'DESC']]
  });
  res.json(list);
});

module.exports = router;
