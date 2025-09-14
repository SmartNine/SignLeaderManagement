const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "EditableNode",
    {
      asset_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "关联的 3D 模型 product_assets.id",
      },
      node_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "编辑节点名称，如 cover_edit",
      },
      uv_template_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: "UV 展开图（2D 模板）的 OSS 链接",
      },
      preview_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "节点缩略图（可选）",
      },
      tags: {
        type: DataTypes.STRING,
        comment: "可选标签，如 top, logo_area 等",
      },
    },
    {
      tableName: "editable_nodes",
      underscored: true,
      timestamps: true,
    }
  );
};
