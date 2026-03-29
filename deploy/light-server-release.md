# Optivoy Backend 轻量服务器发布清单

这份清单默认满足以下前提：

- 服务器系统为阿里云轻量应用服务器上的 Ubuntu
- 域名 `api.optivoy.top` 已经解析到服务器公网 IP
- Nginx 所需的 SSL 证书文件已经准备好
- 后端容器只绑定在 `127.0.0.1:3000`

## 1. 域名解析

在云解析 DNS 中新增一条 `A` 记录：

- 主机记录：`api`
- 记录值：`<服务器公网 IP>`

## 2. 上传生产文件

在本地执行：

```bash
scp -i ~/.ssh/admin.pem -P 22 /Users/code-2026/optivoy.top/optivoy-backend/.env.production root@60.205.92.35:/opt/optivoy/env/.env
scp -i ~/.ssh/admin.pem -P 22 /Users/code-2026/optivoy.top/optivoy-backend/docker-compose.yml root@60.205.92.35:/opt/optivoy/app/docker-compose.yml
scp -i ~/.ssh/admin.pem -P 22 /Users/code-2026/optivoy.top/optivoy-backend/deploy/nginx/api.optivoy.top.conf root@60.205.92.35:/etc/nginx/conf.d/api.optivoy.top.conf
```


在服务器执行：

```bash
chmod 600 /opt/optivoy/env/.env
ln -sf /etc/nginx/sites-available/api.optivoy.top.conf /etc/nginx/sites-enabled/api.optivoy.top.conf
nginx -t
systemctl reload nginx
```

## 3. 安装证书文件

先在服务器创建证书目录：

```bash
mkdir -p /etc/nginx/ssl/api.optivoy.top
```

证书文件应放在以下路径：

```bash
/etc/nginx/ssl/api.optivoy.top/fullchain.pem
/etc/nginx/ssl/api.optivoy.top/privkey.pem
```

证书上传后执行：

```bash
chmod 600 /etc/nginx/ssl/api.optivoy.top/privkey.pem
nginx -t
systemctl reload nginx
```

## 4. 本地构建并上传镜像

在本地执行：

```bash
cd /Users/code-2026/optivoy.top/optivoy-backend
docker buildx build --platform linux/amd64 -t optivoy-backend:prod --load .
docker save optivoy-backend:prod | gzip > optivoy-backend-prod.tar.gz
ossutil cp optivoy-backend-prod.tar.gz oss://optivoy/docker-images/optivoy-backend-prod.tar.gz
```

## 5. 备份当前线上镜像

在服务器执行：

```bash
docker image inspect optivoy-backend:prod >/dev/null 2>&1 && \
docker save optivoy-backend:prod | gzip > /opt/optivoy/backups/optivoy-backend-prod-$(date +%Y%m%d%H%M%S).tar.gz
```

## 6. 加载新镜像

在服务器执行：

```bash
ossutil cp oss://optivoy/docker-images/optivoy-backend-prod.tar.gz /opt/optivoy/releases/
docker load < /opt/optivoy/releases/optivoy-backend-prod.tar.gz
```

## 7. 执行数据库迁移

在服务器执行：

```bash
cd /opt/optivoy/app
docker compose run --rm app npm run migration:run:prod
```

## 8. 启动新版本

在服务器执行：

```bash
cd /opt/optivoy/app
docker compose up -d
docker compose ps
docker logs --tail 200 optivoy-backend
```

## 9. 首次部署才执行管理员初始化

只有数据库里还没有管理员账号时，才执行：

```bash
cd /opt/optivoy/app
docker compose run --rm app npm run seed:admin:prod
```

## 10. 发布后验证

在服务器执行：

```bash
curl -I http://127.0.0.1:3000/health
curl -I https://api.optivoy.top/health
```

浏览器侧至少验证这些流程：

- 用户 Web 登录与刷新
- Admin 2FA 登录与刷新
- 图片上传流程
- 邮件发送是否正常
