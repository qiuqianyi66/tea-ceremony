package com.tea.common.response;

import com.tea.common.errorcode.ErrorCode;
import lombok.Getter;

/**
 * 统一响应体 ApiResponse&lt;T&gt;（编码规范 §6：success(data) / success() / error）。
 * 分页契约 paginated(items,total,page,size) 由批 B 分页切片补充，本骨架不做。
 */
@Getter
public class ApiResponse<T> {

    private final String code;
    private final String message;
    private final T data;

    private ApiResponse(String code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>("OK", "success", null);
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>("OK", "success", data);
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getDefaultMessage(), null);
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null);
    }
}
