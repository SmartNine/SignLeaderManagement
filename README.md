# SignLeader Management (SignLeader 模板管理后台)

## 项目简介

SignLeader Management 是一个功能强大的3D模板管理后台系统。它允许管理员通过上传包含特定结构（`config.json` 及资源文件）的ZIP压缩包，来自动解析、处理3D模型与图片资源，并将它们结构化地存入数据库。

系统前端提供了一个简洁易用的操作界面，后端则负责处理所有核心业务逻辑，包括文件解压、资源上传至云存储以及数据持久化。

## 技术栈

本项目采用前后端分离的现代化架构。

### 前端 (`signleader-admin`)

* **框架**: [Vue 3](https://vuejs.org/)
* **构建工具**: [Vite](https://vitejs.dev/)
* **UI 库**: [Element Plus](https://element-plus.org/)
* **HTTP 请求库**: [Axios](https://axios-http.com/)

### 后端 (`signleader-backend`)

* **运行时环境**: [Node.js](https://nodejs.org/)
* **Web 框架**: [Express.js](https://expressjs.com/)
* **数据库**: [MySQL](https://www.mysql.com/)
* **ORM**: [Sequelize](https://sequelize.org/)
* **云存储**: [阿里云 OSS](https://www.aliyun.com/product/oss)
* **3D模型处理**: [gltf-transform](https://gltf-transform.dev/)
* **文件上传/解压**: [Multer](https://github.com/expressjs/multer), [Adm-zip](https://github.com/cthackers/adm-zip)

## 主要功能

* **模板上传**: 支持通过拖拽或点击上传ZIP压缩包。
* **自动化处理**: 后端自动解压ZIP包，无需人工干预。
* **智能解析**: 自动读取包内的 `config.json` 文件，解析模板的名称、描述、可编辑节点等元数据。
* **云端存储**: 自动将模板中的图片、`.glb` 模型等静态资源上传至阿里云OSS，减轻服务器存储压力。
* **结构化入库**: 将解析后的模板数据及其资源关联关系，通过Sequelize存入MySQL数据库。
* **模板查询**: 提供API接口用于查询和展示已入库的模板列表。
* **3D模型读取**: 集成了 `gltf-transform` 库，为后续对3D模型的深度处理（如压缩、编辑）提供了基础。

## 项目结构

```
SIGNLEADER-MANAGEMENT/
├── signleader-admin/     # 前端 Vue 3 项目
│   ├── src/
│   │   ├── views/        # 视图组件 (页面)
│   │   │   ├── TemplateList.vue
│   │   │   └── TemplateZipUpload.vue
│   │   └── ...
│   └── vite.config.js    # Vite 配置文件 (含API代理)
│
└── signleader-backend/   # 后端 Node.js 项目
    ├── config/           # 配置文件
    │   └── database.js   # Sequelize 数据库连接配置
    ├── models/           # Sequelize 模型定义与关系
    │   ├── PresetTemplate.js
    │   ├── EditableNode.js
    │   ├── ProductAsset.js
    │   └── index.js      # 模型关系定义
    ├── routes/           # 路由定义
    │   ├── queryRoutes.js
    │   └── zipUploadRoutes.js
    ├── services/         # 外部服务 (OSS)
    │   └── ossClient.js
    ├── utils/            # 核心工具函数
    │   ├── unzipAndRewrite.js  # 核心业务逻辑
    │   └── glbUtils.js         # 3D模型处理
    └── app.js            # Express 应用入口
```

## 本地开发部署指南

### 1. 后端 (`signleader-backend`)

1.  进入后端项目目录：
    ```bash
    cd signleader-backend
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

3.  创建并配置环境变量文件 `.env`：
    在 `signleader-backend` 根目录下创建一个 `.env` 文件，并填入以下内容（请替换为你的真实配置）：
    ```env
    # 数据库配置
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=your_mysql_password
    DB_NAME=signleader

    # 阿里云OSS配置
    OSS_REGION=your-oss-region
    OSS_ACCESS_KEY_ID=your-access-key-id
    OSS_ACCESS_KEY_SECRET=your-access-key-secret
    OSS_BUCKET=your-bucket-name
    ```

4.  启动后端服务 (开发模式，代码变更后自动重启):
    ```bash
    npm run dev
    ```
    服务将在 `http://localhost:3002` (或你在`app.js`中配置的端口) 启动。

### 2. 前端 (`signleader-admin`)

1.  进入前端项目目录：
    ```bash
    cd signleader-admin
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

3.  启动前端开发服务器：
    ```bash
    npm run dev
    ```
    `vite.config.js` 中已配置好API代理，所有 `/api` 请求会自动转发至后端服务。

4.  在浏览器中打开 Vite 提供的地址 (通常是 `http://localhost:5173`) 即可访问管理后台。

## API 接口

* `POST /api/zip/upload`: **上传模板**
    * 请求体: `multipart/form-data`
    * 字段: `file` (包含模板结构的ZIP文件)
    * 成功响应: `{ "message": "Template uploaded and processed successfully!", "data": { ... } }`
    * 失败响应: `{ "message": "Error processing file", "error": "..." }`

* `GET /api/query/templates`: **查询模板列表**
    * 成功响应: `{ "data": [ ... ] }` (包含所有模板信息的数组)
    * 失败响应: `{ "message": "Error fetching templates", "error": "..." }`

---
