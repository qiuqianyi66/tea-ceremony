-- m1-compose 数据库变更（up）：无
-- T9 为纯部署编排改造（compose/Dockerfile/nginx/CI/DEPLOY.md），零 schema 变更。
-- schema 由 Flyway V1+V2 在容器首启时自动迁移。
SELECT 1;
