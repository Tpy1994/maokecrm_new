# 猫课 CRM 系统 — 实施计划

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 后端语言 | Python | 3.11+ |
| Web 框架 | FastAPI | 0.109 |
| ASGI | Uvicorn | 0.27 |
| ORM | SQLModel (SQLAlchemy) | 0.14 |
| 异步驱动 | asyncpg | 0.29 |
| 数据库 | PostgreSQL | 13+ |
| 认证 | JWT + bcrypt | — |
| 前端语言 | TypeScript | 5.3 |
| UI 框架 | React | 18.2 |
| 构建工具 | Vite | 5.0 |
| 组件库 | Ant Design | 5.13 |
| 状态管理 | Zustand | 4.4 |
| 路由 | react-router-dom | 6.21 |

## 数据库连接

```
Host: 192.168.3.16
Port: 5432
User: root
Password: sk1234
Database: maoke_crm
```

## 分步实施

### 步骤 1：后端骨架 + 前端项目初始化
- 全部数据模型 + alembic 迁移
- JWT 认证 (login/me)
- React + Ant Design 项目搭建
- 登录页 + 三角色布局 + 路由守卫

### 步骤 2：管理员基础管理
- 产品 / 标签 / 人员 / LinkAccount CRUD

### 步骤 3：销售功能
- 我的客户列表 + 成交/退款 + 数据复盘

### 步骤 4：咨询师功能
- 咨询池 + 咨询客户列表 + 日志面板 + 数据复盘

### 步骤 5：管理员全局视图
- 全局数据复盘 + 客户资产只读 + 咨询池只读
