const { NodeIO } = require('@gltf-transform/core');
const path = require('path');

/**
 * 解析 GLB 文件，提取以 "_edit" 结尾的可编辑节点名
 * @param {string} glbPath - .glb 文件的完整路径
 * @returns {Promise<string[]>} - 返回节点名称数组
 */
async function extractEditableNodes(glbPath) {
  const io = new NodeIO();
  const doc = await io.read(glbPath);
  const root = doc.getRoot();
  const nodes = root.listNodes();

  const editable = nodes
    .filter(n => n.getName() && n.getName().endsWith('_edit'))
    .map(n => n.getName());

  return editable;
}

module.exports = { extractEditableNodes };
