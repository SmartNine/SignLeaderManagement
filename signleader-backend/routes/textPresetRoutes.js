const express = require('express')
const multer = require('multer')
const {v4: uuidv4} = require('uuid')
const {Op} = require('sequelize')
const {TextPreset} = require('../models')
const ossClient = require('../services/ossClient')
const {putTemporaryUpload} = require('../utils/ossUpload')

const router = express.Router()
const upload = multer({
  dest: 'uploads/',
  limits: {fileSize: 5 * 1024 * 1024},
  fileFilter: (_req, file, callback) => callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)),
})
const VALID_TYPES = new Set(['basic', 'curve', 'shadow', 'outline', 'glow'])
const VALID_STATUSES = new Set(['draft', 'active', 'archived'])
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isPercent = (value) => isNumber(value) && value >= 0 && value <= 100
const isColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const PREVIEW_KEY_PATTERN = /^text-presets\/preview\/[a-f0-9-]+\.(png|jpe?g|jfif|webp)$/i
const PREVIEW_EXTENSIONS = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp'}
let previewMutationTail = Promise.resolve()

function withPreviewMutationLock(callback) {
  const result = previewMutationTail.then(callback, callback)
  previewMutationTail = result.catch(() => {})
  return result
}

function managedPreviewKey(url) {
  try {
    const key = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
    return PREVIEW_KEY_PATTERN.test(key) ? key : null
  } catch (_err) {
    return null
  }
}

async function deleteUnreferencedPreview(url) {
  const objectKey = managedPreviewKey(url)
  if (!objectKey || await TextPreset.count({where: {preview_url: url}}) > 0) return
  await ossClient.delete(objectKey)
}

async function ensureManagedPreviewExists(url) {
  const objectKey = managedPreviewKey(url)
  if (!objectKey) return
  try {
    await ossClient.head(objectKey)
  } catch (_error) {
    const error = new Error('预览图不存在或已被删除')
    error.status = 400
    throw error
  }
}

function receivePreview(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({message: '预览图不能超过 5MB'})
    }
    if (error) return res.status(400).json({message: error.message})
    next()
  })
}

function validateBasic(data) {
  if (!isNumber(data.width) || !isNumber(data.height) || data.width <= 0 || data.height <= 0) return '参考画布宽高必须大于 0'
  if (data.fontLicenseConfirmed !== true) return '尚未确认字体授权'
  if (!Array.isArray(data.objects) || data.objects.length === 0) return '至少需要一个文字对象'
  for (const [index, slot] of data.objects.entries()) {
    const label = `第 ${index + 1} 个文字对象`
    if (!['text', 'i-text', 'textbox'].includes(slot.type)) return `${label}类型无效`
    if (!String(slot.text || '').trim()) return `${label}缺少示例文字`
    if (!String(slot.fontFamily || '').trim()) return `${label}缺少字体`
    if (!isNumber(slot.fontSize) || slot.fontSize <= 0) return `${label}字号无效`
    if (!isColor(slot.fill)) return `${label}颜色无效`
    if (!['normal', 'bold'].includes(slot.fontWeight)) return `${label}字重无效`
    if (!['normal', 'italic'].includes(slot.fontStyle)) return `${label}字形无效`
    if (!['left', 'center', 'right', 'justify'].includes(slot.textAlign)) return `${label}对齐方式无效`
    if (![slot.width, slot.charSpacing, slot.lineHeight, slot.left, slot.top, slot.angle, slot.scaleX, slot.scaleY].every(isNumber)) return `${label}排版参数无效`
    if (slot.width <= 0 || slot.scaleX <= 0 || slot.scaleY <= 0) return `${label}尺寸或缩放无效`
    if (slot.lineHeight <= 0) return `${label}行距必须大于 0`
  }
  return null
}

function validatePresetData(type, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'preset_data 必须是对象'
  if (type === 'basic') return validateBasic(data)
  if (type === 'curve') {
    const values = {strongUp: 100, mildUp: 40, flat: 0, mildDown: -40, strongDown: -100}
    if (!(data.curveKey in values) || !isNumber(data.curveAmount) || data.curveAmount !== values[data.curveKey]) return '曲线档位与曲度不匹配'
  }
  if (type === 'shadow') {
    if (!isColor(data.shadowColor) || !isPercent(data.shadowOpacity) || !isPercent(data.blurPercent)) return '阴影参数无效'
    if (![data.offsetXPercent, data.offsetYPercent].every(isNumber)) return '阴影偏移参数无效'
  }
  if (type === 'outline' && (!isColor(data.strokeColor) || !isColor(data.fillColor) || !isPercent(data.strokeWidthPercent))) return '描边参数无效'
  if (type === 'glow') {
    if (!isColor(data.glowColor) || !isColor(data.fillColor) || !isPercent(data.glowOpacity) || !isPercent(data.blurPercent)) return '发光参数无效'
    if (['offsetX', 'offsetY', 'offsetXPercent', 'offsetYPercent'].some((key) => key in data)) return '发光偏移固定为 0，不能配置偏移字段'
  }
  return null
}

function validatePayload(body) {
  if (typeof body.name !== 'string' || !body.name.trim()) return '缺少有效的预设名称'
  if (!VALID_TYPES.has(body.preset_type)) return '非法预设类型'
  if (typeof body.preview_url !== 'string' || !body.preview_url.trim()) return '缺少有效的预览图地址'
  if (!Number.isInteger(body.sort_order) || body.sort_order < 0) return '排序值必须是非负整数'
  if (body.preset_data === undefined) return '缺少预设参数'
  return validatePresetData(body.preset_type, body.preset_data)
}

