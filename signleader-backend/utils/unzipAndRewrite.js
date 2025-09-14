const fs = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const ossClient = require('../services/ossClient');
const { v4: uuidv4 } = require('uuid');

module.exports = async function unzipAndRewrite(zipPath) {
  const tempDir = path.join(__dirname, '../temp', uuidv4());
  await fs.mkdir(tempDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempDir, true);

  const jsonPath = path.join(tempDir, 'main.json');
  const jsonStr = await fs.readFile(jsonPath, 'utf-8');
  let fabricJson = JSON.parse(jsonStr);

  const uploadMap = {};

  // 遍历 fabric 对象树，查找外部资源引用（图片、图案等）
  const traverse = async (obj) => {
    if (obj?.type === 'image' && obj.src && !obj.src.startsWith('http')) {
      const localPath = path.join(tempDir, obj.src);
      const ext = path.extname(obj.src);
      const ossKey = `template-assets/${uuidv4()}${ext}`;
      const result = await ossClient.put(ossKey, localPath);
      obj.src = result.url;
      uploadMap[obj.src] = result.url;
    }

    if (obj?.fill && typeof obj.fill === 'object' && obj.fill.src && !obj.fill.src.startsWith('http')) {
      const localPath = path.join(tempDir, obj.fill.src);
      const ext = path.extname(obj.fill.src);
      const ossKey = `template-assets/${uuidv4()}${ext}`;
      const result = await ossClient.put(ossKey, localPath);
      obj.fill.src = result.url;
      uploadMap[obj.fill.src] = result.url;
    }

    if (obj.objects) {
      for (let child of obj.objects) {
        await traverse(child);
      }
    }
  };

  await traverse(fabricJson);

  // 上传修正后的 JSON
  const newJsonPath = path.join(tempDir, 'rewritten.json');
  await fs.writeFile(newJsonPath, JSON.stringify(fabricJson, null, 2), 'utf-8');

  const finalKey = `template-json/${uuidv4()}.json`;
  const finalResult = await ossClient.put(finalKey, newJsonPath);

  // 清理临时文件（可选）
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.unlink(zipPath);

  return {
    message: '模板已处理并上传',
    json_url: finalResult.url,
    resources: uploadMap
  };
};
