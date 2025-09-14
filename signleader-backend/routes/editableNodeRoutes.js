const express = require("express");
const router = express.Router();
const { EditableNode } = require("../models");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const uploadOSS = require("../services/ossclient");

// POST /nodes/:id/upload-uv
router.post(
  "/:id/upload-uv",
  upload.fields([
    { name: "uv_file", maxCount: 1 },
    { name: "preview", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const node = await EditableNode.findByPk(req.params.id);
      if (!node) return res.status(404).json({ message: "节点不存在" });

      const { uv_file, preview } = req.files;

      const { url: uv_template_url, preview_url } = await uploadOSS({
        file: uv_file[0],
        preview: preview ? preview[0] : null,
        ossKeyPrefix: `uv-templates/${node.node_name}`,
      });

      node.uv_template_url = uv_template_url;
      if (preview_url) node.preview_url = preview_url;

      await node.save();

      res.json({
        success: true,
        message: "UV 模板已上传",
        uv_template_url,
        preview_url,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "上传失败" });
    }
  }
);

// GET /nodes/by-asset/:assetId
router.get("/by-asset/:assetId", async (req, res) => {
  try {
    const nodes = await EditableNode.findAll({
      where: { asset_id: req.params.assetId },
      order: [["node_name", "ASC"]],
    });

    res.json(nodes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "查询失败" });
  }
});

module.exports = router;
