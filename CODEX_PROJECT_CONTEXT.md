# Codex 项目上下文（optivoy-backend）

最后更新：2026-04-04（按需求 v1.5 收敛规划边界）

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

- Admin 维护景点、购物中心、酒店、机场代码等基础数据
- 用户端流程：
  1. 按城市查看景点和购物点位（不展示酒店，也不展示餐馆作为可选点）
  2. 输入 `startDate` 并选择点位与节奏、酒店策略
  3. 调用 optimizer 生成分天线路与酒店分配
  4. 返回每日点位顺序、酒店安排、酒店预订链接、往返机票搜索链接

## 3. Trip Planner 模块

关键目录：`src/modules/trip-planner/`

接口：

- `GET /trip-planner/cities`
- `GET /trip-planner/cities/:city/points`
- `POST /trip-planner/generate`

关键能力：

- 城市维度仅聚合 `spots + shopping`
- 返回城市点位仅包含景点、购物；酒店不在选点阶段展示
- `POST /trip-planner/generate` 依赖 `transit_cache` 矩阵，不再把机场/餐馆作为规划节点
- `transit_cache` 矩阵节点范围固定为 `spots + shopping + hotels`
- 机票链接基于城市机场代码生成；酒店预订链接统一通过 `hotelBookingLinks` 返回，不在每日酒店节点重复展开
- 每个游览日输出使用线性交替 `sequence` 表达：`hotel(start) -> transport -> point -> lunch_break(需要时) -> ... -> hotel(end)`

## 4. Optimizer 当前规则

- 输入核心字段：`startDate`、`selectedPointIds`、`paceMode`、`hotelStrategy`
- `hotelStrategy`：
  - `single`：全程单酒店
  - `smart`：优先少换酒店，只在平均单程驾车时间显著下降时切换
- 每日时间窗：
  - `light`：`10:00-18:00`
  - `standard`：`09:00-20:00`
  - `compact`：`08:00-21:00`
- 每天最多 8 个点位
- 午餐规则：
  - 当天存在 `hasFoodCourt=true` 点位，或存在时长 `>=240` 分钟点位时，不额外扣午餐时间
  - 否则扣除 `45` 分钟午餐时间，并在诊断中体现午餐占位
- 机场接送不纳入路线优化；酒店是每天起终点

## 5. 常用检查命令

- 构建：`npm run build`
- 静态检查：`npm run lint`
- 单测：`npm test -- --runInBand`
- 执行迁移：`npm run migration:run`

## 6. 任务前推荐阅读

1. `src/app.module.ts`
2. `src/modules/trip-planner/trip-planner.controller.ts`
3. `src/modules/trip-planner/trip-planner.service.ts`
4. `src/modules/trip-planner/optimizer.client.ts`
5. `src/config/planner.config.ts`
6. `src/config/config.validation.ts`
