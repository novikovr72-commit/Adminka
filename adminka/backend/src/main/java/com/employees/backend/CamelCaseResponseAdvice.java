package com.employees.backend;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@RestControllerAdvice
public class CamelCaseResponseAdvice implements ResponseBodyAdvice<Object> {
    @Override
    public boolean supports(
        MethodParameter returnType,
        Class<? extends HttpMessageConverter<?>> converterType
    ) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
        Object body,
        MethodParameter returnType,
        MediaType selectedContentType,
        Class<? extends HttpMessageConverter<?>> selectedConverterType,
        ServerHttpRequest request,
        ServerHttpResponse response
    ) {
        String path = request.getURI().getPath();
        if ("/api/list_employees".equals(path) || path.startsWith("/api/relation")) {
            // For this endpoint, keep strict contract without duplicate snake/camel aliases.
            return body;
        }
        return addCamelCaseAliases(body);
    }

    private Object addCamelCaseAliases(Object value) {
        if (value instanceof Map<?, ?> mapValue) {
            LinkedHashMap<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : mapValue.entrySet()) {
                String key = String.valueOf(entry.getKey());
                Object mappedValue = addCamelCaseAliases(entry.getValue());
                result.put(key, mappedValue);
                String camelKey = snakeToCamel(key);
                if (!camelKey.equals(key) && !result.containsKey(camelKey)) {
                    result.put(camelKey, mappedValue);
                }
                String snakeKey = camelToSnake(key);
                if (!snakeKey.equals(key) && !result.containsKey(snakeKey)) {
                    result.put(snakeKey, mappedValue);
                }
            }
            return result;
        }
        if (value instanceof List<?> listValue) {
            List<Object> result = new ArrayList<>(listValue.size());
            for (Object item : listValue) {
                result.add(addCamelCaseAliases(item));
            }
            return result;
        }
        return value;
    }

    private String snakeToCamel(String value) {
        if (value == null || value.isEmpty() || !value.contains("_")) {
            return value;
        }
        StringBuilder result = new StringBuilder();
        boolean uppercaseNext = false;
        for (int i = 0; i < value.length(); i += 1) {
            char ch = value.charAt(i);
            if (ch == '_') {
                uppercaseNext = true;
                continue;
            }
            if (uppercaseNext) {
                result.append(Character.toUpperCase(ch));
                uppercaseNext = false;
            } else {
                result.append(ch);
            }
        }
        return result.toString();
    }

    private String camelToSnake(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < value.length(); i += 1) {
            char ch = value.charAt(i);
            if (Character.isUpperCase(ch)) {
                if (i > 0) {
                    result.append('_');
                }
                result.append(Character.toLowerCase(ch));
            } else {
                result.append(ch);
            }
        }
        return result.toString();
    }
}
