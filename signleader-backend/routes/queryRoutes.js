const express = require("express");
const router = express.Router();
const { ProductAsset, PresetTemplate, GlobalAsset } = require("../models");

router.get("/assets", async (req, res) => {
  const { sku } = req.query;
  const list = await ProductAsset.findAll({
    where: sku ? { sku } : undefined,
    order: [["createdAt", "DESC"]],
  });
  res.json(list);
});

router.get("/templates", async (req, res) => {
  const { sku } = req.query;
  const list = await PresetTemplate.findAll({
    where: sku ? { sku } : undefined,
    order: [["createdAt", "DESC"]],
  });
  res.json(list);
});

router.get("/globals", async (req, res) => {
  const list = await GlobalAsset.findAll({
    order: [["createdAt", "DESC"]],
  });
  res.json(list);
});

// 查询UV模板
router.get("/uv-templates", async (req, res) => {
  try {
    const { sku } = req.query;
    const { sequelize } = require("../models");

    // 使用原生SQL查询关联数据
    const query = `
      SELECT 
        en.id,
        en.node_name,
        en.uv_template_url,
        en.preview_url,
        en.created_at as createdAt,
        pa.sku,
        pa.name as asset_name
      FROM editable_nodes en
      LEFT JOIN product_assets pa ON en.asset_id = pa.id
      ${sku ? "WHERE pa.sku LIKE ?" : ""}
      ORDER BY en.created_at DESC
    `;

    const results = await sequelize.query(query, {
      replacements: sku ? [`%${sku}%`] : [],
      type: sequelize.QueryTypes.SELECT,
    });

    res.json(Array.isArray(results) ? results : []);
  } catch (error) {
    console.error("查询UV模板失败:", error);
    res.status(500).json([]);
  }
});

module.exports = router;
