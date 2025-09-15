const express = require("express");
const router = express.Router();
const { EditableNode } = require("../models");

const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs").promises;
const ossClient = require("../services/ossClient");

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

      // 上传UV模板文件
      const uvKey = `uv-templates/${node.node_name}/${Date.now()}_${
        uv_file[0].originalname
      }`;
      const uvResult = await ossClient.put(uvKey, uv_file[0].path);
      await fs.unlink(uv_file[0].path);

      let preview_url = null;
      if (preview && preview[0]) {
        const previewKey = `uv-templates/${
          node.node_name
        }/preview_${Date.now()}_${preview[0].originalname}`;
        const previewResult = await ossClient.put(previewKey, preview[0].path);
        await fs.unlink(preview[0].path);
        preview_url = previewResult.url;
      }

      const uv_template_url = uvResult.url;

      node.uv_template_url = uv_template_url;
      if (preview_url) node.preview_url = preview_url;

      await node.save();

      res.json({
        success: true,
        message: "UV模板已上传",
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
