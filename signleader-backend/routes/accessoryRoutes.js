const express = require("express");
const router = express.Router();
const { ProductAsset } = require("../models");

// 查询产品 3D 模型信息（GLB URL + 现有 accessory_groups）
router.get("/product-asset", async (req, res) => {
  const { sku } = req.query;
  if (!sku) {
    return res.status(400).json({ error: "缺少 sku 参数" });
  }
  const asset = await ProductAsset.findOne({
    where: { sku, type: "3d_model" },
  });
  if (!asset) {
    return res.status(404).json({ error: "未找到该 SKU 的 3D 模型" });
  }
  res.json({
    id: asset.id,
    sku: asset.sku,
    oss_url: asset.oss_url,
    accessory_groups: asset.accessory_groups || {},
  });
});

// 保存 accessory_groups
router.post("/product-asset/accessory-groups", async (req, res) => {
  const { sku, accessory_groups } = req.body;
  if (!sku || !accessory_groups) {
    return res.status(400).json({ error: "缺少 sku 或 accessory_groups 参数" });
  }
  const asset = await ProductAsset.findOne({
    where: { sku, type: "3d_model" },
  });
  if (!asset) {
    return res.status(404).json({ error: "未找到该 SKU 的 3D 模型" });
  }
  await asset.update({ accessory_groups });
  res.json({ success: true });
});

module.exports = router;
