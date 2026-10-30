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
# B1.1：Alpine(musl) 与 onnxruntime 原生库(glibc) ABI 不兼容——libonnxruntime.so 加载即
# UnsatisfiedLinkError(libstdc++.so.6 not found)。切 Debian glibc 基础镜像并显式装 libstdc++6。
FROM eclipse-temurin:21-jre
WORKDIR /app
# 只拷贝可执行 jar（spring-boot-maven-plugin repackage 产物）
COPY --from=builder /app/target/*.jar app.jar

# onnxruntime 原生库运行时依赖（glibc 基础镜像里 JVM 自带一份，显式装一次防底包裁剪）
RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# 非 root 用户：容器逃逸时不以 root 权限运行
RUN useradd -r -s /sbin/nologin appuser
USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
