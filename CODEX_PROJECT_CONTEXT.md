# Codex 项目上下文（optivoy-backend）

最后更新：2026-03-28（Trip Planner AI 严格结构化输出升级）

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

- 不再维护 `travel-routes` 静态线路模板
- Admin 不新增线路，只维护点位数据（景点/购物/酒店）
- 用户端流程：
  1. 按城市查看景点和购物点（不展示酒店）
  2. 输入到达时间并选择点位
  3. 后端调用 AI 生成每日行程
  4. AI 必须返回严格 JSON
  5. 后端审查结构后返回前端

## 3. Trip Planner 模块

关键目录：`src/modules/trip-planner/`

接口：

- `GET /trip-planner/cities`
- `GET /trip-planner/cities/:city/points`
- `POST /trip-planner/generate`

关键能力：

- 聚合 `spots + shopping` 的城市维度统计
- 返回城市点位（仅景点、购物）
- 加载同城酒店候选供 AI 选择
- 调用 AI（DeepSeek 主 + Qwen 兜底）：
  - DeepSeek：先 `response_format=json_object`，失败后自动降级为仅 Prompt 约束
  - Qwen：优先 `json_schema(strict)+enable_thinking=false`，失败再回退 `json_object`
- 二次结构校验：
  - 日期/时间格式
  - 行程天数与连续日期
  - 点位必须全部且仅一次
  - 酒店 ID 必须来自候选集合
  - 每日起点（arrival/hotel）、退房标记、晚住酒店、通勤分钟、建议游玩时长
- 固定 System Prompt + 低随机参数：
  - `temperature=0.2`
  - `frequency_penalty=0`
  - `presence_penalty=0`
  - `max_tokens` 按天数动态
- 请求体带坐标和距离提示（基于经纬度估算通勤分钟）用于“距离最优”排序
- 生成机票/酒店深链（含入住退房和返程时间）

## 4. 已下线内容

- 代码模块：`src/modules/travel-routes/`（已删除）
- 数据源实体注册：`TravelRoute / TravelRoutePoint / UserRouteCustomization`（已移除）
- 数据表删除迁移：`1741730000000-RemoveTravelRoutesModule.ts`
- 代码模块：Openclaw 任务/草稿/聊天接口（已删除）
- 数据表删除迁移：`1741731000000-RemoveOpenclawModule.ts`

## 5. 常用检查命令

- 构建：`npm run build`
- 静态检查：`npm run lint`
- 单测：`npm test -- --runInBand`
- 执行迁移：`npm run migration:run`

## 6. 任务前推荐阅读

1. `src/app.module.ts`
2. `src/modules/trip-planner/trip-planner.controller.ts`
3. `src/modules/trip-planner/trip-planner.service.ts`
4. `src/modules/trip-planner/trip-planner-ai.service.ts`
5. `src/config/planner.config.ts`
6. `src/config/config.validation.ts`
