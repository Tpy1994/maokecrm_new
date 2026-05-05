# 猫课 CRM 部署指南（deployment.md）

本文提供一套可直接落地的服务器部署方案，适用于当前仓库版本（FastAPI + React + PostgreSQL，前后端分离，Nginx 反向代理）。

---

## 1. 部署目标与架构

推荐生产架构：

- `Nginx`：统一对外入口（80/443），托管前端静态资源，并反向代理后端 API
- `Frontend (Vite build)`：构建后静态文件部署到 Nginx 站点目录
- `Backend (FastAPI + Uvicorn)`：systemd 常驻进程，监听 `127.0.0.1:8000`
- `PostgreSQL`：业务数据库

请求路径：

- 页面请求：`https://your-domain/` -> Nginx 静态资源
- API 请求：`https://your-domain/api/v1/...` -> Nginx -> `127.0.0.1:8000`

---

## 2. 服务器准备

以下以 Ubuntu 22.04 为例，其他 Linux 发行版同理调整。

### 2.1 安装基础依赖

```bash
sudo apt update
sudo apt install -y git curl build-essential nginx postgresql postgresql-contrib python3 python3-venv python3-pip
```

### 2.2 安装 Node.js（建议 20 LTS）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

## 3. 拉取代码与目录约定

建议部署目录：

- 项目目录：`/opt/maokecrm/maokecrm_new`
- 后端虚拟环境：`/opt/maokecrm/venv`

```bash
sudo mkdir -p /opt/maokecrm
sudo chown -R $USER:$USER /opt/maokecrm
cd /opt/maokecrm
git clone <你的仓库地址> maokecrm_new
cd maokecrm_new
```

---

## 4. PostgreSQL 初始化

### 4.1 创建数据库与用户

```bash
sudo -u postgres psql
```

在 `psql` 中执行：

```sql
CREATE USER maokecrm_user WITH PASSWORD '请改成强密码';
CREATE DATABASE maokecrm_db OWNER maokecrm_user;
GRANT ALL PRIVILEGES ON DATABASE maokecrm_db TO maokecrm_user;
\q
```

### 4.2 确认连接参数

当前项目 `backend/app/core/config.py` 使用硬编码配置（无 `.env`）。  
上线前请将数据库地址、账号、密码改为生产值，并确认：

- `DATABASE_URL`（asyncpg）
- `DATABASE_URL_SYNC`（psycopg2 / alembic）

---

## 5. 后端部署（FastAPI）

### 5.1 创建虚拟环境并安装依赖

```bash
cd /opt/maokecrm/maokecrm_new/backend
python3 -m venv /opt/maokecrm/venv
source /opt/maokecrm/venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 5.2 初始化数据库结构与基础数据

首次部署建议顺序：

```bash
cd /opt/maokecrm/maokecrm_new/backend
source /opt/maokecrm/venv/bin/activate

# 若是全新环境
python scripts/create_db.py

# 应用迁移（若使用 alembic）
alembic upgrade heads

# 可选：导入演示数据（生产环境通常不执行）
# python scripts/seed_full_demo.py
```

说明：

- 业务代码在启动时也会尝试 `create_all`，但生产仍建议通过迁移管理变更。
- 当前项目存在多 migration head，请保持数据库与代码版本一致后再上线。

### 5.3 systemd 服务

创建文件：`/etc/systemd/system/maokecrm-backend.service`

```ini
[Unit]
Description=MaokeCRM FastAPI Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/maokecrm/maokecrm_new/backend
Environment="PYTHONPATH=/opt/maokecrm/maokecrm_new/backend"
ExecStart=/opt/maokecrm/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动与开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable maokecrm-backend
sudo systemctl start maokecrm-backend
sudo systemctl status maokecrm-backend
```

查看日志：

```bash
sudo journalctl -u maokecrm-backend -f
```

---

## 6. 前端部署（React + Vite）

### 6.1 构建前端

```bash
cd /opt/maokecrm/maokecrm_new/frontend
npm ci
npm run build
```

### 6.2 发布静态资源

```bash
sudo mkdir -p /var/www/maokecrm
sudo rsync -av --delete /opt/maokecrm/maokecrm_new/frontend/dist/ /var/www/maokecrm/
```

---

## 7. Nginx 配置

创建文件：`/etc/nginx/sites-available/maokecrm.conf`

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/maokecrm;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/maokecrm.conf /etc/nginx/sites-enabled/maokecrm.conf
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. HTTPS（建议）

使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 9. 发布流程（后续迭代）

每次发布建议流程：

```bash
cd /opt/maokecrm/maokecrm_new
git pull origin master

# backend
cd backend
source /opt/maokecrm/venv/bin/activate
pip install -r requirements.txt
alembic upgrade heads
sudo systemctl restart maokecrm-backend

# frontend
cd ../frontend
npm ci
npm run build
sudo rsync -av --delete dist/ /var/www/maokecrm/
sudo systemctl reload nginx
```

---

## 10. 回滚建议

### 10.1 代码回滚

```bash
cd /opt/maokecrm/maokecrm_new
git log --oneline -n 20
git checkout <稳定版本commit>
```

然后重复“发布流程”中的后端重启和前端重新发布。

### 10.2 数据回滚

- 生产前务必做数据库备份（`pg_dump`）
- 高风险迁移前做快照
- 资金相关口径变更（如金额单位）先在预发环境完整演练

---

## 11. 生产检查清单（上线前）

1. 数据库连接参数已改为生产配置（非开发默认值）。  
2. 已禁用演示数据脚本（`seed_full_demo.py`）在生产运行。  
3. 管理员初始账号密码已修改。  
4. Nginx 与后端服务均设置开机自启。  
5. 日志监控、备份策略、告警策略已配置。  
6. 前后端金额口径已确认为“元”。  
7. 登录页、favicon、系统品牌信息已与生产品牌一致。  

---

## 12. 常见问题排查

### 12.1 页面能打开但接口 502

- 检查后端服务状态：
  - `sudo systemctl status maokecrm-backend`
- 检查 Nginx 配置转发：
  - `proxy_pass http://127.0.0.1:8000;`

### 12.2 前端路由刷新 404

- 确认 Nginx 有：
  - `try_files $uri $uri/ /index.html;`

### 12.3 数据库迁移失败

- 先 `alembic heads` / `alembic current` 对齐状态
- 确认 `DATABASE_URL_SYNC` 指向正确数据库

### 12.4 静态资源更新未生效

- `rsync --delete` 重新发布 `dist/`
- 清理浏览器缓存 / CDN 缓存

---

## 13. 商用声明提示

当前版本开源可用。若用于商业用途（收费部署、SaaS、企业营利用途），请按项目约定完成商业使用声明与确认后再上线。
