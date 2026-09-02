const { DataTypes } = require('sequelize')

module.exports = (sequelize) => sequelize.define('TextPreset', {
  name: { type: DataTypes.STRING, allowNull: false },
  preset_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'basic' },
  preview_url: { type: DataTypes.STRING(1024), allowNull: false },
  preset_data: { type: DataTypes.JSON, allowNull: false },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  data_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, {
  tableName: 'text_presets',
  underscored: true,
  timestamps: true,
})
