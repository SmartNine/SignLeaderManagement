const express = require('express');
const router = express.Router();
const multer = require('multer');
const unzipAndRewrite = require('../utils/unzipAndRewrite');

const upload = multer({ dest: 'uploads/' });

router.post('/upload-template-zip', upload.single('zipfile'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const result = await unzipAndRewrite(filePath);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ zip 解压或处理失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
