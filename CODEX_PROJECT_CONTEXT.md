# Codex 项目上下文（optivoy-backend）

最后更新：2026-03-30（P2 生成链路接入 optimizer + transit_cache）

## 1. 当前核心架构

- 框架：NestJS 11
- 语言：TypeScript
- ORM：TypeORM + PostgreSQL
- 认证：JWT + Passport
- 上传：阿里云 OSS STS
- 观测：OpenTelemetry（可选）

关键入口：

- `src/main.ts`
- `src/app.module.ts`
- `src/config/config.validation.ts`
- `src/database/data-source.ts`

## 2. 行程相关最新业务边界

- Admin 仅维护点位数据（景点/购物/饭店/酒店/机场）
- 用户端流程：
  1. 按城市查看景点和购物点（不展示酒店）
  2. 输入到达时间并选择点位
  3. 调用确定性求解器生成线路
  4. 返回每日点位顺序、酒店选择、分段交通与预订链接

## 3. Trip Planner 模块

关键目录：`src/modules/trip-planner/`

接口：

- `GET /trip-planner/cities`
- `GET /trip-planner/cities/:city/points`
- `POST /trip-planner/generate`

关键能力：

- 聚合 `spots + shopping + restaurants` 的城市维度统计
- 返回城市点位（景点、购物、饭店；酒店不在选点阶段展示）
- `POST /trip-planner/generate` 已接入 optimizer（依赖 `transit_cache` 矩阵）
- 机票/酒店深链能力保留在配置层

## 4. 常用检查命令

- 构建：`npm run build`
- 静态检查：`npm run lint`
- 单测：`npm test -- --runInBand`
- 执行迁移：`npm run migration:run`

## 5. 任务前推荐阅读

1. `src/app.module.ts`
2. `src/modules/trip-planner/trip-planner.controller.ts`
3. `src/modules/trip-planner/trip-planner.service.ts`
4. `src/config/planner.config.ts`
5. `src/config/config.validation.ts`
