# ============ builder：Maven 构建（依赖缓存层，pom 不变时命中） ============
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
# 先拉全量依赖：pom 未变更时该层缓存，构建秒级
RUN mvn -q dependency:go-offline
COPY src ./src
# 测试在 CI/本地执行（含 Testcontainers），镜像构建只打包可执行 jar
RUN mvn -q package -DskipTests

# ============ runtime：JRE + 应用 jar，非 root ============
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
# 只拷贝可执行 jar（spring-boot-maven-plugin repackage 产物）
COPY --from=builder /app/target/*.jar app.jar

# 非 root 用户：容器逃逸时不以 root 权限运行
RUN adduser -D -H -s /sbin/nologin appuser
USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
