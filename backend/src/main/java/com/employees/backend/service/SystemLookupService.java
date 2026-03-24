package com.employees.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SystemLookupService {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final ObjectMapper objectMapper;
    private final String dadataApiToken;
    private final String dadataFindPartyUrl;

    public SystemLookupService(
        NamedParameterJdbcTemplate namedParameterJdbcTemplate,
        ObjectMapper objectMapper,
        @Value("${app.dadata.api-token:}") String dadataApiToken,
        @Value("${app.dadata.find-party-url:https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party}") String dadataFindPartyUrl
    ) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
        this.objectMapper = objectMapper;
        this.dadataApiToken = dadataApiToken;
        this.dadataFindPartyUrl = dadataFindPartyUrl;
    }

    public Map<String, Object> health() {
        return mapOf("ok", true, "message", "Backend employees запущен");
    }

    public ResponseEntity<Map<String, Object>> dbHealth() {
        try {
            String dbName = namedParameterJdbcTemplate.queryForObject(
                "select current_database()",
                new BeanPropertySqlParameterSource(new EmptyParams()),
                String.class
            );
            return ResponseEntity.ok(mapOf("ok", true, "database", dbName));
        } catch (Exception exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", exception.getMessage() == null ? "DB connection error" : exception.getMessage()));
        }
    }

    public ResponseEntity<Map<String, Object>> dadataFindParty(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String query = normalizeText(body.get("query"));
        if (query == null) {
            return badRequest("Параметр query обязателен");
        }
        if (query.length() > 300) {
            return badRequest("Длина query не должна превышать 300 символов");
        }
        if (dadataApiToken == null || dadataApiToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf(
                "ok", false,
                "error", "Не задан app.dadata.api-token"
            ));
        }
        if (dadataFindPartyUrl == null || dadataFindPartyUrl.isBlank()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf(
                "ok", false,
                "error", "Не задан app.dadata.find-party-url"
            ));
        }

        ParseResult countParsed = parsePositiveInteger(body.get("count"), 1, "count");
        if (countParsed.error() != null) {
            return badRequest(countParsed.error());
        }
        int count = countParsed.value();
        if (count > 300) {
            return badRequest("Параметр count не должен быть больше 300");
        }

        String kpp = normalizeText(body.get("kpp"));
        String branchTypeRaw = firstDefined(normalizeText(body.get("branchType")), normalizeText(body.get("branch_type")));
        String typeRaw = normalizeText(body.get("type"));
        List<String> status = normalizeStringList(body.get("status"));

        String branchType = branchTypeRaw == null ? null : branchTypeRaw.toUpperCase(Locale.ROOT);
        if (branchType != null && !Set.of("MAIN", "BRANCH").contains(branchType)) {
            return badRequest("Параметр branchType должен быть MAIN или BRANCH");
        }
        String type = typeRaw == null ? null : typeRaw.toUpperCase(Locale.ROOT);
        if (type != null && !Set.of("LEGAL", "INDIVIDUAL").contains(type)) {
            return badRequest("Параметр type должен быть LEGAL или INDIVIDUAL");
        }

        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("query", query);
        payload.put("count", count);
        if (kpp != null) {
            payload.put("kpp", kpp);
        }
        if (branchType != null) {
            payload.put("branch_type", branchType);
        }
        if (type != null) {
            payload.put("type", type);
        }
        if (!status.isEmpty()) {
            payload.put("status", status);
        }

        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(dadataFindPartyUrl))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Authorization", "Token " + dadataApiToken)
                .POST(HttpRequest.BodyPublishers.ofString(payloadJson, StandardCharsets.UTF_8))
                .build();

            HttpResponse<String> response = HttpClient.newHttpClient().send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(mapOf(
                    "ok", false,
                    "error", "DaData вернул ошибку HTTP " + response.statusCode(),
                    "providerResponse", response.body()
                ));
            }

            Map<String, Object> responseBody = objectMapper.readValue(
                response.body(),
                new TypeReference<Map<String, Object>>() {}
            );
            List<Map<String, Object>> suggestions = extractDadataSuggestions(responseBody.get("suggestions"));
            Map<String, Object> item = suggestions.isEmpty()
                ? new LinkedHashMap<>()
                : toDadataOrganizationItem(suggestions.get(0));

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item,
                "items", suggestions.stream().map(this::toDadataOrganizationItem).toList(),
                "count", suggestions.size()
            ));
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            return serverError(interruptedException, "Ошибка запроса в DaData");
        } catch (Exception exception) {
            return serverError(exception, "Ошибка запроса в DaData");
        }
    }

    private Map<String, Object> normalizeRequestBody(Map<String, Object> rawBody) {
        Map<String, Object> body = rawBody == null ? Map.of() : rawBody;
        if (body.isEmpty()) {
            return body;
        }
        LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            String key = entry.getKey();
            Object value = normalizeRequestValue(entry.getValue());
            normalized.put(key, value);
        }
        return normalized;
    }

    private Object normalizeRequestValue(Object value) {
        if (value instanceof Map<?, ?> mapValue) {
            LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : mapValue.entrySet()) {
                String key = String.valueOf(entry.getKey());
                Object nestedValue = normalizeRequestValue(entry.getValue());
                normalized.put(key, nestedValue);
            }
            return normalized;
        }
        if (value instanceof List<?> listValue) {
            List<Object> normalized = new ArrayList<>(listValue.size());
            for (Object listItem : listValue) {
                normalized.add(normalizeRequestValue(listItem));
            }
            return normalized;
        }
        return value;
    }

    private ParseResult parsePositiveInteger(Object rawValue, int defaultValue, String fieldName) {
        if (rawValue == null) {
            return new ParseResult(defaultValue, null);
        }
        String normalized = String.valueOf(rawValue).trim();
        if (normalized.isEmpty()) {
            return new ParseResult(defaultValue, null);
        }
        if (!normalized.matches("^\\d+$")) {
            return new ParseResult(null, "Параметр " + fieldName + " должен быть целым числом > 0");
        }
        int parsed = Integer.parseInt(normalized);
        if (parsed <= 0) {
            return new ParseResult(null, "Параметр " + fieldName + " должен быть целым числом > 0");
        }
        return new ParseResult(parsed, null);
    }

    private String firstDefined(String primary, String fallback) {
        if (primary != null) {
            return primary;
        }
        return fallback;
    }

    private List<String> normalizeStringList(Object rawValue) {
        if (rawValue instanceof List<?> listValue) {
            List<String> result = new ArrayList<>();
            for (Object item : listValue) {
                String normalized = normalizeText(item);
                if (normalized != null && !normalized.isBlank()) {
                    result.add(normalized);
                }
            }
            return result;
        }
        String asText = normalizeText(rawValue);
        if (asText == null) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String token : asText.split(",")) {
            String normalized = normalizeText(token);
            if (normalized != null && !normalized.isBlank()) {
                result.add(normalized);
            }
        }
        return result;
    }

    private List<Map<String, Object>> extractDadataSuggestions(Object rawValue) {
        if (!(rawValue instanceof List<?> listValue)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : listValue) {
            if (!(item instanceof Map<?, ?> mapItem)) {
                continue;
            }
            LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : mapItem.entrySet()) {
                normalized.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            result.add(normalized);
        }
        return result;
    }

    private Map<String, Object> toDadataOrganizationItem(Map<String, Object> suggestion) {
        Map<String, Object> data = toStringKeyMap(suggestion.get("data"));
        Map<String, Object> name = toStringKeyMap(data.get("name"));
        Map<String, Object> address = toStringKeyMap(data.get("address"));
        Map<String, Object> state = toStringKeyMap(data.get("state"));

        String inn = normalizeText(data.get("inn"));
        String kpp = normalizeText(data.get("kpp"));
        String ogrn = normalizeText(data.get("ogrn"));
        String okpo = normalizeText(data.get("okpo"));
        String fullName = normalizeText(name.get("full_with_opf"));
        String shortName = normalizeText(name.get("short_with_opf"));
        String fullAddress = normalizeText(address.get("value"));
        String stateStatus = normalizeText(state.get("status"));
        String branchType = normalizeText(data.get("branch_type"));
        String type = normalizeText(data.get("type"));

        return mapOf(
            "inn", inn,
            "kpp", kpp,
            "ogrn", ogrn,
            "okpo", okpo,
            "name", fullName,
            "shName", shortName,
            "fullAddress", fullAddress,
            "status", stateStatus,
            "branchType", branchType,
            "type", type
        );
    }

    private Map<String, Object> toStringKeyMap(Object rawValue) {
        if (!(rawValue instanceof Map<?, ?> mapValue)) {
            return Map.of();
        }
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : mapValue.entrySet()) {
            result.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return result;
    }

    private String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("ok", false, "error", message));
    }

    private ResponseEntity<Map<String, Object>> serverError(Exception exception, String fallbackMessage) {
        String message = exception == null || exception.getMessage() == null ? fallbackMessage : exception.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("ok", false, "error", message));
    }

    private Map<String, Object> mapOf(Object... values) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }

    private record ParseResult(Integer value, String error) {
    }

    private record EmptyParams() {
    }
}
