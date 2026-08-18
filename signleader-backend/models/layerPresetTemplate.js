const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "LayerPresetTemplate",
    {
      node_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "关联 editable_nodes.id，精确绑定到具体 SKU 的具体编辑面",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "模板名称",
      },
      preview_url: {
        type: DataTypes.STRING,
        comment: "模板缩略图 OSS 地址",
      },
      layer_objects: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: "人工审核确认后的分类结果：Fabric对象原始属性+role标签，唯一真源",
      },
      slot_manifest: {
        type: DataTypes.JSON,
        comment: "管理后台自用的可编辑槽位轻量摘要，编辑器不读取",
      },
      status: {
        type: DataTypes.ENUM("draft", "active", "archived"),
        allowNull: false,
        defaultValue: "draft",
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      data_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "layer_preset_templates",
      underscored: true,
      timestamps: true,
    }
  );
};
