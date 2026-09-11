"""业务 service 包。

划分：tea / record / garden / auth 按域分文件，通用 CRUD 在 base_service。
router 只做参数接收与响应，业务逻辑（幂等、查询、哈希、JWT）全部下沉到 service。
"""