router.get('/', async (req, res) => {
  try {
    const where = {}
    if (req.query.preset_type) {
      if (!VALID_TYPES.has(req.query.preset_type)) return res.status(400).json({message: '非法预设类型'})
      where.preset_type = req.query.preset_type
    }
    if (req.query.status) {
      if (!VALID_STATUSES.has(req.query.status)) return res.status(400).json({message: '非法状态值'})
      where.status = req.query.status
    }
    if (String(req.query.keyword || '').trim()) where.name = {[Op.like]: `%${req.query.keyword.trim()}%`}
    res.json(await TextPreset.findAll({where, order: [['sort_order', 'ASC'], ['id', 'ASC']]}))
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({message: err.message})
  }
})

router.get('/:id', async (req, res) => {
  try {
    const preset = await TextPreset.findByPk(req.params.id)
    if (!preset) return res.status(404).json({message: '预设不存在'})
    res.json(preset)
  } catch (err) {
    console.error(err)
    res.status(500).json({message: err.message})
  }
})

router.post('/upload-preview', receivePreview, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({message: '仅支持 5MB 内的 PNG、JPEG 或 WebP 图片'})
    const ext = PREVIEW_EXTENSIONS[req.file.mimetype]
    const objectKey = `text-presets/preview/${uuidv4()}${ext}`
    const result = await putTemporaryUpload(objectKey, req.file)
    res.json({success: true, preview_url: result.url, object_key: objectKey})
  } catch (err) {
    console.error(err)
    res.status(500).json({message: err.message})
  }
})

router.delete('/upload-preview', async (req, res) => {
  try {
    await withPreviewMutationLock(async () => {
      const objectKey = String(req.body?.object_key || '')
      if (!PREVIEW_KEY_PATTERN.test(objectKey)) {
        const error = new Error('非法预览图路径')
        error.status = 400
        throw error
      }
      const previews = await TextPreset.findAll({attributes: ['preview_url']})
      if (previews.some((preset) => managedPreviewKey(preset.preview_url) === objectKey)) {
        const error = new Error('预览图正在被预设使用，不能删除')
        error.status = 409
        throw error
      }
      await ossClient.delete(objectKey)
    })
    res.json({success: true})
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({message: err.message})
  }
})

router.post('/', async (req, res) => {
  try {
    const error = validatePayload(req.body)
    if (error) return res.status(400).json({message: error})
    const preset = await withPreviewMutationLock(async () => {
      await ensureManagedPreviewExists(req.body.preview_url.trim())
      return TextPreset.create({name: req.body.name.trim(), preset_type: req.body.preset_type, preview_url: req.body.preview_url.trim(), preset_data: req.body.preset_data, sort_order: req.body.sort_order, data_version: 1, status: 'draft'})
    })
    res.status(201).json({success: true, id: preset.id})
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({message: err.message})
  }
})

router.put('/:id', async (req, res) => {
  try {
    const outcome = await withPreviewMutationLock(async () => {
      const preset = await TextPreset.findByPk(req.params.id)
      if (!preset) return {status: 404, message: '预设不存在'}
      const merged = {...preset.toJSON(), ...req.body}
      const error = validatePayload(merged)
      if (error) return {status: 400, message: error}
      const previousPreviewUrl = preset.preview_url
      const nextPreviewUrl = merged.preview_url.trim()
      await ensureManagedPreviewExists(nextPreviewUrl)
      await preset.update({name: merged.name.trim(), preset_type: merged.preset_type, preview_url: nextPreviewUrl, preset_data: merged.preset_data, sort_order: merged.sort_order})
      if (previousPreviewUrl !== nextPreviewUrl) {
        try {
          await deleteUnreferencedPreview(previousPreviewUrl)
        } catch (error) {
          console.error('清理旧预览图失败:', error)
        }
      }
      return null
    })
    if (outcome) return res.status(outcome.status).json({message: outcome.message})
    res.json({success: true})
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({message: err.message})
  }
})

router.post('/:id/copy', async (req, res) => {
  try {
    const source = await TextPreset.findByPk(req.params.id)
    if (!source) return res.status(404).json({message: '预设不存在'})
    const copy = await TextPreset.create({name: `${source.name} 副本`, preset_type: source.preset_type, preview_url: source.preview_url, preset_data: source.preset_data, sort_order: source.sort_order + 1, data_version: source.data_version, status: 'draft'})
    res.status(201).json({success: true, id: copy.id})
  } catch (err) {
    console.error(err)
    res.status(500).json({message: err.message})
  }
})

router.patch('/:id/status', async (req, res) => {
  try {
    if (!VALID_STATUSES.has(req.body.status)) return res.status(400).json({message: '非法状态值'})
    const preset = await TextPreset.findByPk(req.params.id)
    if (!preset) return res.status(404).json({message: '预设不存在'})
    if (req.body.status === 'active') {
      const error = validatePayload(preset.toJSON())
      if (error) return res.status(400).json({message: `不能上线：${error}`})
    }
    await preset.update({status: req.body.status})
    res.json({success: true})
  } catch (err) {
    console.error(err)
    res.status(500).json({message: err.message})
  }
})

module.exports = router
