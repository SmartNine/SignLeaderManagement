const fs = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const ossClient = require('../services/ossClient');

// 内部工具，上传的人是美术同事，这里的上限只是兜个底防误传/防意外炸盘，
// 不是防真正恶意 zip bomb 的强对抗设计。
const MAX_ZIP_ENTRIES = 200;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200MB

// 美术在 Illustrator 导出 SVG 时，引用的位图（<image href="xxx.jpg">）是相对路径，
// 浏览器端 Fabric.js 加载 SVG 时没法解析这些本地路径 —— 需要美术把 SVG 连同它引用的
// 图片一起打包成 zip 上传，这里把图片传到 OSS 后改写 SVG 里对应的 href，让最终存的
// SVG 是一份可以从任意地方直接 fetch 渲染的自包含文件。
module.exports = async function rewriteSvgAssets(zipPath, ossKeyPrefix) {
  const tempDir = path.join(__dirname, '../temp', uuidv4());
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const zip = new AdmZip(zipPath);
    const fileEntries = zip.getEntries().filter((e) => !e.isDirectory);

    if (fileEntries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`压缩包内文件数超过上限（${MAX_ZIP_ENTRIES} 个）`);
    }
    const totalUncompressed = fileEntries.reduce((sum, e) => sum + e.header.size, 0);
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(`压缩包解压后体积超过上限（${MAX_TOTAL_UNCOMPRESSED_BYTES / 1024 / 1024}MB）`);
    }

    zip.extractAllTo(tempDir, true);

    // 用 entryName 找 svg，而不是只看解压目录第一层——美术/Finder 打包整个文件夹时
    // svg 常常在子目录里（如 template/design.svg），只扫顶层会误报"没有找到 svg"。
    // 多个 svg 时取路径最浅的那个。
    const svgEntry = fileEntries
      .filter((e) => e.entryName.toLowerCase().endsWith('.svg'))
      .sort((a, b) => a.entryName.split('/').length - b.entryName.split('/').length)[0];
    if (!svgEntry) {
      throw new Error('压缩包里没有找到 .svg 文件');
    }

    let svgText = await fs.readFile(path.join(tempDir, svgEntry.entryName), 'utf-8');
    const resources = {};

    for (const entry of fileEntries) {
      if (entry.entryName === svgEntry.entryName) continue;
      const ext = path.extname(entry.entryName);
      if (!/\.(png|jpe?g|gif|webp)$/i.test(ext)) continue;

      // href/xlink:href 里出现的引用通常是纯文件名，用 basename 匹配，不依赖目录结构
      const basename = path.basename(entry.entryName);
      if (!svgText.includes(basename)) continue;

      const ossKey = `${ossKeyPrefix}/${uuidv4()}${ext}`;
      const result = await ossClient.put(ossKey, path.join(tempDir, entry.entryName));
      resources[basename] = result.url;

      svgText = svgText.split(basename).join(result.url);
    }

    const rewrittenPath = path.join(tempDir, 'rewritten.svg');
    await fs.writeFile(rewrittenPath, svgText, 'utf-8');

    const svgKey = `${ossKeyPrefix}/${uuidv4()}.svg`;
    const svgResult = await ossClient.put(svgKey, rewrittenPath);

    return { svg_url: svgResult.url, resources };
  } finally {
    // 无论成功还是在任何一步异常退出，临时目录和原始 zip 都要清理，
    // 否则每次上传失败都会在磁盘上留下垃圾。catch 掉清理本身的错误，
    // 避免一个已经不存在的路径把原始业务错误吞掉。
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await fs.unlink(zipPath).catch(() => {});
  }
};
