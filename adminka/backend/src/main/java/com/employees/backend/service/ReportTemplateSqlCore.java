package com.employees.backend.service;

import com.employees.backend.repository.ReportTemplateRepository;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class ReportTemplateSqlCore {
    private static final Pattern NAMED_SQL_PARAM_PATTERN = Pattern.compile("(?<!:):[a-zA-Z_][a-zA-Z0-9_]*");
    private static final Pattern SQL_ERROR_TEXT_PATTERN = Pattern.compile("ERROR:\\s*(.+?)(?:\\s*Position:\\s*\\d+|$)");
    private static final Pattern SQL_ERROR_POSITION_PATTERN = Pattern.compile("Position:\\s*(\\d+)");

    private final ReportTemplateRepository reportTemplateRepository;

    public ReportTemplateSqlCore(
        ReportTemplateRepository reportTemplateRepository
    ) {
        this.reportTemplateRepository = reportTemplateRepository;
    }

    public ResponseEntity<Map<String, Object>> validateReportTemplateSql(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String sqlQuery = normalizeText(body.get("sqlQuery"));
        if (sqlQuery == null || sqlQuery.isBlank()) {
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "SQL-скрипт пустой (допустимо)"
            ));
        }
        String validationError = validateReportTemplateSqlText(sqlQuery);
        if (validationError != null) {
            return badRequest(validationError);
        }
        String reportTemplateId = normalizeText(body.get("reportTemplateId"));
        if (reportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(reportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> templateMeta = loadTemplateSqlMeta(reportTemplateId);
        if (templateMeta == null) {
            return badRequest("Шаблон отчета не найден");
        }
        Integer numberDays = templateMeta.get("number_days") instanceof Number value ? value.intValue() : 0;
        String claimOrganizationId = normalizeText(body.get("claimOrganizationId"));
        if (claimOrganizationId != null && !isUuid(claimOrganizationId)) {
            return badRequest("Параметр claimOrganizationId должен быть UUID");
        }
        String reportId = normalizeText(body.get("reportId"));
        if (reportId != null && !isUuid(reportId)) {
            return badRequest("Параметр reportId должен быть UUID");
        }
        List<String> roleNames = normalizeRoleNames(body.get("roleNames"));
        String method = normalizeText(templateMeta.get("method"));
        if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
            return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
        }
        String sqlForExplain = toReportTemplateCheckSql(
            sqlQuery,
            reportTemplateId,
            numberDays,
            null,
            null,
            claimOrganizationId,
            reportId,
            roleNames
        );
        try {
            reportTemplateRepository.explain(sqlForExplain);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "SQL-скрипт корректен"
            ));
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, sqlQuery, "Ошибка проверки SQL-скрипта");
        }
    }

    public ResponseEntity<Map<String, Object>> executeCheckReportTemplateSql(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String sqlQuery = normalizeText(body.get("sqlQuery"));
        String validationError = validateReportTemplateSqlText(sqlQuery);
        if (validationError != null) {
            return badRequest(validationError);
        }
        String reportTemplateId = normalizeText(body.get("reportTemplateId"));
        if (reportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(reportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> templateMeta = loadTemplateSqlMeta(reportTemplateId);
        if (templateMeta == null) {
            return badRequest("Шаблон отчета не найден");
        }
        Integer numberDays = templateMeta.get("number_days") instanceof Number value ? value.intValue() : 0;
        String claimOrganizationId = normalizeText(body.get("claimOrganizationId"));
        if (claimOrganizationId != null && !isUuid(claimOrganizationId)) {
            return badRequest("Параметр claimOrganizationId должен быть UUID");
        }
        String reportId = normalizeText(body.get("reportId"));
        if (reportId != null && !isUuid(reportId)) {
            return badRequest("Параметр reportId должен быть UUID");
        }
        List<String> roleNames = normalizeRoleNames(body.get("roleNames"));
        String method = normalizeText(templateMeta.get("method"));
        if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
            return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
        }
        String sqlForExecution = toReportTemplateCheckSql(
            sqlQuery,
            reportTemplateId,
            numberDays,
            null,
            null,
            claimOrganizationId,
            reportId,
            roleNames
        );
        String countSql = "select count(*)::bigint as total_count from (" + sqlForExecution + ") report_sql_check";
        try {
            long startedAtNanos = System.nanoTime();
            Long selectedRows = reportTemplateRepository.queryLong(countSql);
            long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000L;
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "executionMs", elapsedMs,
                "executionTime", formatExecutionTimeMinutesSecondsMilliseconds(elapsedMs),
                "selectedRows", selectedRows == null ? 0L : selectedRows
            ));
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, sqlQuery, "Ошибка выполнения SQL-скрипта");
        }
    }

    public ResponseEntity<Map<String, Object>> reportTemplateSqlResults(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String reportTemplateId = normalizeText(body.get("reportTemplateId"));
        if (reportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(reportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 500, "limit");
        if (limitParsed.error() != null) {
            return badRequest(limitParsed.error());
        }
        ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
        if (offsetParsed.error() != null) {
            return badRequest(offsetParsed.error());
        }

        int limit = Math.min(limitParsed.value() == null ? 500 : limitParsed.value(), 500);
        int page = offsetParsed.value() == null ? 1 : offsetParsed.value();
        int sqlOffset = (page - 1) * limit;

        String savedSqlQuery = "";
        try {
            Map<String, Object> templateMeta = loadTemplateSqlMeta(reportTemplateId);
            if (templateMeta == null) {
                return badRequest("Шаблон отчета не найден");
            }
            savedSqlQuery = templateMeta.get("sql_query") == null ? null : String.valueOf(templateMeta.get("sql_query"));
            if (savedSqlQuery == null || savedSqlQuery.isBlank()) {
                return badRequest("Сохраненный SQL-скрипт пустой");
            }
            String validationError = validateReportTemplateSqlText(savedSqlQuery);
            if (validationError != null) {
                return badRequest(validationError);
            }
            Integer numberDays = templateMeta.get("number_days") instanceof Number value ? value.intValue() : 0;
            String claimOrganizationId = normalizeText(body.get("claimOrganizationId"));
            if (claimOrganizationId != null && !isUuid(claimOrganizationId)) {
                return badRequest("Параметр claimOrganizationId должен быть UUID");
            }
            String reportId = normalizeText(body.get("reportId"));
            if (reportId != null && !isUuid(reportId)) {
                return badRequest("Параметр reportId должен быть UUID");
            }
            List<String> roleNames = normalizeRoleNames(body.get("roleNames"));
            String method = normalizeText(templateMeta.get("method"));
            if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
                return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
            }
            String sqlForExecution = toReportTemplateCheckSql(
                savedSqlQuery,
                reportTemplateId,
                numberDays,
                null,
                null,
                claimOrganizationId,
                reportId,
                roleNames
            );
            String countSql = "select count(*)::bigint as total_count from (" + sqlForExecution + ") report_sql_results";
            String pagedSql = "select * from (" + sqlForExecution + ") report_sql_results limit ? offset ?";

            long startedAtNanos = System.nanoTime();
            Long totalRows = reportTemplateRepository.queryLong(countSql);
            ReportTemplateRepository.QueryRowsWithColumns queryResult = reportTemplateRepository.queryRowsWithColumns(
                pagedSql,
                limit,
                sqlOffset
            );
            long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000L;
            long total = totalRows == null ? 0L : totalRows;
            boolean hasMore = sqlOffset + queryResult.rows().size() < total;

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "columns", queryResult.columns(),
                "rows", queryResult.rows(),
                "totalRows", total,
                "hasMore", hasMore,
                "offset", page,
                "limit", limit,
                "executionMs", elapsedMs,
                "executionTime", formatExecutionTimeMinutesSecondsMilliseconds(elapsedMs)
            ));
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, savedSqlQuery, "Ошибка выполнения SQL-скрипта");
        }
    }

    public ResponseEntity<Map<String, Object>> updateReportTemplateSql(
        String reportTemplateId,
        Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        String sqlQuery = normalizeText(body.get("sqlQuery"));
        String sqlQueryToSave = sqlQuery == null ? "" : sqlQuery;
        if (!sqlQueryToSave.isBlank()) {
            String validationError = validateReportTemplateSqlText(sqlQueryToSave);
            if (validationError != null) {
                return badRequest(validationError);
            }
        }
        Map<String, Object> templateMeta = loadTemplateSqlMeta(normalizedReportTemplateId);
        if (templateMeta == null) {
            return badRequest("Шаблон отчета не найден");
        }
        Integer numberDays = templateMeta.get("number_days") instanceof Number value ? value.intValue() : 0;
        String claimOrganizationId = normalizeText(body.get("claimOrganizationId"));
        if (claimOrganizationId != null && !isUuid(claimOrganizationId)) {
            return badRequest("Параметр claimOrganizationId должен быть UUID");
        }
        String reportId = normalizeText(body.get("reportId"));
        if (reportId != null && !isUuid(reportId)) {
            return badRequest("Параметр reportId должен быть UUID");
        }
        List<String> roleNames = normalizeRoleNames(body.get("roleNames"));
        String method = normalizeText(templateMeta.get("method"));
        if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
            return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
        }

        try {
            if (!sqlQueryToSave.isBlank()) {
                String sqlForExplain = toReportTemplateCheckSql(
                    sqlQueryToSave,
                    normalizedReportTemplateId,
                    numberDays,
                    null,
                    null,
                    claimOrganizationId,
                    reportId,
                    roleNames
                );
                reportTemplateRepository.explain(sqlForExplain);
            }
            int updated = reportTemplateRepository.updateTemplateSql(normalizedReportTemplateId, sqlQueryToSave);
            if (updated == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "SQL-скрипт сохранен",
                "item", mapOf(
                    "reportTemplateId", normalizedReportTemplateId,
                    "sqlQuery", sqlQueryToSave
                )
            ));
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, sqlQueryToSave, "Ошибка сохранения SQL-скрипта");
        }
    }

    private Map<String, Object> loadTemplateSqlMeta(String reportTemplateId) {
        List<Map<String, Object>> templates = reportTemplateRepository.findTemplateSqlMetaById(reportTemplateId);
        if (templates.isEmpty()) {
            return null;
        }
        return templates.get(0);
    }

    private String validateReportTemplateSqlText(String sqlQuery) {
        if (sqlQuery == null) {
            return null;
        }
        String normalizedSql = normalizeSingleSqlStatement(sqlQuery);
        if (normalizedSql.isEmpty()) {
            return null;
        }
        if (hasMultipleSqlStatements(normalizedSql)) {
            return "SQL-скрипт должен содержать только один SQL-скрипт";
        }
        String loweredSql = normalizedSql.toLowerCase(Locale.ROOT);
        if (!(loweredSql.startsWith("select") || loweredSql.startsWith("with"))) {
            return "Разрешены только SELECT/WITH SQL-скрипты";
        }

        String normalizedWords = loweredSql.replaceAll("[^a-z_]+", " ");
        for (String forbidden : List.of(
            "insert",
            "update",
            "delete",
            "drop",
            "alter",
            "create",
            "truncate",
            "grant",
            "revoke",
            "execute",
            "call",
            "do"
        )) {
            if ((" " + normalizedWords + " ").contains(" " + forbidden + " ")) {
                return "SQL-скрипт содержит недопустимую команду: " + forbidden;
            }
        }
        return null;
    }

    private List<String> normalizeRoleNames(Object rawRoleNames) {
        if (rawRoleNames instanceof List<?> listValue) {
            List<String> result = new ArrayList<>();
            for (Object item : listValue) {
                String normalized = normalizeText(item);
                if (normalized != null && !normalized.isBlank()) {
                    result.add(normalized);
                }
            }
            return result;
        }
        String asText = normalizeText(rawRoleNames);
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

    private String toSqlTextArrayLiteral(List<String> roleNames) {
        if (roleNames == null || roleNames.isEmpty()) {
            return "ARRAY[]::text[]";
        }
        String joined = roleNames
            .stream()
            .map(this::toSqlStringOrNull)
            .collect(java.util.stream.Collectors.joining(", "));
        return "ARRAY[" + joined + "]::text[]";
    }

    private String toReportTemplateCheckSql(
        String sqlQuery,
        String reportTemplateId,
        Integer numberDays,
        String startReportValue,
        String endReportValue,
        String claimOrganizationId,
        String reportId,
        List<String> roleNames
    ) {
        if (sqlQuery == null) {
            return "";
        }
        String normalized = normalizeSingleSqlStatement(sqlQuery);
        normalized = normalizeReportTemplateParams(normalized);
        String roleNamesArrayLiteral = toSqlTextArrayLiteral(roleNames);
        normalized = normalized.replaceAll(
            "(?i)array\\s*\\[\\s*:roleNames\\s*\\](\\s*::\\s*[a-zA-Z0-9_\\[\\]]+)?",
            roleNamesArrayLiteral
        );
        normalized = replaceNamedSqlParameter(normalized, "startReport", toSqlStringOrNull(startReportValue));
        normalized = replaceNamedSqlParameter(normalized, "endReport", toSqlStringOrNull(endReportValue));
        normalized = replaceNamedSqlParameter(normalized, "claimOrganizationId", toSqlStringOrNull(claimOrganizationId));
        normalized = replaceNamedSqlParameter(
            normalized,
            "numberDays",
            String.valueOf(numberDays == null ? 0 : numberDays)
        );
        String resolvedReportId = normalizeText(reportId);
        if (resolvedReportId == null) {
            resolvedReportId = reportTemplateId;
        }
        normalized = replaceNamedSqlParameter(normalized, "reportId", toSqlStringOrNull(resolvedReportId));
        String firstRoleName = roleNames == null || roleNames.isEmpty() ? null : roleNames.get(0);
        normalized = replaceNamedSqlParameter(normalized, "roleNames", toSqlStringOrNull(firstRoleName));

        Matcher matcher = NAMED_SQL_PARAM_PATTERN.matcher(normalized);
        StringBuffer result = new StringBuffer(normalized.length());
        while (matcher.find()) {
            int length = matcher.end() - matcher.start();
            String replacement = length >= 4 ? "null" + " ".repeat(length - 4) : "null";
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private String normalizeReportTemplateParams(String sqlText) {
        if (sqlText == null || sqlText.isBlank()) {
            return sqlText;
        }
        String normalized = sqlText;
        normalized = normalized.replaceAll(
            "(?i)null\\s*::\\s*date\\s+as\\s+startReport\\b",
            ":startReport::date AS startReport"
        );
        normalized = normalized.replaceAll(
            "(?i)null\\s*::\\s*date\\s+as\\s+endReport\\b",
            ":endReport::date AS endReport"
        );
        normalized = normalized.replaceAll(
            "(?i)null\\s*::\\s*uuid\\s+as\\s+claimOrganizationId\\b",
            ":claimOrganizationId::uuid AS claimOrganizationId"
        );
        normalized = normalized.replaceAll(
            "(?i)null\\s*::\\s*integer\\s+as\\s+numberDays\\b",
            ":numberDays::integer AS numberDays"
        );
        return normalized;
    }

    private String toSqlStringOrNull(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            return "NULL";
        }
        return "'" + normalized.replace("'", "''") + "'";
    }

    private String normalizeSingleSqlStatement(String sqlQuery) {
        String normalized = sqlQuery == null ? "" : normalizeSqlWhitespaceCharacters(sqlQuery).trim();
        while (normalized.endsWith(";")) {
            normalized = normalized.substring(0, normalized.length() - 1).trim();
        }
        return normalized;
    }

    private String normalizeSqlWhitespaceCharacters(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        return value
            .replace('\u00A0', ' ')
            .replace('\u2007', ' ')
            .replace('\u202F', ' ');
    }

    private boolean hasMultipleSqlStatements(String sqlText) {
        if (sqlText == null || sqlText.isBlank()) {
            return false;
        }
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        boolean inLineComment = false;
        boolean inBlockComment = false;
        String dollarQuoteTag = null;
        boolean currentStatementHasContent = false;
        int statementCount = 0;

        for (int index = 0; index < sqlText.length(); index += 1) {
            char current = sqlText.charAt(index);
            char next = index + 1 < sqlText.length() ? sqlText.charAt(index + 1) : '\0';

            if (inLineComment) {
                if (current == '\n') {
                    inLineComment = false;
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    index += 1;
                }
                continue;
            }
            if (dollarQuoteTag != null) {
                if (sqlText.startsWith(dollarQuoteTag, index)) {
                    index += dollarQuoteTag.length() - 1;
                    dollarQuoteTag = null;
                }
                continue;
            }
            if (inSingleQuote) {
                if (current == '\'') {
                    if (next == '\'') {
                        index += 1;
                    } else {
                        inSingleQuote = false;
                    }
                }
                continue;
            }
            if (inDoubleQuote) {
                if (current == '"') {
                    if (next == '"') {
                        index += 1;
                    } else {
                        inDoubleQuote = false;
                    }
                }
                continue;
            }

            if (current == '-' && next == '-') {
                inLineComment = true;
                index += 1;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                index += 1;
                continue;
            }
            if (current == '\'') {
                inSingleQuote = true;
                currentStatementHasContent = true;
                continue;
            }
            if (current == '"') {
                inDoubleQuote = true;
                currentStatementHasContent = true;
                continue;
            }
            if (current == '$') {
                String detectedTag = detectDollarQuoteTag(sqlText, index);
                if (detectedTag != null) {
                    dollarQuoteTag = detectedTag;
                    currentStatementHasContent = true;
                    index += detectedTag.length() - 1;
                    continue;
                }
            }
            if (current == ';') {
                if (currentStatementHasContent) {
                    statementCount += 1;
                    if (statementCount > 1) {
                        return true;
                    }
                    currentStatementHasContent = false;
                }
                continue;
            }
            if (!Character.isWhitespace(current)) {
                currentStatementHasContent = true;
            }
        }

        if (currentStatementHasContent) {
            statementCount += 1;
        }
        return statementCount > 1;
    }

    private String detectDollarQuoteTag(String sqlText, int startIndex) {
        if (sqlText == null || startIndex < 0 || startIndex >= sqlText.length() || sqlText.charAt(startIndex) != '$') {
            return null;
        }
        int endIndex = sqlText.indexOf('$', startIndex + 1);
        if (endIndex < 0) {
            return null;
        }
        String tagBody = sqlText.substring(startIndex + 1, endIndex);
        if (!tagBody.matches("[a-zA-Z_][a-zA-Z0-9_]*") && !tagBody.isEmpty()) {
            return null;
        }
        return sqlText.substring(startIndex, endIndex + 1);
    }

    private String replaceNamedSqlParameter(String sqlText, String parameterName, String replacement) {
        String pattern = "(?<!:):" + Pattern.quote(parameterName) + "\\b";
        return sqlText.replaceAll(pattern, Matcher.quoteReplacement(replacement));
    }

    private ResponseEntity<Map<String, Object>> sqlValidationErrorResponse(
        Exception exception,
        String originalSql,
        String fallbackMessage
    ) {
        SQLException sqlException = findSqlException(exception);
        String rawMessage = sqlException != null && sqlException.getMessage() != null
            ? sqlException.getMessage()
            : getErrorMessage(exception);
        String errorText = extractSqlErrorText(rawMessage, fallbackMessage);
        Integer errorPosition = extractSqlErrorPosition(rawMessage);
        Integer errorLine = null;
        Integer errorColumn = null;
        if (errorPosition != null) {
            int[] lineAndColumn = computeLineAndColumn(originalSql, errorPosition);
            errorLine = lineAndColumn[0];
            errorColumn = lineAndColumn[1];
        }
        String errorCode = sqlException == null ? null : normalizeText(sqlException.getSQLState());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf(
            "ok", false,
            "error", errorText,
            "errorCode", errorCode,
            "errorLine", errorLine,
            "errorColumn", errorColumn,
            "errorPosition", errorPosition
        ));
    }

    private SQLException findSqlException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SQLException sqlException) {
                return sqlException;
            }
            current = current.getCause();
        }
        return null;
    }

    private String extractSqlErrorText(String rawMessage, String fallbackMessage) {
        String normalizedFallback = normalizeText(fallbackMessage);
        if (rawMessage == null || rawMessage.isBlank()) {
            return normalizedFallback == null ? "Ошибка SQL-скрипта" : normalizedFallback;
        }
        Matcher matcher = SQL_ERROR_TEXT_PATTERN.matcher(rawMessage.replace('\n', ' ').replace('\r', ' '));
        if (matcher.find()) {
            String extracted = normalizeText(matcher.group(1));
            if (extracted != null) {
                return extracted;
            }
        }
        String compact = rawMessage.replaceAll("\\s+", " ").trim();
        if (compact.startsWith("StatementCallback;")) {
            compact = compact.substring("StatementCallback;".length()).trim();
        }
        if (compact.isBlank()) {
            return normalizedFallback == null ? "Ошибка SQL-скрипта" : normalizedFallback;
        }
        return compact;
    }

    private Integer extractSqlErrorPosition(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return null;
        }
        Matcher matcher = SQL_ERROR_POSITION_PATTERN.matcher(rawMessage);
        if (!matcher.find()) {
            return null;
        }
        try {
            int value = Integer.parseInt(matcher.group(1));
            return value > 0 ? value : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private int[] computeLineAndColumn(String sqlText, int position) {
        String normalizedSql = sqlText == null ? "" : sqlText;
        int safePosition = Math.max(1, Math.min(position, normalizedSql.length() + 1));
        int line = 1;
        int column = 1;
        for (int index = 0; index < safePosition - 1; index += 1) {
            if (normalizedSql.charAt(index) == '\n') {
                line += 1;
                column = 1;
            } else {
                column += 1;
            }
        }
        return new int[] { line, column };
    }

    private String formatExecutionTimeMinutesSecondsMilliseconds(long elapsedMs) {
        long totalSeconds = Math.max(0L, elapsedMs / 1000L);
        long minutes = totalSeconds / 60L;
        long seconds = totalSeconds % 60L;
        long milliseconds = Math.max(0L, elapsedMs % 1000L);
        return String.format("%02d:%02d:%03d", minutes, seconds, milliseconds);
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

    private Map<String, Object> normalizeRequestBody(Map<String, Object> rawBody) {
        return rawBody == null ? new LinkedHashMap<>() : new LinkedHashMap<>(rawBody);
    }

    private boolean isUuid(String value) {
        return value != null && value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
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

    private String getErrorMessage(Exception exception) {
        return exception == null || exception.getMessage() == null ? "Неизвестная ошибка" : exception.getMessage();
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
}
