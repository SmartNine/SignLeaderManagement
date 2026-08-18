import { fabric } from 'fabric'

// 移植自 prescott-legend 的原型（2026-08-17 跨项目协作定的分工：解析/分类逻辑归本项目维护，
// 编辑器那边只在套用模板时读取本项目产出的 layer_objects 现算最终 canvas_data，不再跑这套逻辑）。
// 目前只在 1 个 SKU（TF-L-01S）验证过，规则的普适性未知，人工审核环节就是用来兜底猜错的场景。

export const ROLES = ['editable_text', 'fixed_background_image', 'replaceable_image', 'decoration', 'colorable']

export const ROLE_LABELS = {
  editable_text: '可编辑文字',
  fixed_background_image: '固定背景图',
  replaceable_image: '可替换图片',
  decoration: '装饰（锁定）',
  colorable: '可换色',
}

// Fabric 内置 SVG 文字解析器会把多 <tspan> 的 <text> 压成一行，丢失换行。
// 按文档顺序重新解析原始 SVG XML，把每个 <text> 的 tspan 拼成 '\n' 连接的字符串，
// 按 index 对应回 Fabric 解析出的 text 对象。
function extractTextLinesFromSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const textEls = Array.from(doc.getElementsByTagName('text'))
  return textEls.map((textEl) => {
    const tspans = Array.from(textEl.getElementsByTagName('tspan'))
    if (tspans.length === 0) {
      return (textEl.textContent || '').trim()
    }
    return tspans.map((t) => t.textContent || '').join('\n')
  })
}

// 启发式分类，用于美术素材没有语义化图层命名的场景（本项目目前的实际情况——所有对象
// id 都是 AI 默认图层名）。规则按置信度排序：
//  - type 是 text/i-text/textbox -> 'editable_text'
//  - type 是 image 且缩放后实际渲染尺寸占画布面积 >= 45% 且在绘制顺序前半 -> 'fixed_background_image'
//  - type 是 image 但不满足上述条件 -> 'replaceable_image'
//  - 其余全部 -> 'decoration'（锁定）
// 这是猜测规则，不保证 100% 准确，需要人工审核环节纠正。
export function classifyObjects(objects, canvasWidth, canvasHeight) {
  const canvasArea = canvasWidth * canvasHeight
  return objects.map((obj, index) => {
    if (['text', 'i-text', 'textbox'].includes(obj.type)) {
      return { object: obj, role: 'editable_text', index }
    }
    if (obj.type === 'image') {
      const scaledWidth = typeof obj.getScaledWidth === 'function' ? obj.getScaledWidth() : (obj.width || 0) * (obj.scaleX || 1)
      const scaledHeight = typeof obj.getScaledHeight === 'function' ? obj.getScaledHeight() : (obj.height || 0) * (obj.scaleY || 1)
      const area = scaledWidth * scaledHeight
      const areaRatio = canvasArea > 0 ? area / canvasArea : 0
      const isEarlyInZOrder = index < objects.length / 2
      const role = areaRatio >= 0.45 && isEarlyInZOrder ? 'fixed_background_image' : 'replaceable_image'
      return { object: obj, role, index, areaRatio }
    }
    return { object: obj, role: 'decoration', index }
  })
}

// 除了 Fabric toObject() 默认就包含的通用属性（left/top/fill/stroke/opacity/...），
// 这些类型还需要各自的专属字段才能在消费端正确重建形状。
const TYPE_SPECIFIC_PROPS = {
  rect: ['rx', 'ry'],
  ellipse: ['rx', 'ry'],
  circle: ['radius'],
  path: ['path'],
  polygon: ['points'],
  polyline: ['points'],
  line: ['x1', 'y1', 'x2', 'y2'],
  text: ['text', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight'],
  'i-text': ['text', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight'],
  textbox: ['text', 'fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'lineHeight'],
  image: ['src', 'crossOrigin'],
}

// 从 Fabric 对象提取存进 layer_objects 的字段。prescott-legend 消费端是把这份 JSON
// 减去 role 后整体 spread 成 fabric.util.enlivenObjects 的输入（见 2026-08-17 对齐），
// 所以用 Fabric 自己的 toObject() 而不是手动挑属性——手动挑漏了 path/radius/points 等
// 类型专属字段，会让非文字/图片的普通图形（rect/circle/path 装饰）重建时变形或丢色。
export function serializeObject(entry) {
  const { object: obj, role, index } = entry
  if (typeof obj.toObject === 'function') {
    const extraProps = TYPE_SPECIFIC_PROPS[obj.type] || []
    return { ...obj.toObject(extraProps), index, role }
  }
  // 已经是之前存过的纯 JSON（编辑已有模板时从 layer_objects 回填，不是 Fabric 实例），
  // 本身字段就是完整的，原样带过、只刷新 index/role。
  return { ...obj, index, role }
}

export function loadPresetTemplateSvg(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((res) => res.text())
      .then((svgText) => {
        const textLines = extractTextLinesFromSvg(svgText)
        let textCursor = 0

        fabric.loadSVGFromURL(url, (objects, options) => {
          if (!objects || objects.length === 0) {
            reject(new Error(`SVG加载失败或为空: ${url}`))
            return
          }

          objects.forEach((obj) => {
            if (['text', 'i-text', 'textbox'].includes(obj.type)) {
              const rebuiltText = textLines[textCursor]
              textCursor += 1
              if (rebuiltText !== undefined && rebuiltText !== obj.text) {
                obj.set({ text: rebuiltText })
              }
            }
          })

          const canvasWidth = Number(options?.width) || Number(options?.viewBoxWidth) || 1000
          const canvasHeight = Number(options?.height) || Number(options?.viewBoxHeight) || 1000
          const classified = classifyObjects(objects, canvasWidth, canvasHeight)

          resolve({ objects, options, classified, canvasWidth, canvasHeight })
        })
      })
      .catch(reject)
  })
}
