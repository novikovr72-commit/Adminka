package com.employees.backend;

import com.employees.backend.repository.ReportTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.ClientAnchor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Drawing;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Picture;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.util.Units;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

class ReportTemplateExcelCore {

    private static final Set<String> ALLOWED_STATUS = Set.of("ACTIVE", "INACTIVE");
    private static final Pattern NAMED_SQL_PARAM_PATTERN = Pattern.compile("(?<!:):[a-zA-Z_][a-zA-Z0-9_]*");
    private static final Pattern SQL_ERROR_POSITION_PATTERN = Pattern.compile("Position:\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FILE_NAME_NOW_TOKEN_PATTERN = Pattern.compile("\\{now(?::([^{}]+))?\\}", Pattern.CASE_INSENSITIVE);
    private static final int REPORT_TEMPLATE_EXPORT_FETCH_SIZE = 2000;
    private static final Pattern SQL_ERROR_TEXT_PATTERN = Pattern.compile(
        "ERROR:\\s*([^\\n\\r]+?)(?=(?:\\s+Where:|\\s+Position:|$))",
        Pattern.CASE_INSENSITIVE
    );
    private static final Set<String> ALLOWED_SORT_DIRECTIONS = Set.of("ASC", "DESC");
    private static final Set<String> EMPLOYEE_SORT_FIELDS = Set.of(
        "full_name", "surname", "first_name", "middle_name", "email", "personal_number", "phone_number", "sap_id", "status",
        "organ_name", "depart_name", "position_name", "boss_name"
    );
    private static final Set<String> EMPLOYEE_TEXT_SORT_FIELDS = Set.of(
        "full_name", "surname", "first_name", "middle_name", "email", "phone_number", "sap_id", "status",
        "organ_name", "depart_name", "position_name", "boss_name"
    );
    private static final Map<String, String> EMPLOYEE_SORT_SQL = Map.ofEntries(
        Map.entry("full_name", "e.full_name"),
        Map.entry("surname", "e.surname"),
        Map.entry("first_name", "e.first_name"),
        Map.entry("middle_name", "e.middle_name"),
        Map.entry("email", "e.email"),
        Map.entry("personal_number", "e.personal_number"),
        Map.entry("phone_number", "e.phone_number"),
        Map.entry("sap_id", "e.sap_id"),
        Map.entry("status", "e.status"),
        Map.entry("organ_name", "coalesce(sort_info.organ_name, '')"),
        Map.entry("depart_name", "coalesce(sort_info.depart_name, '')"),
        Map.entry("position_name", "coalesce(sort_info.position_name, '')"),
        Map.entry("boss_name", "coalesce(sort_info.boss_name, '')")
    );
    private static final Map<String, String> EMPLOYEE_EXPORT_SORT_SQL = Map.ofEntries(
        Map.entry("full_name", "e.full_name"),
        Map.entry("surname", "e.surname"),
        Map.entry("first_name", "e.first_name"),
        Map.entry("middle_name", "e.middle_name"),
        Map.entry("email", "e.email"),
        Map.entry("personal_number", "e.personal_number"),
        Map.entry("phone_number", "e.phone_number"),
        Map.entry("sap_id", "e.sap_id"),
        Map.entry("status", "e.status"),
        Map.entry("organ_name", "coalesce(export_info.organ_name, '')"),
        Map.entry("depart_name", "coalesce(export_info.depart_name, '')"),
        Map.entry("position_name", "coalesce(export_info.position_name, '')"),
        Map.entry("boss_name", "coalesce(export_info.boss_name, '')")
    );
    private static final Set<String> ORG_SORT_FIELDS = Set.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "country_name", "address", "sign_resident",
        "organ_unit_type_names"
    );
    private static final Set<String> ORG_TEXT_SORT_FIELDS = Set.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "country_name", "address",
        "organ_unit_type_names"
    );
    private static final Set<String> REQUIRED_COLUMNS = Set.of(
        "sap_id", "surname", "first_name", "middle_name", "email", "personal_number", "phone_number"
    );
    private static final List<String> REQUIRED_COLUMNS_ORDER = List.of(
        "sap_id", "surname", "first_name", "middle_name", "email", "personal_number", "phone_number"
    );

    private static final Map<String, ColumnMeta> EMPLOYEE_EXPORT_COLUMNS = Map.ofEntries(
        Map.entry("sap_id", new ColumnMeta("sap_id", "e.sap_id")),
        Map.entry("full_name", new ColumnMeta("ФИО сотрудника", "e.full_name")),
        Map.entry("surname", new ColumnMeta("Фамилия", "e.surname")),
        Map.entry("first_name", new ColumnMeta("Имя", "e.first_name")),
        Map.entry("middle_name", new ColumnMeta("Отчество", "e.middle_name")),
        Map.entry("email", new ColumnMeta("Почта", "e.email")),
        Map.entry("personal_number", new ColumnMeta("Табельный №", "e.personal_number")),
        Map.entry("phone_number", new ColumnMeta("Телефон", "e.phone_number")),
        Map.entry("status", new ColumnMeta("Статус", "e.status")),
        Map.entry("organ_name", new ColumnMeta("Организация", "coalesce(export_info.organ_name, '')")),
        Map.entry("depart_name", new ColumnMeta("Подразделение", "coalesce(export_info.depart_name, '')")),
        Map.entry("position_name", new ColumnMeta("Должность", "coalesce(export_info.position_name, '')")),
        Map.entry("boss_name", new ColumnMeta("Руководитель", "coalesce(export_info.boss_name, '')"))
    );
    private static final List<String> EMPLOYEE_EXPORT_DEFAULT_ORDER = List.of(
        "sap_id", "full_name", "surname", "first_name", "middle_name", "email",
        "personal_number", "phone_number", "status", "organ_name", "depart_name", "position_name", "boss_name"
    );
    private static final Map<String, ColumnMeta> ORG_EXPORT_COLUMNS = Map.ofEntries(
        Map.entry("sap_id", new ColumnMeta("sap_id", "ou.sap_id")),
        Map.entry("name", new ColumnMeta("Наименование", "ou.name")),
        Map.entry("sh_name", new ColumnMeta("Краткое наименование", "ou.sh_name")),
        Map.entry(
            "organ_unit_type_names",
            new ColumnMeta(
                "Тип организации",
                """
                (
                  select string_agg(out.name, ', ' order by out.sort_order nulls last, out.name, out.id)
                  from party.organ_unit_organ_unit_types ouot
                  join party.organ_unit_type out on out.id = ouot.organ_unit_type_id
                  where ouot.organ_unit_id = ou.id
                )
                """
            )
        ),
        Map.entry("inn", new ColumnMeta("ИНН", "ou.inn")),
        Map.entry("kpp", new ColumnMeta("КПП", "ou.kpp")),
        Map.entry("ogrn", new ColumnMeta("ОГРН", "ou.ogrn")),
        Map.entry("okpo", new ColumnMeta("ОКПО", "ou.okpo")),
        Map.entry("sign_resident", new ColumnMeta("Резидент", "case when ou.sign_resident = true then 'ДА' else 'НЕТ' end")),
        Map.entry("country_name", new ColumnMeta("Страна", "c.name")),
        Map.entry("address", new ColumnMeta("Адрес", "addr.full_address"))
    );
    private static final List<String> ORG_EXPORT_DEFAULT_ORDER = List.of(
        "sap_id", "name", "sh_name", "organ_unit_type_names",
        "inn", "kpp", "ogrn", "okpo", "sign_resident", "country_name", "address"
    );
    private static final Map<String, ColumnMeta> RELATION_EXPORT_COLUMNS = Map.ofEntries(
        Map.entry("employee_name", new ColumnMeta("ФИО сотрудника", "coalesce(e.full_name, '')")),
        Map.entry("organ_name", new ColumnMeta("Организация", "coalesce(ou.sh_name, '')")),
        Map.entry("relation_name", new ColumnMeta("Тип отношения", "coalesce(rt.name, '')")),
        Map.entry("default_flag", new ColumnMeta(
            "Основное отношение",
            "case when r.default_flag = true then 'ДА' else 'НЕТ' end"
        )),
        Map.entry("sales_organ_name", new ColumnMeta("Сбытовая организация", "coalesce(sou.sh_name, '')")),
        Map.entry("product_group_name", new ColumnMeta("Группа продуктов", "coalesce(pg.name, '')"))
    );
    private static final List<String> RELATION_EXPORT_DEFAULT_ORDER = List.of(
        "employee_name", "organ_name", "relation_name", "default_flag", "sales_organ_name", "product_group_name"
    );
    private static final Map<String, String> ORG_SORT_SQL = Map.ofEntries(
        Map.entry("sap_id", "ou.sap_id"),
        Map.entry("name", "ou.name"),
        Map.entry("sh_name", "ou.sh_name"),
        Map.entry("inn", "ou.inn"),
        Map.entry("kpp", "ou.kpp"),
        Map.entry("ogrn", "ou.ogrn"),
        Map.entry("okpo", "ou.okpo"),
        Map.entry("country_name", "c.name"),
        Map.entry("address", "addr.full_address"),
        Map.entry("sign_resident", "ou.sign_resident"),
        Map.entry("organ_unit_type_names", "types.organ_unit_type_names_sort")
    );
    private static final Set<String> RELATION_SORT_FIELDS = Set.of(
        "employee_name", "organ_name", "relation_name", "sales_organ_name", "product_group_name", "default_flag"
    );
    private static final Set<String> RELATION_TEXT_SORT_FIELDS = Set.of(
        "employee_name", "organ_name", "relation_name", "sales_organ_name", "product_group_name"
    );
    private static final Map<String, String> RELATION_SORT_SQL = Map.of(
        "employee_name", "coalesce(e.full_name, '')",
        "organ_name", "coalesce(ou.sh_name, '')",
        "relation_name", "coalesce(rt.name, '')",
        "sales_organ_name", "coalesce(sou.sh_name, '')",
        "product_group_name", "coalesce(pg.name, '')",
        "default_flag", "r.default_flag"
    );
    private static final Map<String, String> EMPLOYEE_FILTER_TITLES = Map.ofEntries(
        Map.entry("full_name", "ФИО"),
        Map.entry("surname", "Фамилия"),
        Map.entry("first_name", "Имя"),
        Map.entry("middle_name", "Отчество"),
        Map.entry("email", "Почта"),
        Map.entry("personal_number", "Табельный №"),
        Map.entry("phone_number", "Телефон"),
        Map.entry("sap_id", "sap_id"),
        Map.entry("status", "Статус"),
        Map.entry("organ_name", "Организация"),
        Map.entry("depart_name", "Подразделение"),
        Map.entry("position_name", "Должность"),
        Map.entry("boss_name", "Руководитель")
    );
    private static final Map<String, String> EMPLOYEE_SORT_TITLES = Map.ofEntries(
        Map.entry("full_name", "ФИО"),
        Map.entry("surname", "Фамилия"),
        Map.entry("first_name", "Имя"),
        Map.entry("middle_name", "Отчество"),
        Map.entry("email", "Почта"),
        Map.entry("personal_number", "Табельный №"),
        Map.entry("phone_number", "Телефон"),
        Map.entry("sap_id", "sap_id"),
        Map.entry("status", "Статус"),
        Map.entry("organ_name", "Организация"),
        Map.entry("depart_name", "Подразделение"),
        Map.entry("position_name", "Должность"),
        Map.entry("boss_name", "Руководитель")
    );
    private static final Map<String, String> ORG_FILTER_TITLES = Map.ofEntries(
        Map.entry("sap_id", "sap_id"),
        Map.entry("name", "Наименование"),
        Map.entry("sh_name", "Краткое наименование"),
        Map.entry("inn", "ИНН"),
        Map.entry("kpp", "КПП"),
        Map.entry("ogrn", "ОГРН"),
        Map.entry("okpo", "ОКПО"),
        Map.entry("country_name", "Страна"),
        Map.entry("address", "Адрес"),
        Map.entry("sign_resident", "Резидент"),
        Map.entry("organ_unit_type_names", "Тип организации")
    );
    private static final Map<String, String> RELATION_FILTER_TITLES = Map.ofEntries(
        Map.entry("employee_name", "ФИО сотрудника"),
        Map.entry("organ_name", "Организация"),
        Map.entry("relation_name", "Тип отношения"),
        Map.entry("default_flag", "Основное отношение"),
        Map.entry("sales_organ_name", "Сбытовая организация"),
        Map.entry("product_group_name", "Группа продуктов")
    );
    private static final Map<String, String> RELATION_SORT_TITLES = Map.ofEntries(
        Map.entry("employee_name", "ФИО сотрудника"),
        Map.entry("organ_name", "Организация"),
        Map.entry("relation_name", "Тип отношения"),
        Map.entry("default_flag", "Основное отношение"),
        Map.entry("sales_organ_name", "Сбытовая организация"),
        Map.entry("product_group_name", "Группа продуктов")
    );

    private final JdbcTemplate jdbcTemplate;
    private final ReportTemplateRepository reportTemplateRepository;
    private final ObjectMapper objectMapper;
    private final Path logsDir;
    private final String frontendBaseUrl;
    private final String dadataFindPartyUrl;
    private final String dadataApiToken;
    private final Integer reportTemplateExcelMaxRows;
    private final ZoneId reportExcelZoneId;

    ReportTemplateExcelCore(
        JdbcTemplate jdbcTemplate,
        ReportTemplateRepository reportTemplateRepository,
        ObjectMapper objectMapper,
        String logsDir,
        String frontendBaseUrl,
        String dadataFindPartyUrl,
        String dadataApiToken,
        Integer reportTemplateExcelMaxRows,
        String reportExcelTimezone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.reportTemplateRepository = reportTemplateRepository;
        this.objectMapper = objectMapper;
        this.logsDir = Path.of(logsDir).toAbsolutePath().normalize();
        this.frontendBaseUrl = StringUtils.trimTrailingCharacter(
            StringUtils.trimWhitespace(frontendBaseUrl == null ? "" : frontendBaseUrl),
            '/'
        );
        this.dadataFindPartyUrl = StringUtils.trimWhitespace(dadataFindPartyUrl == null ? "" : dadataFindPartyUrl);
        this.dadataApiToken = StringUtils.trimWhitespace(dadataApiToken == null ? "" : dadataApiToken);
        this.reportTemplateExcelMaxRows =
            reportTemplateExcelMaxRows != null && reportTemplateExcelMaxRows > 0
                ? reportTemplateExcelMaxRows
                : null;
        this.reportExcelZoneId = resolveReportExcelZoneId(reportExcelTimezone);
    }

    private static final ZoneId DEFAULT_REPORT_EXCEL_ZONE_ID = ZoneId.of("Europe/Moscow");

    private static ZoneId resolveReportExcelZoneId(String configured) {
        String trimmed = configured == null ? "" : configured.trim();
        if (trimmed.isEmpty()) {
            return DEFAULT_REPORT_EXCEL_ZONE_ID;
        }
        try {
            return ZoneId.of(trimmed);
        } catch (Exception ignored) {
            return DEFAULT_REPORT_EXCEL_ZONE_ID;
        }
    }

    public Map<String, Object> health() {
        return mapOf("ok", true, "message", "Backend employees запущен");
    }

    public ResponseEntity<Map<String, Object>> dbHealth() {
        try {
            String dbName = jdbcTemplate.queryForObject("select current_database()", String.class);
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

    public ResponseEntity<Map<String, Object>> refreshOrganizationDadata(
        String organUnitIdRaw
    ) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
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

        try {
            List<Map<String, Object>> organizationRows = jdbcTemplate.queryForList(
                """
                select
                  ou.id::text as organ_unit_id,
                  ou.inn,
                  ou.ogrn,
                  ou.kpp
                from party.organ_unit ou
                where ou.id = ?::uuid
                  and ou.deleted = false
                limit 1
                """,
                organUnitId
            );
            if (organizationRows.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена"
                ));
            }

            Map<String, Object> organization = organizationRows.get(0);
            String inn = normalizeText(organization.get("inn"));
            String ogrn = normalizeText(organization.get("ogrn"));
            String kpp = normalizeText(organization.get("kpp"));
            String query = null;
            if (ogrn != null) {
                query = ogrn;
            } else if (inn != null && kpp != null) {
                query = inn + "/" + kpp;
            } else if (inn != null) {
                query = inn;
            }
            if (query == null) {
                return badRequest("Для запроса в DaData у организации должен быть заполнен ИНН или ОГРН");
            }

            List<LinkedHashMap<String, Object>> requestAttempts = new ArrayList<>();
            boolean hasInnKppQuery = query.contains("/");
            String innOnlyQuery = inn;

            if (!hasInnKppQuery) {
                LinkedHashMap<String, Object> strictPayload = new LinkedHashMap<>();
                strictPayload.put("query", query);
                strictPayload.put("count", 1);
                if (kpp != null) {
                    strictPayload.put("kpp", kpp);
                }
                strictPayload.put("branch_type", "MAIN");
                strictPayload.put("type", "LEGAL");
                requestAttempts.add(strictPayload);

                LinkedHashMap<String, Object> withoutKppPayload = new LinkedHashMap<>();
                withoutKppPayload.put("query", query);
                withoutKppPayload.put("count", 1);
                withoutKppPayload.put("branch_type", "MAIN");
                withoutKppPayload.put("type", "LEGAL");
                requestAttempts.add(withoutKppPayload);
            }

            LinkedHashMap<String, Object> withoutBranchPayload = new LinkedHashMap<>();
            withoutBranchPayload.put("query", query);
            withoutBranchPayload.put("count", 1);
            withoutBranchPayload.put("type", "LEGAL");
            requestAttempts.add(withoutBranchPayload);

            LinkedHashMap<String, Object> minimalPayload = new LinkedHashMap<>();
            minimalPayload.put("query", query);
            minimalPayload.put("count", 1);
            requestAttempts.add(minimalPayload);
            if (hasInnKppQuery && innOnlyQuery != null) {
                LinkedHashMap<String, Object> innOnlyPayload = new LinkedHashMap<>();
                innOnlyPayload.put("query", innOnlyQuery);
                innOnlyPayload.put("count", 1);
                requestAttempts.add(innOnlyPayload);
            }

            List<Map<String, Object>> suggestions = List.of();
            for (LinkedHashMap<String, Object> payload : requestAttempts) {
                Map<String, Object> responseBody = requestDadataFindParty(payload);
                suggestions = extractDadataSuggestions(responseBody.get("suggestions"));
                if (!suggestions.isEmpty()) {
                    break;
                }
            }
            if (suggestions.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "DaData не вернул данные по организации"
                ));
            }

            Map<String, Object> firstSuggestion = suggestions.get(0);
            String dataInfoJson = objectMapper.writeValueAsString(firstSuggestion);

            jdbcTemplate.update(
                """
                update party.organ_unit
                set
                  data_info = ?::jsonb,
                  updated_at = now()
                where id = ?::uuid
                  and deleted = false
                """,
                dataInfoJson,
                organUnitId
            );

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "dataInfo", firstSuggestion,
                "item", toDadataOrganizationItem(firstSuggestion)
            ));
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            return serverError(interruptedException, "Ошибка запроса в DaData");
        } catch (Exception exception) {
            return serverError(exception, "Ошибка запроса в DaData");
        }
    }

    public ResponseEntity<Map<String, Object>> listOrganizations(
        String showShortCodeSnakeRaw,
        String showShortCodeCamelRaw,
        String organNameSnakeRaw,
        String organNameCamelRaw
    ) {
        String showShortCodeRaw = firstDefined(showShortCodeSnakeRaw, showShortCodeCamelRaw);
        String showShortCodeNormalized = normalizeText(showShortCodeRaw);
        if (showShortCodeNormalized == null) {
            return badRequest("Параметр showShortCode обязателен и должен быть true или false");
        }
        showShortCodeNormalized = showShortCodeNormalized.toLowerCase(Locale.ROOT);
        if (!Set.of("true", "false").contains(showShortCodeNormalized)) {
            return badRequest("Параметр showShortCode обязателен и должен быть true или false");
        }
        boolean showShortCode = "true".equals(showShortCodeNormalized);

        String organName = normalizeText(firstDefined(organNameSnakeRaw, organNameCamelRaw));

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("ou.deleted = false");
        where.add("ou.parent_id is null");
        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("(ou.name ILIKE ? or ou.sh_name ILIKE ? or ou.inn ILIKE ? or ou.kpp ILIKE ? or ou.ogrn ILIKE ? or ou.sap_id ILIKE ?)");
                String pattern = "%" + token + "%";
                params.add(pattern);
                params.add(pattern);
                params.add(pattern);
                params.add(pattern);
                params.add(pattern);
                params.add(pattern);
            }
        }
        if (showShortCode) {
            where.add("ou.short_code is not null");
        }

        String sql = """
            select
              ou.id::text as id,
              coalesce(ou.sh_name, ou.name) as sh_name,
              ou.sap_id,
              ou.inn,
              ou.kpp,
              ou.ogrn,
              addr.full_address
            from party.organ_unit ou
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id
              order by a.id
              limit 1
            ) addr on true
            where %s
            order by coalesce(ou.sh_name, ou.name) collate "C"
            limit 50
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());

            if (!items.isEmpty()) {
                List<String> organizationIds = new ArrayList<>();
                for (Map<String, Object> item : items) {
                    String organizationId = normalizeText(item.get("id"));
                    if (organizationId != null) {
                        organizationIds.add(organizationId);
                    }
                }

                Map<String, List<Map<String, Object>>> departmentsByRootId = new HashMap<>();
                if (!organizationIds.isEmpty()) {
                    String placeholders = organizationIds.stream().map(id -> "?").collect(Collectors.joining(", "));
                    String departmentsSql = """
                        with recursive dept_tree as (
                          select
                            root.id::text as root_id,
                            child.id as node_id,
                            child.id::text as id,
                            coalesce(child.sh_name, child.name) as sh_name,
                            child.sap_id
                          from party.organ_unit root
                          join party.organ_unit child on child.parent_id = root.id and child.deleted = false
                          where root.id::text in (%s)
                          union all
                          select
                            dt.root_id,
                            child.id as node_id,
                            child.id::text as id,
                            coalesce(child.sh_name, child.name) as sh_name,
                            child.sap_id
                          from dept_tree dt
                          join party.organ_unit child on child.parent_id = dt.node_id and child.deleted = false
                        )
                        select
                          root_id,
                          id,
                          sh_name,
                          sap_id
                        from dept_tree
                        order by root_id collate "C", sh_name collate "C", id collate "C"
                        """.formatted(placeholders);
                    List<Map<String, Object>> departmentRows =
                        jdbcTemplate.queryForList(departmentsSql, organizationIds.toArray());

                    for (Map<String, Object> departmentRow : departmentRows) {
                        String rootId = normalizeText(departmentRow.get("root_id"));
                        if (rootId == null) {
                            continue;
                        }
                        List<Map<String, Object>> list =
                            departmentsByRootId.computeIfAbsent(rootId, key -> new ArrayList<>());
                        list.add(mapOf(
                            "id", departmentRow.get("id"),
                            "sh_name", departmentRow.get("sh_name"),
                            "sap_id", departmentRow.get("sap_id")
                        ));
                    }
                }

                for (Map<String, Object> item : items) {
                    String rootId = normalizeText(item.get("id"));
                    List<Map<String, Object>> departments = new ArrayList<>();
                    departments.add(mapOf(
                        "id", item.get("id"),
                        "sh_name", item.get("sh_name"),
                        "sap_id", item.get("sap_id")
                    ));
                    if (rootId != null) {
                        departments.addAll(departmentsByRootId.getOrDefault(rootId, new ArrayList<>()));
                    }
                    item.put("departments", departments);
                }
            }

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> listOrganizationUnitTypes(
        String nameRaw
    ) {
        String name = normalizeText(nameRaw);
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("out.deleted = false");
        if (name != null) {
            for (String token : splitSearchTokens(name)) {
                where.add("out.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String sql = """
            select
              out.id::text as id,
              out.code as code,
              out.sort_order as sort_order,
              out.name as name
            from party.organ_unit_type out
            where %s
            order by out.sort_order nulls last, out.name, out.id
            """.formatted(String.join(" and ", where));
        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size()
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка списка типов организаций");
        }
    }

    public ResponseEntity<Map<String, Object>> listCountries(
        String nameRaw
    ) {
        String name = normalizeText(nameRaw);
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("c.deleted = false");
        if (name != null) {
            for (String token : splitSearchTokens(name)) {
                where.add("c.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String sql = """
            select
              c.id::text as id,
              c.name as name
            from nsi.country c
            where %s
            order by c.name, c.id
            """.formatted(String.join(" and ", where));
        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size()
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка списка стран");
        }
    }

    public ResponseEntity<Map<String, Object>> listRelations(
        String relationNameSnakeRaw,
        String relationNameCamelRaw
    ) {
        String relationName = normalizeText(firstDefined(relationNameSnakeRaw, relationNameCamelRaw));
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("deleted = false");
        if (relationName != null) {
            for (String token : splitSearchTokens(relationName)) {
                where.add("name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String sql = """
            select
              id::text as id,
              name
            from party.relation_type
            where %s
            order by name collate "C"
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> listProductGroups(
        String productGroupNameSnakeRaw,
        String productGroupNameCamelRaw
    ) {
        String productGroupName = normalizeText(firstDefined(productGroupNameSnakeRaw, productGroupNameCamelRaw));
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("deleted = false");
        if (productGroupName != null) {
            for (String token : splitSearchTokens(productGroupName)) {
                where.add("name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String sql = """
            select
              id::text as id,
              name
            from nsi.product_groups
            where %s
            order by name collate "C"
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> listPositions(
        String positionNameSnakeRaw,
        String positionNameCamelRaw
    ) {
        String positionName = normalizeText(firstDefined(positionNameSnakeRaw, positionNameCamelRaw));
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("deleted = false");
        if (positionName != null) {
            for (String token : splitSearchTokens(positionName)) {
                where.add("name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String sql = """
            select
              id::text as id,
              name,
              code
            from party.employee_position
            where %s
            order by name collate "C"
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> listEmployees(
        String departUnitId,
        String employeeId,
        String employeeName
    ) {
        departUnitId = normalizeText(departUnitId);
        employeeId = normalizeText(employeeId);
        employeeName = normalizeText(employeeName);

        if (departUnitId != null
            && !departUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр departUnitId должен быть UUID");
        }
        if (employeeId != null
            && !employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("e.deleted = false");

        if (departUnitId != null) {
            where.add(
                """
                exists (
                  select 1
                  from party.emp_pos_empl_org_unit eou
                  where eou.deleted = false
                    and eou.employee_id = e.id
                    and eou.organ_unit_id = ?::uuid
                )
                """
            );
            params.add(departUnitId);
        }

        if (employeeId != null) {
            where.add("e.id <> ?::uuid");
            params.add(employeeId);
        }
        if (employeeName != null) {
            for (String token : splitSearchTokens(employeeName)) {
                where.add("e.full_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String sql = """
            select
              e.id::text as "employeeId",
              e.full_name as "employeeFullName"
            from party.employee e
            where %s
            order by e.full_name collate "C" asc
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> employeesGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/employees с JSON body"));
    }

    public ResponseEntity<Map<String, Object>> employeesPost(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 50, "limit");
        if (limitParsed.error() != null) {
            return badRequest(limitParsed.error());
        }
        ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
        if (offsetParsed.error() != null) {
            return badRequest(offsetParsed.error());
        }

        SortParseResult sortsResult = parseSorts(body, EMPLOYEE_SORT_FIELDS, "full_name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }

        int limit = limitParsed.value();
        int offset = offsetParsed.value();
        List<SortRule> sorts = sortsResult.sorts();
        if (sorts.isEmpty()) {
            sorts = List.of(new SortRule("full_name", "ASC"));
        }

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("e.deleted = false");

        for (Map.Entry<String, String> filter : List.of(
            Map.entry("fullName", "full_name"),
            Map.entry("surname", "surname"),
            Map.entry("firstName", "first_name"),
            Map.entry("middleName", "middle_name"),
            Map.entry("email", "email"),
            Map.entry("phoneNumber", "phone_number"),
            Map.entry("sapId", "sap_id")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                for (String token : splitSearchTokens(value)) {
                    where.add("e." + filter.getValue() + " ILIKE ?");
                    params.add("%" + token + "%");
                }
            }
        }

        String employeeIdFilter = normalizeText(body.get("employeeId"));
        if (employeeIdFilter != null) {
            if (!employeeIdFilter.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
                return badRequest("Параметр employeeId должен быть UUID");
            }
            where.add("e.id = ?::uuid");
            params.add(employeeIdFilter);
        }

        String personalNumber = normalizeText(body.get("personalNumber"));
        if (personalNumber != null) {
            if (!personalNumber.matches("^\\d+$")) {
                return badRequest("Параметр personalNumber должен содержать только цифры");
            }
            where.add("e.personal_number = ?");
            params.add(Integer.parseInt(personalNumber));
        }

        String status = normalizeText(body.get("status"));
        if (status != null) {
            status = status.toUpperCase(Locale.ROOT);
            if (!ALLOWED_STATUS.contains(status)) {
                return badRequest("Параметр status должен быть ACTIVE или INACTIVE");
            }
            where.add("e.status = ?");
            params.add(status);
        }

        String departName = normalizeText(body.get("departName"));
        if (departName != null) {
            for (String token : splitSearchTokens(departName)) {
                where.add("""
                    exists (
                      select 1
                      from party.emp_pos_empl_org_unit eou
                      join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                      where eou.employee_id = e.id
                        and eou.deleted = false
                        and ou.sh_name ILIKE ?
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String positionName = normalizeText(body.get("positionName"));
        if (positionName != null) {
            for (String token : splitSearchTokens(positionName)) {
                where.add("""
                    exists (
                      select 1
                      from party.emp_pos_empl_org_unit eou
                      join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
                      where eou.employee_id = e.id
                        and eou.deleted = false
                        and ep.name ILIKE ?
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String organName = normalizeText(body.get("organName"));
        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("""
                    exists (
                      with recursive organ_chain as (
                        select
                          ou.id,
                          ou.parent_id,
                          ou.sh_name
                        from party.emp_pos_empl_org_unit eou
                        join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                        where eou.employee_id = e.id
                          and eou.deleted = false
                        union all
                        select
                          p.id,
                          p.parent_id,
                          p.sh_name
                        from organ_chain ch
                        join party.organ_unit p on p.id = ch.parent_id and p.deleted = false
                      )
                      select 1
                      from organ_chain
                      where parent_id is null
                        and sh_name ILIKE ?
                      limit 1
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String bossName = normalizeText(body.get("bossName"));
        if (bossName != null) {
            for (String token : splitSearchTokens(bossName)) {
                where.add("""
                    exists (
                      select 1
                      from party.emp_pos_empl_org_unit eou_child
                      join party.employee boss
                        on boss.id = eou_child.parent_id
                       and boss.deleted = false
                      where eou_child.employee_id = e.id
                        and eou_child.deleted = false
                        and boss.full_name ILIKE ?
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildEmployeeOrderBy(sorts);
        int sqlOffset = (offset - 1) * limit;

        String dataSql = """
            select
              e.id,
              e.full_name,
              e.surname,
              e.first_name,
              e.middle_name,
              e.email,
              e.phone_number,
              e.sap_id,
              e.personal_number,
              e.status
            from party.employee e
            left join lateral (
              with recursive chain as (
                select
                  eou.organ_unit_id as depart_unit_id,
                  ou.parent_id,
                  ou.id as current_id,
                  ou.sh_name as current_name
                from party.emp_pos_empl_org_unit eou
                join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                where eou.employee_id = e.id
                  and eou.deleted = false
                union all
                select
                  chain.depart_unit_id,
                  p.parent_id,
                  p.id as current_id,
                  p.sh_name as current_name
                from chain
                join party.organ_unit p on p.id = chain.parent_id and p.deleted = false
              ),
              roots as (
                select
                  depart_unit_id,
                  current_name as organ_name
                from chain
                where parent_id is null
              )
              select
                min(roots.organ_name) as organ_name,
                min(ou.sh_name) as depart_name,
                min(ep.name) as position_name,
                case
                  when count(*) = 1 then max(boss.full_name)
                  else ''
                end as boss_name
              from party.emp_pos_empl_org_unit eou
              join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
              left join roots on roots.depart_unit_id = eou.organ_unit_id
              left join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
              left join party.employee boss on boss.id = eou.parent_id and boss.deleted = false
              where eou.employee_id = e.id
                and eou.deleted = false
            ) as sort_info on true
            %s
            order by %s
            limit ?
            offset ?
            """.formatted(whereSql, orderBy);
        String countSql = """
            select count(*)::int
            from party.employee e
            %s
            """.formatted(whereSql);

        try {
            List<Object> pagedParams = new ArrayList<>(params);
            pagedParams.add(limit);
            pagedParams.add(sqlOffset);
            List<Map<String, Object>> items = jdbcTemplate.queryForList(dataSql, pagedParams.toArray());
            fillEmployeePositions(items);
            Integer totalCount = jdbcTemplate.queryForObject(countSql, Integer.class, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "total_count", totalCount == null ? 0 : totalCount,
                "limit", limit,
                "offset", offset,
                "sorts", toSortMaps(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<?> employeesExport(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts", "columns", "organUnitTypeNames", "organTypeNames"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ColumnsParseResult columnsResult = normalizeExportColumns(
            body.get("columns"),
            EMPLOYEE_EXPORT_COLUMNS,
            EMPLOYEE_EXPORT_DEFAULT_ORDER
        );
        if (columnsResult.error() != null) {
            return badRequest(columnsResult.error());
        }

        SortParseResult sortsResult = parseSorts(body, EMPLOYEE_SORT_FIELDS, "full_name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("full_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("deleted = false");

        for (Map.Entry<String, String> filter : List.of(
            Map.entry("fullName", "full_name"),
            Map.entry("surname", "surname"),
            Map.entry("firstName", "first_name"),
            Map.entry("middleName", "middle_name"),
            Map.entry("email", "email"),
            Map.entry("phoneNumber", "phone_number"),
            Map.entry("sapId", "sap_id")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                for (String token : splitSearchTokens(value)) {
                    where.add("e." + filter.getValue() + " ILIKE ?");
                    params.add("%" + token + "%");
                }
            }
        }

        String personalNumber = normalizeText(body.get("personalNumber"));
        if (personalNumber != null) {
            if (!personalNumber.matches("^\\d+$")) {
                return badRequest("Параметр personalNumber должен содержать только цифры");
            }
            where.add("e.personal_number = ?");
            params.add(Integer.parseInt(personalNumber));
        }

        String status = normalizeText(body.get("status"));
        if (status != null) {
            status = status.toUpperCase(Locale.ROOT);
            if (!ALLOWED_STATUS.contains(status)) {
                return badRequest("Параметр status должен быть ACTIVE или INACTIVE");
            }
            where.add("e.status = ?");
            params.add(status);
        }

        String departName = normalizeText(body.get("departName"));
        if (departName != null) {
            for (String token : splitSearchTokens(departName)) {
                where.add("""
                    exists (
                      select 1
                      from party.emp_pos_empl_org_unit eou
                      join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                      where eou.employee_id = e.id
                        and eou.deleted = false
                        and ou.sh_name ILIKE ?
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String positionName = normalizeText(body.get("positionName"));
        if (positionName != null) {
            for (String token : splitSearchTokens(positionName)) {
                where.add("""
                    exists (
                      select 1
                      from party.emp_pos_empl_org_unit eou
                      join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
                      where eou.employee_id = e.id
                        and eou.deleted = false
                        and ep.name ILIKE ?
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String organName = normalizeText(body.get("organName"));
        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("""
                    exists (
                      with recursive organ_chain as (
                        select
                          ou.id,
                          ou.parent_id,
                          ou.sh_name
                        from party.emp_pos_empl_org_unit eou
                        join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                        where eou.employee_id = e.id
                          and eou.deleted = false
                        union all
                        select
                          p.id,
                          p.parent_id,
                          p.sh_name
                        from organ_chain ch
                        join party.organ_unit p on p.id = ch.parent_id and p.deleted = false
                      )
                      select 1
                      from organ_chain
                      where parent_id is null
                        and sh_name ILIKE ?
                      limit 1
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String bossName = normalizeText(body.get("bossName"));
        if (bossName != null) {
            for (String token : splitSearchTokens(bossName)) {
                where.add("""
                    exists (
                      select 1
                      from party.emp_pos_empl_org_unit eou_child
                      join party.employee boss
                        on boss.id = eou_child.parent_id
                       and boss.deleted = false
                      where eou_child.employee_id = e.id
                        and eou_child.deleted = false
                        and boss.full_name ILIKE ?
                    )
                    """);
                params.add("%" + token + "%");
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildEmployeeExportOrderBy(sorts);
        String selectSql = buildSelectSql(columnsResult.columns());

        String sql = """
            select
              %s
            from party.employee e
            left join lateral (
              with recursive chain as (
                select
                  eou.organ_unit_id as depart_unit_id,
                  ou.parent_id,
                  ou.id as current_id,
                  ou.sh_name as current_name
                from party.emp_pos_empl_org_unit eou
                join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                where eou.employee_id = e.id
                  and eou.deleted = false
                union all
                select
                  chain.depart_unit_id,
                  p.parent_id,
                  p.id as current_id,
                  p.sh_name as current_name
                from chain
                join party.organ_unit p on p.id = chain.parent_id and p.deleted = false
              ),
              roots as (
                select
                  depart_unit_id,
                  current_name as organ_name
                from chain
                where parent_id is null
              ),
              base as (
                select
                  roots.organ_name as organ_name,
                  ou.sh_name as depart_name,
                  ep.name as position_name,
                  boss.full_name as boss_name
                from party.emp_pos_empl_org_unit eou
                join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                left join roots on roots.depart_unit_id = eou.organ_unit_id
                left join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
                left join party.employee boss on boss.id = eou.parent_id and boss.deleted = false
                where eou.employee_id = e.id
                  and eou.deleted = false
              ),
              agg as (
                select
                  coalesce((
                    select array_agg(name order by name collate "C")
                    from (
                      select distinct base2.organ_name as name
                      from base base2
                      where base2.organ_name is not null and base2.organ_name <> ''
                    ) distinct_organ
                  ), array[]::text[]) as organ_names,
                  coalesce((
                    select array_agg(name order by name collate "C")
                    from (
                      select distinct base2.depart_name as name
                      from base base2
                      where base2.depart_name is not null and base2.depart_name <> ''
                    ) distinct_depart
                  ), array[]::text[]) as depart_names,
                  count(*)::int as link_count,
                  max(base.position_name) as single_position_name,
                  max(base.boss_name) as single_boss_name
                from base
              )
              select
                case
                  when cardinality(agg.organ_names) = 0 then ''
                  when cardinality(agg.organ_names) = 1 then agg.organ_names[1]
                  else 'организаций: ' || cardinality(agg.organ_names)::text
                end as organ_name,
                case
                  when cardinality(agg.depart_names) = 0 then ''
                  when cardinality(agg.depart_names) = 1 then agg.depart_names[1]
                  else 'подразделений: ' || cardinality(agg.depart_names)::text
                end as depart_name,
                case
                  when agg.link_count = 1 then coalesce(agg.single_position_name, '')
                  else ''
                end as position_name,
                case
                  when agg.link_count = 1 then coalesce(agg.single_boss_name, '')
                  else ''
                end as boss_name
              from agg
            ) as export_info on true
            %s
            order by %s
            """.formatted(selectSql, whereSql, orderBy);

        try {
            LinkedHashMap<String, String> reportFilters = collectEmployeeReportFilters(body, sorts);
            byte[] excel = buildExcelFromQuery(
                sql,
                params.toArray(),
                "Employees",
                columnsResult.columns(),
                reportFilters
            );
            String fileName = createExportFileName("employees-export");
            return excelResponse(excel, fileName);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка выгрузки");
        }
    }

    public ResponseEntity<Map<String, Object>> employeesImport(
        MultipartFile file,
        String deleteMissingSnakeRaw,
        String deleteMissingCamelRaw,
        HttpServletRequest request
    ) {
        if (file == null || file.isEmpty()) {
            return badRequest("Файл не выбран");
        }

        boolean deleteMissing = "true".equalsIgnoreCase(firstDefined(deleteMissingSnakeRaw, deleteMissingCamelRaw));
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                return badRequest("Выбранный файл не соответствует требуемой структуре");
            }

            Row headerRow = sheet.getRow(0);
            List<String> header = readHeader(headerRow, formatter);
            if (!hasValidHeader(header)) {
                return badRequest("Выбранный файл не соответствует требуемой структуре");
            }

            Map<String, Integer> headerIndex = new HashMap<>();
            for (int i = 0; i < header.size(); i += 1) {
                headerIndex.put(header.get(i), i);
            }

            ImportStats stats = new ImportStats();
            List<String> protocolLines = new ArrayList<>();
            Set<String> emailsFromFile = new HashSet<>();
            List<PendingEmployeeRow> pendingInserts = new ArrayList<>();
            List<PendingEmployeeRow> pendingUpdates = new ArrayList<>();

            Set<String> existingEmails = new HashSet<>();
            jdbcTemplate.query(
                "select lower(email) as email from party.employee where email is not null",
                (resultSet) -> {
                    String emailValue = resultSet.getString("email");
                    if (emailValue != null && !emailValue.isBlank()) {
                        existingEmails.add(emailValue);
                    }
                }
            );

            int lastRow = sheet.getLastRowNum();
            for (int rowIndex = 1; rowIndex <= lastRow; rowIndex += 1) {
                Row row = sheet.getRow(rowIndex);
                Map<String, String> rowData = readRowData(row, formatter, headerIndex);
                if (isRowEmpty(rowData)) {
                    continue;
                }

                int rowNumber = rowIndex + 1;
                stats.totalRead++;
                String sourceEmail = normalizeNullable(rowData.get("email"));
                if (sourceEmail != null) {
                    emailsFromFile.add(sourceEmail.toLowerCase(Locale.ROOT));
                }

                ValidationResult validation = validateRow(rowData);
                if (!validation.valid()) {
                    stats.errors++;
                    protocolLines.add(formatLogLine(rowNumber, rowData.get("email"), "FALSE", validation.reason()));
                    continue;
                }

                String email = validation.data().email();
                String normalizedEmail = email.toLowerCase(Locale.ROOT);
                boolean exists = existingEmails.contains(normalizedEmail);
                PendingEmployeeRow pendingRow = new PendingEmployeeRow(rowNumber, email, validation.data());
                if (!exists) {
                    pendingInserts.add(pendingRow);
                    existingEmails.add(normalizedEmail);
                } else {
                    pendingUpdates.add(pendingRow);
                }
            }

            applyInsertBatch(pendingInserts, stats, protocolLines);
            applyUpdateBatch(pendingUpdates, stats, protocolLines);

            if (deleteMissing) {
                List<Map<String, Object>> activeEmployees = jdbcTemplate.queryForList(
                    "select id, email from party.employee where deleted = false"
                );
                for (Map<String, Object> employeeRow : activeEmployees) {
                    Object dbEmailObj = employeeRow.get("email");
                    String dbEmail = normalizeNullable(dbEmailObj);
                    if (dbEmail == null) {
                        continue;
                    }
                    if (emailsFromFile.contains(dbEmail.toLowerCase(Locale.ROOT))) {
                        continue;
                    }
                    jdbcTemplate.update(
                        "update party.employee set deleted = true, updated_at = now() where id = ?",
                        employeeRow.get("id")
                    );
                    stats.deleted++;
                    protocolLines.add(formatLogLine(0, dbEmail, "OK", "Запись отсутствует в файле и помечена deleted=true"));
                }
            }

            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss-SSS"));
            String logFileName = "employee-import-" + timestamp + ".log";
            String logContent = String.join("\n",
                "Операция загрузки завершена.",
                "Общее количество прочитанных записей: " + stats.totalRead,
                "Количество новых записей: " + stats.created,
                "Количество обновленных записей: " + stats.updated,
                "Количество ошибочных записей: " + stats.errors,
                "Количество удаленных записей: " + stats.deleted,
                "",
                "Протокол по строкам:",
                String.join("\n", protocolLines),
                ""
            );

            String logFileUrl = null;
            try {
                Files.createDirectories(logsDir);
                Files.writeString(logsDir.resolve(logFileName), logContent, StandardCharsets.UTF_8);
                String host = request.getHeader("host");
                if (StringUtils.hasText(host)) {
                    logFileUrl =
                        request.getScheme() +
                        "://" +
                        host +
                        "/api/admin/import-logs/" +
                        URLEncoder.encode(logFileName, StandardCharsets.UTF_8);
                }
            } catch (IOException ignored) {
                logFileUrl = null;
            }

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "Операция загрузки завершена.",
                "stats", mapOf(
                    "total_read_records", stats.totalRead,
                    "new_records", stats.created,
                    "updated_records", stats.updated,
                    "error_records", stats.errors,
                    "deleted_records", stats.deleted
                ),
                "log_file_name", logFileName,
                "log_file_url", logFileUrl
            ));
        } catch (Exception exception) {
            return badRequest("Не удалось обработать файл. Убедитесь, что выбран файл формата .xlsx");
        }
    }

    public ResponseEntity<Map<String, Object>> organizationsGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/organizations с JSON body"));
    }

    public ResponseEntity<Map<String, Object>> organizationDetails(
        String organUnitIdRaw
    ) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        String sql = """
            select
              ou.id::text as organ_unit_id,
              ou.sap_id,
              ou.short_code,
              ou.name,
              ou.sh_name,
              ou.inn,
              ou.kpp,
              ou.ogrn,
              ou.okpo,
              coalesce(
                nullif(trim(coalesce(ou.additional ->> 'kceh_number', ou.additional ->> 'cekh_number')), ''),
                additional_fallback.kceh_number
              ) as kceh_number,
              case
                when lower(
                  coalesce(
                    nullif(trim(coalesce(ou.additional ->> 'fast_track', ou.additional ->> 'fastTrack')), ''),
                    additional_fallback.fast_track_raw,
                    ''
                  )
                ) in ('true', 't', '1', 'yes', 'да')
                  then 'ДА'
                when lower(
                  coalesce(
                    nullif(trim(coalesce(ou.additional ->> 'fast_track', ou.additional ->> 'fastTrack')), ''),
                    additional_fallback.fast_track_raw,
                    ''
                  )
                ) in ('false', 'f', '0', 'no', 'нет')
                  then 'НЕТ'
                else null
              end as fast_track,
              coalesce(
                nullif(trim(coalesce(ou.additional ->> 'claim_prefix', ou.additional ->> 'claimPrefix')), ''),
                additional_fallback.claim_prefix
              ) as claim_prefix,
              case when ou.sign_resident = true then 'ДА' else 'НЕТ' end as sign_resident,
              ou.country_id::text as country_id,
              c.name as country_name,
              addr.full_address as address,
              coalesce(types.organ_unit_types, '[]'::jsonb)::text as organ_unit_types,
              coalesce(ou.data_info, '{}'::jsonb)::text as data_info
            from party.organ_unit ou
            left join nsi.country c on c.id = ou.country_id and c.deleted = false
            left join lateral (
              select
                nullif(trim(coalesce(ou2.additional ->> 'kceh_number', ou2.additional ->> 'cekh_number')), '') as kceh_number,
                nullif(trim(coalesce(ou2.additional ->> 'fast_track', ou2.additional ->> 'fastTrack')), '') as fast_track_raw,
                nullif(trim(coalesce(ou2.additional ->> 'claim_prefix', ou2.additional ->> 'claimPrefix')), '') as claim_prefix
              from party.organ_unit ou2
              where ou2.deleted = false
                and ou2.id <> ou.id
                and ou.sap_id is not null
                and ou2.sap_id = ou.sap_id
              order by
                case
                  when nullif(trim(coalesce(ou2.additional ->> 'claim_prefix', ou2.additional ->> 'claimPrefix')), '') is not null
                    then 0
                  else 1
                end,
                case
                  when nullif(trim(coalesce(ou2.additional ->> 'kceh_number', ou2.additional ->> 'cekh_number')), '') is not null
                    then 0
                  else 1
                end,
                case
                  when nullif(trim(coalesce(ou2.additional ->> 'fast_track', ou2.additional ->> 'fastTrack')), '') is not null
                    then 0
                  else 1
                end,
                ou2.updated_at desc nulls last,
                ou2.created_at desc nulls last,
                ou2.id
              limit 1
            ) as additional_fallback on true
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id and a.deleted = false
              order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
              limit 1
            ) as addr on true
            left join lateral (
              select jsonb_agg(
                       jsonb_build_object(
                         'organUnitTypeId', out.id::text,
                         'organUnitTypeCode', out.code,
                         'organUnitTypeSort', out.sort_order,
                         'organUnitTypeName', out.name
                       )
                       order by out.sort_order nulls last, out.name, out.id
                     ) as organ_unit_types
              from party.organ_unit_organ_unit_types ouot
              join party.organ_unit_type out on out.id = ouot.organ_unit_type_id
              where ouot.organ_unit_id = ou.id
            ) as types on true
            where ou.deleted = false
              and ou.id = ?::uuid
            limit 1
            """;
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, organUnitId);
            if (rows.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(mapOf("ok", false, "error", "Организация не найдена"));
            }
            Map<String, Object> source = rows.get(0);
            LinkedHashMap<String, Object> item = new LinkedHashMap<>(source);
            List<Map<String, Object>> organUnitTypes = parseJsonArrayOfObjects(source.get("organ_unit_types"));
            organUnitTypes.sort((left, right) -> {
                Integer leftSort = left.get("organUnitTypeSort") instanceof Number value ? value.intValue() : Integer.MAX_VALUE;
                Integer rightSort = right.get("organUnitTypeSort") instanceof Number value ? value.intValue() : Integer.MAX_VALUE;
                if (!Objects.equals(leftSort, rightSort)) {
                    return Integer.compare(leftSort, rightSort);
                }
                return String.valueOf(left.get("organUnitTypeName")).compareToIgnoreCase(String.valueOf(right.get("organUnitTypeName")));
            });
            item.put("organ_unit_types", organUnitTypes);
            item.put("data_info", parseJsonObject(source.get("data_info")));
            List<String> organUnitTypeNameItems = new ArrayList<>();
            for (Map<String, Object> typeItem : organUnitTypes) {
                String name = normalizeText(typeItem.get("organUnitTypeName"));
                if (name != null) {
                    organUnitTypeNameItems.add(name);
                }
            }
            item.put("organ_unit_type_names", organUnitTypeNameItems);
            return ResponseEntity.ok(mapOf("ok", true, "item", item));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> organizationUpdate(
        String organUnitIdRaw,
        Map<String, Object> rawBody
    ) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);

        boolean hasSapId = body.containsKey("sapId") || body.containsKey("sap_id");
        boolean hasName = body.containsKey("name");
        boolean hasShName = body.containsKey("shName") || body.containsKey("sh_name");
        boolean hasInn = body.containsKey("inn");
        boolean hasKpp = body.containsKey("kpp");
        boolean hasOgrn = body.containsKey("ogrn");
        boolean hasOkpo = body.containsKey("okpo");
        boolean hasShortCode = body.containsKey("shortCode") || body.containsKey("short_code");
        boolean hasCountryId = body.containsKey("countryId") || body.containsKey("country_id");
        boolean hasSignResident = body.containsKey("signResident") || body.containsKey("sign_resident");
        boolean hasKcehNumber = body.containsKey("kcehNumber") || body.containsKey("kceh_number");
        boolean hasAddress = body.containsKey("address") || body.containsKey("fullAddress");
        boolean hasClaimPrefix = body.containsKey("claimPrefix") || body.containsKey("claim_prefix");
        boolean hasFastTrack = body.containsKey("fastTrack") || body.containsKey("fast_track");
        boolean hasOrganUnitTypeIds = body.containsKey("organUnitTypeIds") || body.containsKey("organ_unit_type_ids");

        String sapId = normalizeText(body.containsKey("sapId") ? body.get("sapId") : body.get("sap_id"));
        String name = normalizeText(body.get("name"));
        String shName = normalizeText(body.containsKey("shName") ? body.get("shName") : body.get("sh_name"));
        String inn = normalizeText(body.get("inn"));
        String kpp = normalizeText(body.get("kpp"));
        String ogrn = normalizeText(body.get("ogrn"));
        String okpo = normalizeText(body.get("okpo"));
        String shortCode = normalizeText(body.containsKey("shortCode") ? body.get("shortCode") : body.get("short_code"));
        String countryId = normalizeText(body.containsKey("countryId") ? body.get("countryId") : body.get("country_id"));
        String signResidentRaw = normalizeText(
            body.containsKey("signResident")
                ? body.get("signResident")
                : body.get("sign_resident")
        );
        String kcehNumber = normalizeText(
            body.containsKey("kcehNumber")
                ? body.get("kcehNumber")
                : body.get("kceh_number")
        );
        String address = normalizeText(body.containsKey("address") ? body.get("address") : body.get("fullAddress"));
        String claimPrefix = normalizeText(
            body.containsKey("claimPrefix")
                ? body.get("claimPrefix")
                : body.get("claim_prefix")
        );

        Object fastTrackRawValue = body.containsKey("fastTrack")
            ? body.get("fastTrack")
            : body.get("fast_track");
        String fastTrackText = normalizeText(fastTrackRawValue);
        Boolean fastTrack = null;
        if (fastTrackRawValue instanceof Boolean booleanValue) {
            fastTrack = booleanValue;
        } else if (fastTrackText != null) {
            String normalized = fastTrackText.toUpperCase(Locale.ROOT);
            if (Set.of("ДА", "TRUE", "T", "1", "YES").contains(normalized)) {
                fastTrack = true;
            } else if (Set.of("НЕТ", "FALSE", "F", "0", "NO").contains(normalized)) {
                fastTrack = false;
            } else {
                return badRequest("Параметр fastTrack должен быть ДА/НЕТ или true/false");
            }
        }

        Boolean signResident = null;
        if (signResidentRaw != null) {
            String upper = signResidentRaw.toUpperCase(Locale.ROOT);
            if (Set.of("ДА", "TRUE", "T", "1", "YES").contains(upper)) {
                signResident = true;
            } else if (Set.of("НЕТ", "FALSE", "F", "0", "NO").contains(upper)) {
                signResident = false;
            } else {
                return badRequest("Параметр signResident должен быть ДА/НЕТ или true/false");
            }
        }

        if (countryId != null
            && !countryId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр countryId должен быть UUID");
        }

        LinkedHashSet<String> uniqueTypeIds = new LinkedHashSet<>();
        if (hasOrganUnitTypeIds) {
            Object rawTypeIds = body.containsKey("organUnitTypeIds")
                ? body.get("organUnitTypeIds")
                : body.get("organ_unit_type_ids");
            if (rawTypeIds == null) {
                rawTypeIds = List.of();
            }
            if (!(rawTypeIds instanceof List<?> rawTypeIdList)) {
                return badRequest("Параметр organUnitTypeIds должен быть массивом UUID");
            }
            for (Object rawTypeId : rawTypeIdList) {
                String typeId = normalizeText(rawTypeId);
                if (typeId == null) {
                    continue;
                }
                if (!typeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
                    return badRequest("Параметр organUnitTypeIds должен содержать только UUID");
                }
                uniqueTypeIds.add(typeId);
            }
        }
        List<String> organUnitTypeIds = new ArrayList<>(uniqueTypeIds);

        try {
            Integer organizationExists = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.organ_unit ou
                where ou.id = ?::uuid
                  and ou.deleted = false
                """,
                Integer.class,
                organUnitId
            );
            if (organizationExists == null || organizationExists == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена"
                ));
            }

            Map<String, Object> currentOrg = jdbcTemplate.queryForMap(
                """
                select
                  ou.sap_id,
                  ou.name,
                  ou.sh_name,
                  ou.inn,
                  ou.kpp,
                  ou.ogrn,
                  ou.okpo,
                  ou.short_code,
                  ou.country_id::text as country_id,
                  ou.sign_resident,
                  coalesce(ou.additional::text, '{}') as additional_json
                from party.organ_unit ou
                where ou.id = ?::uuid
                  and ou.deleted = false
                limit 1
                """,
                organUnitId
            );

            if (!hasSapId) {
                sapId = normalizeText(currentOrg.get("sap_id"));
            }
            if (!hasName) {
                name = normalizeText(currentOrg.get("name"));
            }
            if (!hasShName) {
                shName = normalizeText(currentOrg.get("sh_name"));
            }
            if (!hasInn) {
                inn = normalizeText(currentOrg.get("inn"));
            }
            if (!hasKpp) {
                kpp = normalizeText(currentOrg.get("kpp"));
            }
            if (!hasOgrn) {
                ogrn = normalizeText(currentOrg.get("ogrn"));
            }
            if (!hasOkpo) {
                okpo = normalizeText(currentOrg.get("okpo"));
            }
            if (!hasShortCode) {
                shortCode = normalizeText(currentOrg.get("short_code"));
            }
            if (!hasCountryId) {
                countryId = normalizeText(currentOrg.get("country_id"));
            }
            if (!hasSignResident && currentOrg.get("sign_resident") instanceof Boolean existingSignResident) {
                signResident = existingSignResident;
            }

            if (countryId != null) {
                Integer countryExists = jdbcTemplate.queryForObject(
                    """
                    select count(*)::int
                    from nsi.country c
                    where c.id = ?::uuid
                      and c.deleted = false
                    """,
                    Integer.class,
                    countryId
                );
                if (countryExists == null || countryExists == 0) {
                    return badRequest("Параметр countryId содержит несуществующую страну");
                }
            }

            if (hasOrganUnitTypeIds && !organUnitTypeIds.isEmpty()) {
                String typePlaceholders = String.join(", ", java.util.Collections.nCopies(organUnitTypeIds.size(), "?::uuid"));
                List<Object> typeParams = new ArrayList<>(organUnitTypeIds);
                Integer existingTypes = jdbcTemplate.queryForObject(
                    """
                    select count(*)::int
                    from party.organ_unit_type out
                    where out.deleted = false
                      and out.id in (%s)
                    """.formatted(typePlaceholders),
                    Integer.class,
                    typeParams.toArray()
                );
                if (existingTypes == null || existingTypes != organUnitTypeIds.size()) {
                    return badRequest("Параметр organUnitTypeIds содержит несуществующие типы организации");
                }
            }

            String existingAdditionalText = normalizeText(currentOrg.get("additional_json"));

            LinkedHashMap<String, Object> additional = new LinkedHashMap<>();
            try {
                if (existingAdditionalText != null) {
                    Map<String, Object> parsed = objectMapper.readValue(
                        existingAdditionalText,
                        new TypeReference<Map<String, Object>>() {}
                    );
                    if (parsed != null) {
                        additional.putAll(parsed);
                    }
                }
            } catch (Exception ignored) {
                additional.clear();
            }

            if (hasKcehNumber) {
                if (kcehNumber == null) {
                    additional.remove("kceh_number");
                    additional.remove("cekh_number");
                } else {
                    additional.put("kceh_number", kcehNumber);
                    additional.remove("cekh_number");
                }
            }

            if (hasClaimPrefix) {
                if (claimPrefix == null) {
                    additional.remove("claim_prefix");
                    additional.remove("claimPrefix");
                } else {
                    additional.put("claim_prefix", claimPrefix);
                    additional.remove("claimPrefix");
                }
            }

            if (hasFastTrack) {
                if (fastTrack == null) {
                    additional.remove("fast_track");
                    additional.remove("fastTrack");
                } else {
                    additional.put("fast_track", fastTrack);
                    additional.remove("fastTrack");
                }
            }

            String additionalJson = objectMapper.writeValueAsString(additional);

            int updatedCount = jdbcTemplate.update(
                """
                update party.organ_unit
                set
                  sap_id = ?,
                  name = ?,
                  sh_name = ?,
                  inn = ?,
                  kpp = ?,
                  ogrn = ?,
                  okpo = ?,
                  short_code = ?,
                  country_id = ?::uuid,
                  sign_resident = ?,
                  additional = ?::jsonb,
                  updated_at = now()
                where id = ?::uuid
                  and deleted = false
                """,
                sapId,
                name,
                shName,
                inn,
                kpp,
                ogrn,
                okpo,
                shortCode,
                countryId,
                signResident,
                additionalJson,
                organUnitId
            );
            if (updatedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена или удалена"
                ));
            }

            if (hasOrganUnitTypeIds) {
                jdbcTemplate.update(
                    """
                    delete from party.organ_unit_organ_unit_types
                    where organ_unit_id = ?::uuid
                    """,
                    organUnitId
                );
                if (!organUnitTypeIds.isEmpty()) {
                    String insertPlaceholders = organUnitTypeIds.stream()
                        .map((item) -> "(?::uuid, ?::uuid)")
                        .collect(Collectors.joining(", "));
                    List<Object> insertParams = new ArrayList<>();
                    for (String typeId : organUnitTypeIds) {
                        insertParams.add(organUnitId);
                        insertParams.add(typeId);
                    }
                    jdbcTemplate.update(
                        """
                        insert into party.organ_unit_organ_unit_types (
                          organ_unit_id,
                          organ_unit_type_id
                        )
                        values %s
                        """.formatted(insertPlaceholders),
                        insertParams.toArray()
                    );
                }
            }

            List<Map<String, Object>> addressRows = jdbcTemplate.queryForList(
                """
                select a.id::text as id
                from party.address a
                where a.organ_unit_id = ?::uuid
                  and a.deleted = false
                order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
                limit 1
                """,
                organUnitId
            );
            String addressId = addressRows.isEmpty() ? null : normalizeText(addressRows.get(0).get("id"));
            if (hasAddress) {
                if (addressId != null) {
                    jdbcTemplate.update(
                        """
                        update party.address
                        set
                          full_address = ?,
                          updated_at = now()
                        where id = ?::uuid
                        """,
                        address,
                        addressId
                    );
                } else if (address != null) {
                    jdbcTemplate.update(
                        """
                        insert into party.address (
                          id,
                          full_address,
                          organ_unit_id,
                          deleted,
                          created_at,
                          updated_at
                        )
                        values (?::uuid, ?, ?::uuid, false, now(), now())
                        """,
                        UUID.randomUUID().toString(),
                        address,
                        organUnitId
                    );
                }
            }

            return organizationDetails(organUnitId);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка обновления организации");
        }
    }

    public ResponseEntity<Map<String, Object>> organizationsPost(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts", "organUnitTypeNames"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 50, "limit");
        if (limitParsed.error() != null) {
            return badRequest(limitParsed.error());
        }
        ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
        if (offsetParsed.error() != null) {
            return badRequest(offsetParsed.error());
        }

        SortParseResult sortsResult = parseSorts(body, ORG_SORT_FIELDS, "name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("name", "ASC"))
            : sortsResult.sorts();

        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId != null
            && !organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }

        List<Object> params = new ArrayList<>();
        List<String> orgWhere = new ArrayList<>();
        orgWhere.add("ou.deleted = false");
        orgWhere.add("ou.parent_id is null");
        orgWhere.add("ou.sap_id is not null");
        orgWhere.add("trim(ou.sap_id) <> ''");
        List<String> extraWhere = new ArrayList<>();

        if (organUnitId != null) {
            orgWhere.add("ou.id = ?::uuid");
            params.add(organUnitId);
        }

        for (Map.Entry<String, String> filter : List.of(
            Map.entry("sapId", "sap_id"),
            Map.entry("name", "name"),
            Map.entry("shName", "sh_name"),
            Map.entry("inn", "inn"),
            Map.entry("kpp", "kpp"),
            Map.entry("ogrn", "ogrn"),
            Map.entry("okpo", "okpo")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                for (String token : splitSearchTokens(value)) {
                    orgWhere.add("ou." + filter.getValue() + " ILIKE ?");
                    params.add("%" + token + "%");
                }
            }
        }

        String countryName = normalizeText(body.containsKey("countryName") ? body.get("countryName") : body.get("country"));
        boolean hasCountryName = countryName != null;
        if (hasCountryName) {
            for (String token : splitSearchTokens(countryName)) {
                extraWhere.add("exists (select 1 from nsi.country c2 where c2.id = ou.country_id and c2.deleted = false and c2.name ILIKE ?)");
                params.add("%" + token + "%");
            }
        }

        String address = normalizeText(body.containsKey("address") ? body.get("address") : body.get("fullAddress"));
        boolean hasAddress = address != null;
        if (hasAddress) {
            for (String token : splitSearchTokens(address)) {
                extraWhere.add("exists (select 1 from party.address a where a.organ_unit_id = ou.id and a.deleted = false and a.full_address ILIKE ?)");
                params.add("%" + token + "%");
            }
        }

        String signResident = normalizeText(body.get("signResident"));
        if (signResident != null) {
            String upper = signResident.toUpperCase(Locale.ROOT);
            if (!Set.of("ДА", "НЕТ").contains(upper)) {
                return badRequest("Параметр signResident должен быть ДА или НЕТ");
            }
            orgWhere.add("ou.sign_resident = ?");
            params.add("ДА".equals(upper));
        }

        List<String> organUnitTypeNames = normalizeStringList(
            body.containsKey("organUnitTypeNames") ? body.get("organUnitTypeNames") : body.get("organTypeNames")
        );
        if (!organUnitTypeNames.isEmpty()) {
            String placeholders = organUnitTypeNames.stream().map(item -> "?").collect(Collectors.joining(", "));
            orgWhere.add("""
                exists (
                  select 1
                  from party.organ_unit_organ_unit_types ouot_filter
                  join party.organ_unit_type out_filter on out_filter.id = ouot_filter.organ_unit_type_id
                  where ouot_filter.organ_unit_id = ou.id
                    and out_filter.name in (%s)
                )
                """.formatted(placeholders));
            params.addAll(organUnitTypeNames);
        }

        String orgWhereSql = "where " + String.join(" and ", orgWhere);
        String extraWhereSql = extraWhere.isEmpty() ? "" : "and " + String.join(" and ", extraWhere);
        String orderBySql = buildOrganizationOrderBy(sorts);

        int limit = limitParsed.value();
        int offset = offsetParsed.value();
        int sqlOffset = (offset - 1) * limit;

        boolean isFastPath = !hasCountryName && !hasAddress && sorts.stream().noneMatch(
            rule -> "country_name".equals(rule.field())
                || "address".equals(rule.field())
                || "organ_unit_type_names".equals(rule.field())
        );

        String dataSql = isFastPath
            ? """
            with paged_base as (
              select
                ou.id,
                ou.sap_id,
                ou.name,
                ou.sh_name,
                ou.inn,
                ou.kpp,
                ou.ogrn,
                ou.okpo,
                ou.sign_resident,
                ou.country_id
              from party.organ_unit ou
              %s
              order by %s
              limit ?
              offset ?
            ),
            paged as (
              select paged_base.*, row_number() over () as order_idx
              from paged_base
            )
            select
              p.id::text as organ_unit_id,
              p.sap_id,
              p.name,
              p.sh_name,
              p.inn,
              p.kpp,
              p.ogrn,
              p.okpo,
              case when p.sign_resident = true then 'ДА' else 'НЕТ' end as sign_resident,
              c.name as country_name,
              addr.full_address as address,
              coalesce(types.organ_unit_types, '[]'::jsonb)::text as organ_unit_types
            from paged p
            left join nsi.country c on c.id = p.country_id and c.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = p.id and a.deleted = false
              order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
              limit 1
            ) as addr on true
            left join lateral (
              select jsonb_agg(
                       jsonb_build_object(
                         'organUnitTypeId', out.id::text,
                         'organUnitTypeCode', out.code,
                         'organUnitTypeSort', out.sort_order,
                         'organUnitTypeName', out.name
                       )
                       order by out.sort_order nulls last, out.name, out.id
                     ) as organ_unit_types,
                     string_agg(
                       coalesce(out.name, ''),
                       ' | '
                       order by out.sort_order nulls last, out.name, out.id
                     ) as organ_unit_type_names_sort
              from party.organ_unit_organ_unit_types ouot
              join party.organ_unit_type out on out.id = ouot.organ_unit_type_id
              where ouot.organ_unit_id = p.id
            ) as types on true
            order by p.order_idx
            """.formatted(orgWhereSql, orderBySql)
            : """
            select
              ou.id::text as organ_unit_id,
              ou.sap_id,
              ou.name,
              ou.sh_name,
              ou.inn,
              ou.kpp,
              ou.ogrn,
              ou.okpo,
              case when ou.sign_resident = true then 'ДА' else 'НЕТ' end as sign_resident,
              c.name as country_name,
              addr.full_address as address,
              coalesce(types.organ_unit_types, '[]'::jsonb)::text as organ_unit_types
            from party.organ_unit ou
            left join nsi.country c on c.id = ou.country_id and c.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id and a.deleted = false
              order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
              limit 1
            ) as addr on true
            left join lateral (
              select jsonb_agg(
                       jsonb_build_object(
                         'organUnitTypeId', out.id::text,
                         'organUnitTypeCode', out.code,
                         'organUnitTypeSort', out.sort_order,
                         'organUnitTypeName', out.name
                       )
                       order by out.sort_order nulls last, out.name, out.id
                     ) as organ_unit_types,
                     string_agg(
                       coalesce(out.name, ''),
                       ' | '
                       order by out.sort_order nulls last, out.name, out.id
                     ) as organ_unit_type_names_sort
              from party.organ_unit_organ_unit_types ouot
              join party.organ_unit_type out on out.id = ouot.organ_unit_type_id
              where ouot.organ_unit_id = ou.id
            ) as types on true
            %s
            %s
            order by %s
            limit ?
            offset ?
            """.formatted(orgWhereSql, extraWhereSql, orderBySql);

        String countSql = isFastPath
            ? """
            select count(*)::int
            from party.organ_unit ou
            %s
            """.formatted(orgWhereSql)
            : """
            select count(*)::int
            from party.organ_unit ou
            left join nsi.country c on c.id = ou.country_id and c.deleted = false
            %s
            %s
            """.formatted(orgWhereSql, extraWhereSql);

        try {
            List<Object> pagedParams = new ArrayList<>(params);
            pagedParams.add(limit);
            pagedParams.add(sqlOffset);
            List<Map<String, Object>> rawItems = reportTemplateRepository.queryForNamedListByArgs(
                dataSql,
                pagedParams.toArray()
            );
            List<Map<String, Object>> items = new ArrayList<>(rawItems.size());
            for (Map<String, Object> item : rawItems) {
                LinkedHashMap<String, Object> mapped = new LinkedHashMap<>(item);
                List<Map<String, Object>> organUnitTypes = parseJsonArrayOfObjects(item.get("organ_unit_types"));
                organUnitTypes.sort((left, right) -> {
                    Integer leftSort = left.get("organUnitTypeSort") instanceof Number value ? value.intValue() : Integer.MAX_VALUE;
                    Integer rightSort = right.get("organUnitTypeSort") instanceof Number value ? value.intValue() : Integer.MAX_VALUE;
                    if (!Objects.equals(leftSort, rightSort)) {
                        return Integer.compare(leftSort, rightSort);
                    }
                    return String.valueOf(left.get("organUnitTypeName")).compareToIgnoreCase(String.valueOf(right.get("organUnitTypeName")));
                });
                mapped.put("organ_unit_types", organUnitTypes);
                List<String> organUnitTypeNameItems = new ArrayList<>();
                for (Map<String, Object> typeItem : organUnitTypes) {
                    String name = normalizeText(typeItem.get("organUnitTypeName"));
                    if (name != null) {
                        organUnitTypeNameItems.add(name);
                    }
                }
                mapped.put("organ_unit_type_names", organUnitTypeNameItems);
                items.add(mapped);
            }
            Integer totalCount = reportTemplateRepository.queryForNamedObjectByArgs(
                countSql,
                Integer.class,
                params.toArray()
            );
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "total_count", totalCount == null ? 0 : totalCount,
                "limit", limit,
                "offset", offset,
                "sorts", toSortMapsCamel(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<?> organizationsExport(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts", "columns"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ColumnsParseResult columnsResult = normalizeExportColumns(
            body.get("columns"),
            ORG_EXPORT_COLUMNS,
            ORG_EXPORT_DEFAULT_ORDER
        );
        if (columnsResult.error() != null) {
            return badRequest(columnsResult.error());
        }

        SortParseResult sortsResult = parseSorts(body, ORG_SORT_FIELDS, "name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> orgWhere = new ArrayList<>();
        orgWhere.add("ou.deleted = false");
        List<String> extraWhere = new ArrayList<>();

        for (Map.Entry<String, String> filter : List.of(
            Map.entry("sapId", "sap_id"),
            Map.entry("name", "name"),
            Map.entry("shName", "sh_name"),
            Map.entry("inn", "inn"),
            Map.entry("kpp", "kpp"),
            Map.entry("ogrn", "ogrn"),
            Map.entry("okpo", "okpo")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                for (String token : splitSearchTokens(value)) {
                    orgWhere.add("ou." + filter.getValue() + " ILIKE ?");
                    params.add("%" + token + "%");
                }
            }
        }

        String countryName = normalizeText(body.containsKey("countryName") ? body.get("countryName") : body.get("country"));
        if (countryName != null) {
            for (String token : splitSearchTokens(countryName)) {
                extraWhere.add("exists (select 1 from nsi.country c2 where c2.id = ou.country_id and c2.deleted = false and c2.name ILIKE ?)");
                params.add("%" + token + "%");
            }
        }

        String address = normalizeText(body.containsKey("address") ? body.get("address") : body.get("fullAddress"));
        if (address != null) {
            for (String token : splitSearchTokens(address)) {
                extraWhere.add("addr.full_address ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String signResident = normalizeText(body.get("signResident"));
        if (signResident != null) {
            String upper = signResident.toUpperCase(Locale.ROOT);
            if (!Set.of("ДА", "НЕТ").contains(upper)) {
                return badRequest("Параметр signResident должен быть ДА или НЕТ");
            }
            orgWhere.add("ou.sign_resident = ?");
            params.add("ДА".equals(upper));
        }

        List<String> organUnitTypeNames = normalizeStringList(body.get("organUnitTypeNames"));
        if (!organUnitTypeNames.isEmpty()) {
            String placeholders = organUnitTypeNames.stream().map(item -> "?").collect(Collectors.joining(", "));
            extraWhere.add("""
                exists (
                  select 1
                  from party.organ_unit_organ_unit_types ouot_filter
                  join party.organ_unit_type out_filter on out_filter.id = ouot_filter.organ_unit_type_id
                  where ouot_filter.organ_unit_id = ou.id
                    and out_filter.name in (%s)
                )
                """.formatted(placeholders));
            params.addAll(organUnitTypeNames);
        }

        String orgWhereSql = "where " + String.join(" and ", orgWhere);
        String extraWhereSql = extraWhere.isEmpty() ? "" : "and " + String.join(" and ", extraWhere);
        String orderBy = buildOrganizationOrderBy(sorts);
        String selectSql = buildSelectSql(columnsResult.columns());

        String sql = """
            with latest_address as (
              select distinct on (a.organ_unit_id)
                a.organ_unit_id,
                a.full_address
              from party.address a
              where a.deleted = false
              order by a.organ_unit_id, a.updated_at desc nulls last, a.created_at desc nulls last, a.id
            )
            select
              %s
            from party.organ_unit ou
            left join nsi.country c on c.id = ou.country_id and c.deleted = false
            left join latest_address addr on addr.organ_unit_id = ou.id
            %s
            %s
            order by %s
            """.formatted(selectSql, orgWhereSql, extraWhereSql, orderBy);

        try {
            LinkedHashMap<String, String> reportFilters = collectOrganizationReportFilters(body, sorts);
            byte[] excel = buildExcelFromQuery(
                sql,
                params.toArray(),
                "Organizations",
                columnsResult.columns(),
                reportFilters
            );
            String fileName = createExportFileName("organizations-export");
            return excelResponse(excel, fileName);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка выгрузки");
        }
    }

    protected ResponseEntity<?> reportTemplateExcelPreviewInternal(
        Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String reportTemplateId = normalizeText(body.get("reportTemplateId"));
        if (reportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!reportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 500, "limit");
        if (limitParsed.error() != null) {
            return badRequest(limitParsed.error());
        }
        int limit = Math.min(limitParsed.value() == null ? 500 : limitParsed.value(), 500);

        String savedSqlQuery = "";
        try {
            Map<String, Object> template = reportTemplateRepository.findTemplateExcelMetaById(
                reportTemplateId,
                "report-preview",
                "xlsx"
            );
            if (template == null) {
                return badRequest("Шаблон отчета не найден");
            }
            savedSqlQuery = template.get("sql_query") == null ? null : String.valueOf(template.get("sql_query"));
            if (savedSqlQuery == null || savedSqlQuery.isBlank()) {
                return badRequest("Сохраненный SQL-скрипт пустой");
            }
            String validationError = validateReportTemplateSqlText(savedSqlQuery);
            if (validationError != null) {
                return badRequest(validationError);
            }
            Integer numberDays = template.get("number_days") instanceof Number value
                ? value.intValue()
                : 0;
            String claimOrganizationId = normalizeText(body.get("claimOrganizationId"));
            if (
                claimOrganizationId != null &&
                !claimOrganizationId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
            ) {
                return badRequest("Параметр claimOrganizationId должен быть UUID");
            }
            String reportId = normalizeText(body.get("reportId"));
            if (
                reportId != null &&
                !reportId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
            ) {
                return badRequest("Параметр reportId должен быть UUID");
            }
            List<String> roleNames = normalizeRoleNames(body.get("roleNames"));
            String method = normalizeText(template.get("method"));
            if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
                return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
            }
            String outputFileName = normalizeText(template.get("output_file_name"));
            Map<String, Object> reportInfo = parseReportInfoObject(template.get("report_info"));
            String startReportValue = normalizeText(body.get("startReport"));
            if (startReportValue == null) {
                startReportValue = normalizeText(reportInfo.get("startReport"));
            }
            String endReportValue = normalizeText(body.get("endReport"));
            if (endReportValue == null) {
                endReportValue = normalizeText(reportInfo.get("endReport"));
            }
            String sqlForExecution = toReportTemplateCheckSql(
                savedSqlQuery,
                reportTemplateId,
                numberDays,
                startReportValue,
                endReportValue,
                claimOrganizationId,
                reportId,
                roleNames
            );
            String countSql = "select count(*)::bigint as total_count from (" + sqlForExecution + ") report_excel_preview";
            String pagedSql = "select * from (" + sqlForExecution + ") report_excel_preview limit " + limit;

            Long totalRows = reportTemplateRepository.queryLong(countSql);
            List<ReportFieldConfig> visibleFields = resolveVisibleReportFields(reportInfo);
            if (visibleFields.isEmpty()) {
                return badRequest("В report_info должен быть хотя бы один видимый параметр поля");
            }
            byte[] logoBytes = template.get("report_logo") instanceof byte[] value ? value : null;
            String reportName = normalizeText(template.get("report_name"));
            GeneratedExcelResult generated = buildConfiguredReportExcelFromQuery(
                pagedSql,
                reportInfo,
                visibleFields,
                logoBytes,
                reportName == null ? "Отчет" : reportName,
                startReportValue,
                endReportValue,
                null
            );
            String fileName = createReportTemplateExportFileName(outputFileName, "xlsx", reportName);
            long selectedRows = totalRows == null ? 0L : totalRows;
            Map<String, String> extraHeaders = mapOf(
                "X-Execution-Ms", String.valueOf(generated.totalExecutionMs()),
                "X-Execution-Time", formatExecutionTimeMinutesSecondsMilliseconds(generated.totalExecutionMs()),
                "X-Selected-Rows", String.valueOf(selectedRows),
                "X-Preview-Limit", String.valueOf(limit),
                "X-Query-Execution-Ms", String.valueOf(generated.queryExecutionMs()),
                "X-Template-Fill-Ms", String.valueOf(generated.templateFillMs()),
                "X-Query-Execution-Ns", String.valueOf(generated.queryExecutionNs()),
                "X-Template-Fill-Ns", String.valueOf(generated.templateFillNs())
            );
            return excelResponse(generated.data(), fileName, extraHeaders);
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, savedSqlQuery, "Ошибка формирования предпросмотра отчета");
        }
    }

    protected ResponseEntity<?> reportTemplateExcelExportInternal(
        Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String reportTemplateId = normalizeText(body.get("reportTemplateId"));
        if (reportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!reportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        String savedSqlQuery = "";
        try {
            Map<String, Object> template = reportTemplateRepository.findTemplateExcelMetaById(
                reportTemplateId,
                "report",
                "xlsx"
            );
            if (template == null) {
                return badRequest("Шаблон отчета не найден");
            }
            savedSqlQuery = template.get("sql_query") == null ? null : String.valueOf(template.get("sql_query"));
            if (savedSqlQuery == null || savedSqlQuery.isBlank()) {
                return badRequest("Сохраненный SQL-скрипт пустой");
            }
            String validationError = validateReportTemplateSqlText(savedSqlQuery);
            if (validationError != null) {
                return badRequest(validationError);
            }

            Map<String, Object> reportInfo = parseReportInfoObject(template.get("report_info"));
            String startReportValue = normalizeText(body.get("startReport"));
            if (startReportValue == null) {
                startReportValue = normalizeText(reportInfo.get("startReport"));
            }
            String endReportValue = normalizeText(body.get("endReport"));
            if (endReportValue == null) {
                endReportValue = normalizeText(reportInfo.get("endReport"));
            }

            Integer numberDays = template.get("number_days") instanceof Number value ? value.intValue() : 0;
            String claimOrganizationId = normalizeText(body.get("claimOrganizationId"));
            if (
                claimOrganizationId != null &&
                !claimOrganizationId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
            ) {
                return badRequest("Параметр claimOrganizationId должен быть UUID");
            }
            String reportId = normalizeText(body.get("reportId"));
            if (
                reportId != null &&
                !reportId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
            ) {
                return badRequest("Параметр reportId должен быть UUID");
            }
            List<String> roleNames = normalizeRoleNames(body.get("roleNames"));
            String method = normalizeText(template.get("method"));
            if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
                return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
            }
            String sqlForExecution = toReportTemplateCheckSql(
                savedSqlQuery,
                reportTemplateId,
                numberDays,
                startReportValue,
                endReportValue,
                claimOrganizationId,
                reportId,
                roleNames
            );

            List<ReportFieldConfig> visibleFields = resolveVisibleReportFields(reportInfo);
            if (visibleFields.isEmpty()) {
                return badRequest("В report_info должен быть хотя бы один видимый параметр поля");
            }

            byte[] logoBytes = template.get("report_logo") instanceof byte[] value ? value : null;
            String reportName = normalizeText(template.get("report_name"));
            String outputFileName = normalizeText(template.get("output_file_name"));
            String outputFileType = normalizeText(template.get("output_file_type"));

            GeneratedExcelResult generated = buildConfiguredReportExcelFromQuery(
                sqlForExecution,
                reportInfo,
                visibleFields,
                logoBytes,
                reportName == null ? "Отчет" : reportName,
                startReportValue,
                endReportValue,
                reportTemplateExcelMaxRows
            );
            String fileName = createReportTemplateExportFileName(outputFileName, outputFileType, reportName);
            Map<String, String> extraHeaders = mapOf(
                "X-Execution-Ms", String.valueOf(generated.totalExecutionMs()),
                "X-Execution-Time", formatExecutionTimeMinutesSecondsMilliseconds(generated.totalExecutionMs()),
                "X-Selected-Rows", String.valueOf(generated.selectedRows()),
                "X-Query-Execution-Ms", String.valueOf(generated.queryExecutionMs()),
                "X-Template-Fill-Ms", String.valueOf(generated.templateFillMs()),
                "X-Query-Execution-Ns", String.valueOf(generated.queryExecutionNs()),
                "X-Template-Fill-Ns", String.valueOf(generated.templateFillNs())
            );
            return excelResponse(generated.data(), fileName, extraHeaders);
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, savedSqlQuery, "Ошибка формирования Excel-отчета");
        }
    }

    private boolean toBooleanOrDefault(Object rawValue, boolean fallbackValue) {
        if (rawValue instanceof Boolean booleanValue) {
            return booleanValue;
        }
        String normalized = normalizeText(rawValue);
        if (normalized == null) {
            return fallbackValue;
        }
        if ("true".equalsIgnoreCase(normalized) || "да".equalsIgnoreCase(normalized)) {
            return true;
        }
        if ("false".equalsIgnoreCase(normalized) || "нет".equalsIgnoreCase(normalized)) {
            return false;
        }
        return fallbackValue;
    }

    private Integer normalizePositiveOrderNumber(Object rawValue) {
        String normalized = normalizeText(rawValue);
        if (normalized == null || !normalized.matches("^\\d+$")) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private int toExcelColumnWidthUnitsFromExcelWidth(int excelWidth) {
        int normalized = Math.max(1, Math.min(255, excelWidth));
        return normalized * 256;
    }

    public ResponseEntity<Map<String, Object>> relationsPost(
        String employeeId,
        Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        String normalizedEmployeeId = normalizeText(employeeId);
        if (normalizedEmployeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (!normalizedEmployeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }

        SortParseResult sortsResult = parseSorts(body, RELATION_SORT_FIELDS, "organName");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("organ_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("r.deleted = false");
        where.add("r.employee_id = ?::uuid");
        params.add(normalizedEmployeeId);

        for (Map.Entry<String, String> filter : List.of(
            Map.entry("organName", "organ_name"),
            Map.entry("relationName", "relation_name"),
            Map.entry("salesOrganName", "sales_organ_name"),
            Map.entry("productGroupName", "product_group_name")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value == null) {
                continue;
            }
            for (String token : splitSearchTokens(value)) {
                switch (filter.getValue()) {
                    case "organ_name" -> where.add("ou.sh_name ILIKE ?");
                    case "relation_name" -> where.add("rt.name ILIKE ?");
                    case "sales_organ_name" -> where.add("sou.sh_name ILIKE ?");
                    case "product_group_name" -> where.add("pg.name ILIKE ?");
                    default -> {
                    }
                }
                params.add("%" + token + "%");
            }
        }

        String defaultFlagRaw = normalizeText(body.get("defaultFlag"));
        if (defaultFlagRaw != null) {
            String normalized = defaultFlagRaw.toUpperCase(Locale.ROOT);
            if (!"ВСЕ".equals(normalized)) {
                if ("ДА".equals(normalized) || "TRUE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(true);
                } else if ("НЕТ".equals(normalized) || "FALSE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(false);
                } else {
                    return badRequest("Параметр defaultFlag должен быть ДА, НЕТ или Все");
                }
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildRelationOrderBy(sorts);
        String sql = """
            select
              r.id::text as "relationId",
              ou.sh_name as "organName",
              ou.sap_id as "organSapId",
              ou.inn as "organInn",
              ou.kpp as "organKpp",
              ou.ogrn as "organOgrn",
              ao.full_address as "organFullAddress",
              r.organ_unit_id::text as "organUnitId",
              rt.name as "relationName",
              r.relation_type_id::text as "relationTypeId",
              sou.sh_name as "salesOrganName",
              r.sales_organization_id::text as "salesOrganUnitId",
              pg.name as "productGroupName",
              r.product_groups_id::text as "productGroupId",
              r.default_flag as "defaultFlag"
            from party.relation r
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id
              order by a.id
              limit 1
            ) ao on true
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            %s
            order by %s
            """.formatted(whereSql, orderBy);

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", items.size(),
                "sorts", toSortMaps(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationsPostAll(
        Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        SortParseResult sortsResult = parseSorts(body, RELATION_SORT_FIELDS, "organ_name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("organ_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("r.deleted = false");

        String organName = normalizeText(body.get("organName"));
        String relationName = normalizeText(body.get("relationName"));
        String salesOrganName = normalizeText(body.get("salesOrganName"));
        String productGroupName = normalizeText(body.get("productGroupName"));
        String employeeName = normalizeText(body.get("employeeName"));

        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("ou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (relationName != null) {
            for (String token : splitSearchTokens(relationName)) {
                where.add("rt.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (salesOrganName != null) {
            for (String token : splitSearchTokens(salesOrganName)) {
                where.add("sou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (productGroupName != null) {
            for (String token : splitSearchTokens(productGroupName)) {
                where.add("pg.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (employeeName != null) {
            for (String token : splitSearchTokens(employeeName)) {
                where.add("e.full_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String defaultFlagRaw = normalizeText(body.get("defaultFlag"));
        if (defaultFlagRaw != null) {
            String normalized = defaultFlagRaw.toUpperCase(Locale.ROOT);
            if (!"ВСЕ".equals(normalized)) {
                if ("ДА".equals(normalized) || "TRUE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(true);
                } else if ("НЕТ".equals(normalized) || "FALSE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(false);
                } else {
                    return badRequest("Параметр defaultFlag должен быть ДА, НЕТ или Все");
                }
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildRelationOrderBy(sorts);
        String sql = """
            with latest_address as (
              select distinct on (a.organ_unit_id)
                a.organ_unit_id,
                a.full_address
              from party.address a
              where a.deleted = false
              order by a.organ_unit_id, a.updated_at desc nulls last, a.created_at desc nulls last, a.id
            )
            select
              r.id::text as "relationId",
              e.id::text as "employeeId",
              e.full_name as "employeeName",
              ou.sh_name as "organName",
              ou.sap_id as "organSapId",
              ou.inn as "organInn",
              ou.kpp as "organKpp",
              ou.ogrn as "organOgrn",
              addr.full_address as "organFullAddress",
              r.organ_unit_id::text as "organUnitId",
              rt.name as "relationName",
              r.relation_type_id::text as "relationTypeId",
              sou.sh_name as "salesOrganName",
              r.sales_organization_id::text as "salesOrganUnitId",
              pg.name as "productGroupName",
              r.product_groups_id::text as "productGroupId",
              r.default_flag as "defaultFlag"
            from party.relation r
            join party.employee e on e.id = r.employee_id and e.deleted = false
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join latest_address addr on addr.organ_unit_id = ou.id
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            %s
            order by %s
            """.formatted(whereSql, orderBy);

        try {
            List<Map<String, Object>> items = jdbcTemplate.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", items.size(),
                "sorts", toSortMapsCamel(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<?> relationsExport(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts", "columns"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ColumnsParseResult columnsResult = normalizeExportColumns(
            body.get("columns"),
            RELATION_EXPORT_COLUMNS,
            RELATION_EXPORT_DEFAULT_ORDER
        );
        if (columnsResult.error() != null) {
            return badRequest(columnsResult.error());
        }

        SortParseResult sortsResult = parseSorts(body, RELATION_SORT_FIELDS, "employee_name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("employee_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("r.deleted = false");
        where.add("e.deleted = false");

        String organName = normalizeText(body.get("organName"));
        String relationName = normalizeText(body.get("relationName"));
        String salesOrganName = normalizeText(body.get("salesOrganName"));
        String productGroupName = normalizeText(body.get("productGroupName"));
        String employeeName = normalizeText(body.get("employeeName"));

        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("ou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (relationName != null) {
            for (String token : splitSearchTokens(relationName)) {
                where.add("rt.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (salesOrganName != null) {
            for (String token : splitSearchTokens(salesOrganName)) {
                where.add("sou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (productGroupName != null) {
            for (String token : splitSearchTokens(productGroupName)) {
                where.add("pg.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (employeeName != null) {
            for (String token : splitSearchTokens(employeeName)) {
                where.add("e.full_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String defaultFlagRaw = normalizeText(body.get("defaultFlag"));
        if (defaultFlagRaw != null) {
            String normalized = defaultFlagRaw.toUpperCase(Locale.ROOT);
            if (!"ВСЕ".equals(normalized)) {
                if ("ДА".equals(normalized) || "TRUE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(true);
                } else if ("НЕТ".equals(normalized) || "FALSE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(false);
                } else {
                    return badRequest("Параметр defaultFlag должен быть ДА, НЕТ или Все");
                }
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildRelationOrderBy(sorts);
        String selectSql = buildSelectSql(columnsResult.columns());
        String sql = """
            select
              %s,
              e.id::text as __employee_id_link
            from party.relation r
            join party.employee e on e.id = r.employee_id
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            %s
            order by %s
            """.formatted(selectSql, whereSql, orderBy);

        try {
            LinkedHashMap<String, String> reportFilters = collectRelationReportFilters(body, sorts);
            byte[] excel = buildExcelFromQuery(
                sql,
                params.toArray(),
                "Relations",
                columnsResult.columns(),
                reportFilters,
                (columnKey, resultSet) -> {
                    if (!"employee_name".equals(columnKey)) {
                        return null;
                    }
                    String employeeId = normalizeText(resultSet.getString("__employee_id_link"));
                    if (employeeId == null || !employeeId.matches(
                        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
                    )) {
                        return null;
                    }
                    String baseUrl = this.frontendBaseUrl.isEmpty() ? "http://localhost:5175" : this.frontendBaseUrl;
                    return baseUrl + "/?employeeId=" + employeeId;
                }
            );
            String fileName = createExportFileName("relations-export");
            return excelResponse(excel, fileName);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка выгрузки");
        }
    }

    public ResponseEntity<Map<String, Object>> relationCreate(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        String employeeId = normalizeText(body.get("employeeId"));
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        String relationTypeId = normalizeText(body.get("relationTypeId"));
        if (relationTypeId == null) {
            return badRequest("Параметр relationTypeId обязателен");
        }
        String salesOrganizationId = normalizeText(body.get("salesOrganizationId"));
        String productGroupsId = normalizeText(body.get("productGroupsId"));
        if (!employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (!relationTypeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр relationTypeId должен быть UUID");
        }
        if (salesOrganizationId != null && !salesOrganizationId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр salesOrganizationId должен быть UUID");
        }
        if (productGroupsId != null && !productGroupsId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр productGroupsId должен быть UUID");
        }

        boolean defaultFlag;
        Object defaultFlagRaw = body.get("defaultFlag");
        if (defaultFlagRaw instanceof Boolean flag) {
            defaultFlag = flag;
        } else {
            defaultFlag = "TRUE".equalsIgnoreCase(String.valueOf(defaultFlagRaw));
        }

        try {
            Integer duplicateCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.relation r
                where r.deleted = false
                  and r.employee_id = ?::uuid
                  and r.organ_unit_id = ?::uuid
                  and r.relation_type_id = ?::uuid
                  and r.sales_organization_id is not distinct from ?::uuid
                  and r.product_groups_id is not distinct from ?::uuid
                """,
                Integer.class,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                productGroupsId
            );
            if (duplicateCount != null && duplicateCount > 0) {
                return badRequest("Связь с указанным сочетанием уже существует");
            }

            String relationId = jdbcTemplate.queryForObject(
                """
                insert into party.relation (
                  employee_id,
                  organ_unit_id,
                  relation_type_id,
                  sales_organization_id,
                  default_flag,
                  product_groups_id
                )
                values (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, ?::uuid)
                returning id::text
                """,
                String.class,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                defaultFlag,
                productGroupsId
            );

            Map<String, Object> item = jdbcTemplate.queryForMap(
                """
                select
                  r.id::text as "relationId",
                  ou.sh_name as "organName",
                  ou.sap_id as "organSapId",
                  ou.inn as "organInn",
                  ou.kpp as "organKpp",
                  ou.ogrn as "organOgrn",
                  ao.full_address as "organFullAddress",
                  r.organ_unit_id::text as "organUnitId",
                  rt.name as "relationName",
                  r.relation_type_id::text as "relationTypeId",
                  sou.sh_name as "salesOrganName",
                  r.sales_organization_id::text as "salesOrganUnitId",
                  pg.name as "productGroupName",
                  r.product_groups_id::text as "productGroupId",
                  r.default_flag as "defaultFlag"
                from party.relation r
                join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
                left join lateral (
                  select a.full_address
                  from party.address a
                  where a.organ_unit_id = ou.id
                  order by a.id
                  limit 1
                ) ao on true
                left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
                left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
                left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
                where r.id = ?::uuid
                limit 1
                """,
                relationId
            );

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationUpdate(
        String relationId,
        Map<String, Object> rawBody
    ) {
        String normalizedRelationId = normalizeText(relationId);
        if (normalizedRelationId == null) {
            return badRequest("Параметр relationId обязателен");
        }
        if (!normalizedRelationId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр relationId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        String employeeId = normalizeText(body.get("employeeId"));
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        String relationTypeId = normalizeText(body.get("relationTypeId"));
        if (relationTypeId == null) {
            return badRequest("Параметр relationTypeId обязателен");
        }
        String salesOrganizationId = normalizeText(body.get("salesOrganizationId"));
        String productGroupsId = normalizeText(body.get("productGroupsId"));
        if (!employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (!relationTypeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр relationTypeId должен быть UUID");
        }
        if (salesOrganizationId != null && !salesOrganizationId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр salesOrganizationId должен быть UUID");
        }
        if (productGroupsId != null && !productGroupsId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр productGroupsId должен быть UUID");
        }

        boolean defaultFlag;
        Object defaultFlagRaw = body.get("defaultFlag");
        if (defaultFlagRaw instanceof Boolean flag) {
            defaultFlag = flag;
        } else {
            defaultFlag = "TRUE".equalsIgnoreCase(String.valueOf(defaultFlagRaw));
        }

        try {
            Integer duplicateCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.relation r
                where r.deleted = false
                  and r.employee_id = ?::uuid
                  and r.organ_unit_id = ?::uuid
                  and r.relation_type_id = ?::uuid
                  and r.sales_organization_id is not distinct from ?::uuid
                  and r.product_groups_id is not distinct from ?::uuid
                  and r.id <> ?::uuid
                """,
                Integer.class,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                productGroupsId,
                normalizedRelationId
            );
            if (duplicateCount != null && duplicateCount > 0) {
                return badRequest("Связь с указанным сочетанием уже существует");
            }

            int updatedCount = jdbcTemplate.update(
                """
                update party.relation
                set
                  employee_id = ?::uuid,
                  organ_unit_id = ?::uuid,
                  relation_type_id = ?::uuid,
                  sales_organization_id = ?::uuid,
                  default_flag = ?,
                  product_groups_id = ?::uuid
                where id = ?::uuid
                """,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                defaultFlag,
                productGroupsId,
                normalizedRelationId
            );
            if (updatedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь не найдена"
                ));
            }

            Map<String, Object> item = jdbcTemplate.queryForMap(
                """
                select
                  r.id::text as "relationId",
                  ou.sh_name as "organName",
                  ou.sap_id as "organSapId",
                  ou.inn as "organInn",
                  ou.kpp as "organKpp",
                  ou.ogrn as "organOgrn",
                  ao.full_address as "organFullAddress",
                  r.organ_unit_id::text as "organUnitId",
                  rt.name as "relationName",
                  r.relation_type_id::text as "relationTypeId",
                  sou.sh_name as "salesOrganName",
                  r.sales_organization_id::text as "salesOrganUnitId",
                  pg.name as "productGroupName",
                  r.product_groups_id::text as "productGroupId",
                  r.default_flag as "defaultFlag"
                from party.relation r
                join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
                left join lateral (
                  select a.full_address
                  from party.address a
                  where a.organ_unit_id = ou.id
                  order by a.id
                  limit 1
                ) ao on true
                left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
                left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
                left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
                where r.id = ?::uuid
                limit 1
                """,
                normalizedRelationId
            );

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationDelete(String relationId) {
        String normalizedRelationId = normalizeText(relationId);
        if (normalizedRelationId == null) {
            return badRequest("Параметр relationId обязателен");
        }
        if (!normalizedRelationId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр relationId должен быть UUID");
        }

        try {
            int deletedCount = jdbcTemplate.update(
                "delete from party.relation where id = ?::uuid",
                normalizedRelationId
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь не найдена"
                ));
            }

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deleted_count", deletedCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }


    public ResponseEntity<Map<String, Object>> organizationDelete(
        String organUnitIdRaw
    ) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }

        try {
            Integer existingOrganizationCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.organ_unit ou
                where ou.id = ?::uuid
                  and ou.deleted = false
                """,
                Integer.class,
                organUnitId
            );
            if (existingOrganizationCount == null || existingOrganizationCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена или уже удалена"
                ));
            }

            List<OrganizationReferenceCheck> references = loadOrganizationReferenceChecks();
            for (OrganizationReferenceCheck reference : references) {
                String referenceSql = buildOrganizationReferenceCheckSql(reference);
                Integer referencesCount = jdbcTemplate.queryForObject(
                    referenceSql,
                Integer.class,
                    organUnitId
            );
                if (referencesCount != null && referencesCount > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                    "ok", false,
                        "error", "Организация используется в таблице " + reference.fullTableName()
                    ));
                }
            }

            int deletedOrganUnitCount = jdbcTemplate.update(
                """
                update party.organ_unit
                set
                  deleted = true,
                  updated_at = now()
                where id = ?::uuid
                  and deleted = false
                """,
                organUnitId
            );
            int deletedAddressCount = jdbcTemplate.update(
                """
                update party.address
                set
                  deleted = true,
                  updated_at = now()
                where organ_unit_id = ?::uuid
                  and deleted = false
                """,
                organUnitId
            );
            int deletedEmailCount = jdbcTemplate.update(
                """
                update party.organ_unit_email
                set
                  deleted = true,
                  updated_at = now()
                where organ_unit_id = ?::uuid
                  and deleted = false
                """,
                organUnitId
            );
            int deletedTypeRelationsCount = jdbcTemplate.update(
                """
                delete from party.organ_unit_organ_unit_types
                where organ_unit_id = ?::uuid
                """,
                organUnitId
            );

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deleted_count", deletedOrganUnitCount,
                "addressDeletedCount", deletedAddressCount,
                "organUnitTypesDeletedCount", deletedTypeRelationsCount,
                "organUnitEmailsDeletedCount", deletedEmailCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления организации");
        }
    }

    private String hasArrayValue(Map<String, Object> body, Set<String> allowedArrayKeys) {
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            if (entry.getValue() instanceof List<?> && !allowedArrayKeys.contains(entry.getKey())) {
                return entry.getKey();
            }
        }
        return null;
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

    private SortParseResult parseSorts(Map<String, Object> body, Set<String> allowedFields, String defaultField) {
        Object sortsRaw = body.get("sorts");
        List<SortRule> sorts = new ArrayList<>();

        if (sortsRaw != null) {
            if (!(sortsRaw instanceof List<?> sortsList)) {
                return new SortParseResult(null, "Параметр sorts должен быть массивом");
            }
            for (Object item : sortsList) {
                if (!(item instanceof Map<?, ?> sortMap)) {
                    return new SortParseResult(null, "Каждый элемент sorts должен быть объектом");
                }
                String field = normalizeSortField(sortMap.get("field"));
                String direction = normalizeSortDirection(sortMap.get("direction"));
                if (!allowedFields.contains(field)) {
                    return new SortParseResult(null, "Параметр sorts содержит недопустимое поле сортировки");
                }
                if (!ALLOWED_SORT_DIRECTIONS.contains(direction)) {
                    return new SortParseResult(null, "Параметр sorts содержит недопустимое направление сортировки");
                }
                sorts.add(new SortRule(field, direction));
            }
            return new SortParseResult(sorts, null);
        }

        String sortDirection = normalizeSortDirection(body.getOrDefault("sortDirection", "ASC"));
        if (!ALLOWED_SORT_DIRECTIONS.contains(sortDirection)) {
            return new SortParseResult(null, "Параметр sortDirection должен быть ASC или DESC");
        }
        String sortField = normalizeSortField(body.getOrDefault("sortField", defaultField));
        if (!allowedFields.contains(sortField)) {
            return new SortParseResult(null, "Параметр sortField содержит недопустимое поле сортировки");
        }
        sorts.add(new SortRule(sortField, sortDirection));
        return new SortParseResult(sorts, null);
    }

    private String normalizeSortField(Object value) {
        return camelToSnake(String.valueOf(value == null ? "" : value).trim());
    }

    private String normalizeSortDirection(Object value) {
        return String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
    }

    private String buildOrderBy(List<SortRule> sorts, Set<String> textFields, boolean organization) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String field = organization ? ORG_SORT_SQL.get(sort.field()) : sort.field();
            String sortExpr = textFields.contains(sort.field()) ? field + " collate \"C\"" : field;
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private String buildEmployeeOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String sortExpr = EMPLOYEE_SORT_SQL.get(sort.field());
            if (EMPLOYEE_TEXT_SORT_FIELDS.contains(sort.field())) {
                sortExpr = sortExpr + " collate \"C\"";
            }
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private String buildEmployeeExportOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String sortExpr = EMPLOYEE_EXPORT_SORT_SQL.get(sort.field());
            if (EMPLOYEE_TEXT_SORT_FIELDS.contains(sort.field())) {
                sortExpr = sortExpr + " collate \"C\"";
            }
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private String buildOrganizationOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = ORG_SORT_SQL.get(sort.field());
            String sortExpr = ORG_TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private String buildRelationOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = RELATION_SORT_SQL.get(sort.field());
            String sortExpr = RELATION_TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private ColumnsParseResult normalizeExportColumns(Object rawColumns, Map<String, ColumnMeta> registry, List<String> defaultOrder) {
        if (rawColumns == null) {
            List<ExportColumn> defaults = new ArrayList<>();
            for (String key : defaultOrder) {
                ColumnMeta meta = registry.get(key);
                defaults.add(new ExportColumn(key, meta.title(), meta.sql()));
            }
            return new ColumnsParseResult(defaults, null);
        }
        if (!(rawColumns instanceof List<?> columnsList)) {
            return new ColumnsParseResult(null, "Параметр columns должен быть массивом");
        }

        List<ExportColumn> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Object item : columnsList) {
            String key;
            String requestedTitle = "";
            if (item instanceof Map<?, ?> mapItem) {
                key = normalizeSortField(mapItem.get("key"));
                requestedTitle = String.valueOf(mapItem.get("title") == null ? "" : mapItem.get("title")).trim();
            } else {
                key = normalizeSortField(item);
            }

            if (key.isEmpty() || seen.contains(key)) {
                continue;
            }
            ColumnMeta meta = registry.get(key);
            if (meta == null) {
                return new ColumnsParseResult(null, "Параметр columns содержит недопустимый key");
            }
            result.add(new ExportColumn(key, requestedTitle.isEmpty() ? meta.title() : requestedTitle, meta.sql()));
            seen.add(key);
        }

        if (result.isEmpty()) {
            return new ColumnsParseResult(null, "Параметр columns не должен быть пустым");
        }
        return new ColumnsParseResult(result, null);
    }

    private String buildSelectSql(List<ExportColumn> columns) {
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < columns.size(); i += 1) {
            parts.add(columns.get(i).sql() + " as c" + i);
        }
        return String.join(",\n  ", parts);
    }

    private byte[] buildExcelFromQuery(
        String sql,
        Object[] params,
        String sheetName,
        List<ExportColumn> columns,
        LinkedHashMap<String, String> reportFilters
    ) throws IOException {
        return buildExcelFromQuery(sql, params, sheetName, columns, reportFilters, null);
    }

    @FunctionalInterface
    private interface ExcelHyperlinkResolver {
        String resolve(String columnKey, ResultSet resultSet) throws SQLException;
    }

    private byte[] buildExcelFromQuery(
        String sql,
        Object[] params,
        String sheetName,
        List<ExportColumn> columns,
        LinkedHashMap<String, String> reportFilters,
        ExcelHyperlinkResolver hyperlinkResolver
    ) throws IOException {
        SXSSFWorkbook workbook = new SXSSFWorkbook(1000);
        workbook.setCompressTempFiles(false);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(sheetName);
            CellStyle hyperlinkCellStyle = workbook.createCellStyle();
            Font hyperlinkFont = workbook.createFont();
            hyperlinkFont.setUnderline(Font.U_SINGLE);
            hyperlinkFont.setColor(IndexedColors.BLUE.getIndex());
            hyperlinkCellStyle.setFont(hyperlinkFont);
            int rowIndex = 0;
            int columnsCount = columns.size();

            int filtersTitleRowIndex = rowIndex;
            Row filtersTitleRow = sheet.createRow(rowIndex++);
            filtersTitleRow.createCell(0).setCellValue("Параметры отчета");

            if (reportFilters.isEmpty()) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue("Фильтры: не заданы");
            } else {
                for (Map.Entry<String, String> entry : reportFilters.entrySet()) {
                    Row row = sheet.createRow(rowIndex++);
                    row.createCell(0).setCellValue(entry.getKey());
                    row.createCell(1).setCellValue(entry.getValue());
                }
            }

            rowIndex += 1;
            int tableHeaderRowIndex = rowIndex;
            Row headerRow = sheet.createRow(rowIndex++);
            int[] maxLengths = new int[columnsCount];
            for (int index = 0; index < columnsCount; index += 1) {
                String header = columns.get(index).title();
                headerRow.createCell(index).setCellValue(header);
                maxLengths[index] = Math.max(10, Math.min(80, header.length() + 2));
            }

            final int[] currentRowIndex = {rowIndex};
            jdbcTemplate.query(sql, (resultSet) -> {
                while (resultSet.next()) {
                    Row row = sheet.createRow(currentRowIndex[0]++);
                    for (int columnIndex = 0; columnIndex < columnsCount; columnIndex += 1) {
                        String alias = "c" + columnIndex;
                        Object value = resultSet.getObject(alias);
                        String text = value == null ? "" : String.valueOf(value);
                        Cell cell = row.createCell(columnIndex);
                        cell.setCellValue(text);
                        if (hyperlinkResolver != null && !text.isBlank()) {
                            String hyperlinkAddress = hyperlinkResolver.resolve(columns.get(columnIndex).key(), resultSet);
                            if (hyperlinkAddress != null && !hyperlinkAddress.isBlank()) {
                                String escapedUrl = hyperlinkAddress.replace("\"", "\"\"");
                                String escapedText = text.replace("\"", "\"\"");
                                cell.setCellFormula("HYPERLINK(\"" + escapedUrl + "\",\"" + escapedText + "\")");
                                cell.setCellStyle(hyperlinkCellStyle);
                            }
                        }

                        int normalizedLength = Math.max(10, Math.min(60, text.length() + 2));
                        if (normalizedLength > maxLengths[columnIndex]) {
                            maxLengths[columnIndex] = normalizedLength;
                        }
                    }
                }
                return null;
            }, params);

            for (int index = 0; index < maxLengths.length; index += 1) {
                sheet.setColumnWidth(index, Math.min(255 * 256, maxLengths[index] * 256));
            }
            int lastDataRowIndex = Math.max(tableHeaderRowIndex, currentRowIndex[0] - 1);
            if (columnsCount > 0) {
                sheet.setAutoFilter(new CellRangeAddress(
                    tableHeaderRowIndex,
                    lastDataRowIndex,
                    0,
                    columnsCount - 1
                ));
            }
            sheet.createFreezePane(0, tableHeaderRowIndex + 1);
            workbook.write(out);
            return out.toByteArray();
        } finally {
            workbook.dispose();
            workbook.close();
        }
    }

    private byte[] buildExcelFromRows(
        String sheetName,
        List<String> columns,
        List<Map<String, Object>> rows
    ) throws IOException {
        SXSSFWorkbook workbook = new SXSSFWorkbook(1000);
        workbook.setCompressTempFiles(false);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(sheetName);
            int rowIndex = 0;
            Row headerRow = sheet.createRow(rowIndex++);
            int[] maxLengths = new int[columns.size()];
            for (int index = 0; index < columns.size(); index += 1) {
                String header = String.valueOf(columns.get(index));
                headerRow.createCell(index).setCellValue(header);
                maxLengths[index] = Math.max(10, Math.min(80, header.length() + 2));
            }

            for (Map<String, Object> rowData : rows) {
                Row row = sheet.createRow(rowIndex++);
                for (int index = 0; index < columns.size(); index += 1) {
                    String columnName = columns.get(index);
                    Object value = rowData == null ? null : rowData.get(columnName);
                    String text = value == null ? "" : String.valueOf(value);
                    row.createCell(index).setCellValue(text);
                    int normalizedLength = Math.max(10, Math.min(60, text.length() + 2));
                    if (normalizedLength > maxLengths[index]) {
                        maxLengths[index] = normalizedLength;
                    }
                }
            }

            for (int index = 0; index < maxLengths.length; index += 1) {
                sheet.setColumnWidth(index, Math.min(255 * 256, maxLengths[index] * 256));
            }
            if (!columns.isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(
                    0,
                    Math.max(0, rowIndex - 1),
                    0,
                    columns.size() - 1
                ));
            }
            sheet.createFreezePane(0, 1);
            workbook.write(out);
            return out.toByteArray();
        } finally {
            workbook.dispose();
            workbook.close();
        }
    }

    private Map<String, Object> parseReportInfoObject(Object rawReportInfo) throws IOException {
        if (rawReportInfo instanceof Map<?, ?> mapValue) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cast = (Map<String, Object>) mapValue;
            return cast;
        }
        String reportInfoText = normalizeText(rawReportInfo);
        if (reportInfoText == null) {
            return new LinkedHashMap<>();
        }
        Object parsed = objectMapper.readValue(reportInfoText, Object.class);
        if (!(parsed instanceof Map<?, ?> mapValue)) {
            throw new IllegalArgumentException("Параметр report_info должен быть JSON-объектом");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> cast = (Map<String, Object>) mapValue;
        return cast;
    }

    private List<ReportFieldConfig> resolveVisibleReportFields(Map<String, Object> reportInfo) {
        List<ReportFieldConfig> result = new ArrayList<>();
        Object fieldsRaw = reportInfo == null ? null : reportInfo.get("fields");
        if (!(fieldsRaw instanceof List<?>)) {
            // Backward compatibility: some templates were saved with a typo key.
            fieldsRaw = reportInfo == null ? null : reportInfo.get("fileds");
        }
        if (!(fieldsRaw instanceof List<?> fieldsList)) {
            return result;
        }
        int sourceIndex = 0;
        for (Object fieldRaw : fieldsList) {
            if (!(fieldRaw instanceof Map<?, ?> fieldMap)) {
                sourceIndex += 1;
                continue;
            }
            String fieldName = normalizeText(fieldMap.get("fieldName"));
            if (fieldName == null) {
                fieldName = normalizeText(fieldMap.get("name"));
            }
            if (fieldName == null) {
                sourceIndex += 1;
                continue;
            }
            boolean reportVisible = toBooleanOrDefault(fieldMap.get("reportVisible"), true);
            if (!reportVisible) {
                sourceIndex += 1;
                continue;
            }
            Integer order = normalizePositiveOrderNumber(fieldMap.get("fieldOrderNumber"));
            if (order == null) {
                order = sourceIndex + 1;
            }
            String fieldCaption = normalizeText(fieldMap.get("fieldCaption"));
            String fieldType = normalizeText(fieldMap.get("fieldDataType"));
            if (fieldType == null) {
                fieldType = normalizeText(fieldMap.get("fieldType"));
            }
            String fieldDataFormat = normalizeText(fieldMap.get("fieldDataFormat"));
            String fieldLink = normalizeText(fieldMap.get("fieldLink"));
            String fieldVertAlign = normalizeText(fieldMap.get("fieldVertAlign"));
            String fieldHorizAlign = normalizeText(fieldMap.get("fieldHorizAlign"));
            boolean fieldAutoWidth = toBooleanOrDefault(fieldMap.get("fieldAutoWidth"), true);
            Integer fieldFixedWidth = normalizePositiveOrderNumber(
                fieldMap.containsKey("filedWidth") ? fieldMap.get("filedWidth") : fieldMap.get("fieldWidth")
            );
            boolean fieldAutoTransfer = toBooleanOrDefault(fieldMap.get("fieldAutoTransfer"), true);
            boolean fieldBoldFont = toBooleanOrDefault(fieldMap.get("fieldBoldFont"), false);
            result.add(new ReportFieldConfig(
                fieldName,
                fieldCaption == null ? fieldName : fieldCaption,
                fieldType,
                fieldDataFormat,
                fieldLink,
                fieldVertAlign,
                fieldHorizAlign,
                fieldAutoWidth,
                fieldFixedWidth,
                fieldAutoTransfer,
                fieldBoldFont,
                order,
                sourceIndex
            ));
            sourceIndex += 1;
        }
        result.sort(
            Comparator.comparingInt(ReportFieldConfig::orderNumber)
                .thenComparingInt(ReportFieldConfig::sourceIndex)
        );
        if (!result.isEmpty()) {
            return result;
        }

        // Fallback: if all rows were filtered out by visibility flags, still keep fields by name.
        sourceIndex = 0;
        for (Object fieldRaw : fieldsList) {
            if (!(fieldRaw instanceof Map<?, ?> fieldMap)) {
                sourceIndex += 1;
                continue;
            }
            String fieldName = normalizeText(fieldMap.get("fieldName"));
            if (fieldName == null) {
                fieldName = normalizeText(fieldMap.get("name"));
            }
            if (fieldName == null) {
                sourceIndex += 1;
                continue;
            }
            String fieldCaption = normalizeText(fieldMap.get("fieldCaption"));
            String fieldType = normalizeText(fieldMap.get("fieldDataType"));
            if (fieldType == null) {
                fieldType = normalizeText(fieldMap.get("fieldType"));
            }
            String fieldDataFormat = normalizeText(fieldMap.get("fieldDataFormat"));
            String fieldLink = normalizeText(fieldMap.get("fieldLink"));
            String fieldVertAlign = normalizeText(fieldMap.get("fieldVertAlign"));
            String fieldHorizAlign = normalizeText(fieldMap.get("fieldHorizAlign"));
            boolean fieldAutoWidth = toBooleanOrDefault(fieldMap.get("fieldAutoWidth"), true);
            Integer fieldFixedWidth = normalizePositiveOrderNumber(
                fieldMap.containsKey("filedWidth") ? fieldMap.get("filedWidth") : fieldMap.get("fieldWidth")
            );
            boolean fieldAutoTransfer = toBooleanOrDefault(fieldMap.get("fieldAutoTransfer"), true);
            boolean fieldBoldFont = toBooleanOrDefault(fieldMap.get("fieldBoldFont"), false);
            result.add(new ReportFieldConfig(
                fieldName,
                fieldCaption == null ? fieldName : fieldCaption,
                fieldType,
                fieldDataFormat,
                fieldLink,
                fieldVertAlign,
                fieldHorizAlign,
                fieldAutoWidth,
                fieldFixedWidth,
                fieldAutoTransfer,
                fieldBoldFont,
                sourceIndex + 1,
                sourceIndex
            ));
            sourceIndex += 1;
        }
        result.sort(
            Comparator.comparingInt(ReportFieldConfig::orderNumber)
                .thenComparingInt(ReportFieldConfig::sourceIndex)
        );
        return result;
    }

    private GeneratedExcelResult buildConfiguredReportExcelFromQuery(
        String sql,
        Map<String, Object> reportInfo,
        List<ReportFieldConfig> visibleFields,
        byte[] reportLogoBytes,
        String reportName,
        String startReportValue,
        String endReportValue,
        Integer maxExportRows
    ) throws IOException {
        int startReportRow = normalizePositiveOrderNumber(reportInfo == null ? null : reportInfo.get("startReportRow")) == null
            ? 4
            : normalizePositiveOrderNumber(reportInfo.get("startReportRow"));
        int startReportCol = normalizePositiveOrderNumber(reportInfo == null ? null : reportInfo.get("startReportCol")) == null
            ? 1
            : normalizePositiveOrderNumber(reportInfo.get("startReportCol"));
        int headerFontSize = normalizePositiveOrderNumber(reportInfo == null ? null : reportInfo.get("headerFontSize")) == null
            ? 16
            : normalizePositiveOrderNumber(reportInfo.get("headerFontSize"));
        int tabCaptionFontSize = normalizePositiveOrderNumber(reportInfo == null ? null : reportInfo.get("fontTabCaptionSize")) == null
            ? 12
            : normalizePositiveOrderNumber(reportInfo.get("fontTabCaptionSize"));
        int recordFontSize = normalizePositiveOrderNumber(reportInfo == null ? null : reportInfo.get("recordFontSize")) == null
            ? 11
            : normalizePositiveOrderNumber(reportInfo.get("recordFontSize"));
        int heightTabCaption = normalizePositiveOrderNumber(reportInfo == null ? null : reportInfo.get("heightTabCaption")) == null
            ? 70
            : normalizePositiveOrderNumber(reportInfo.get("heightTabCaption"));
        boolean showLogoReport = toBooleanOrDefault(reportInfo == null ? null : reportInfo.get("showLogoReport"), true);
        boolean filterSet = toBooleanOrDefault(reportInfo == null ? null : reportInfo.get("filtrSet"), true);
        String headerCaption = normalizeText(reportInfo == null ? null : reportInfo.get("headerCaption"));
        if (headerCaption == null) {
            headerCaption = reportName;
        }
        String headerFontColorHex = normalizeHexColorOrDefault(reportInfo == null ? null : reportInfo.get("headerFontColor"), "#000000");
        String backTabCaptionColorHex = normalizeHexColorOrDefault(
            reportInfo == null ? null : reportInfo.get("backTabCaptionColor"),
            "#FFFFFF"
        );
        String fontTabCaptionColorHex = normalizeHexColorOrDefault(
            reportInfo == null ? null : reportInfo.get("fontTabCaptionColor"),
            "#000000"
        );

        int startRowIndex = Math.max(0, startReportRow - 1);
        int startColIndex = Math.max(0, startReportCol - 1);
        long totalStartedAtNanos = System.nanoTime();
        long queryExecutionNanos = 0L;
        long templateFillNanos = 0L;
        SXSSFWorkbook workbook = new SXSSFWorkbook(1000);
        workbook.setCompressTempFiles(false);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Report");
            CreationHelper creationHelper = workbook.getCreationHelper();

            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) Math.max(8, Math.min(72, headerFontSize)));
            applyFontHexColorIfPossible(titleFont, headerFontColorHex);
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.LEFT);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle periodStyle = workbook.createCellStyle();
            Font periodFont = workbook.createFont();
            periodFont.setBold(false);
            periodFont.setFontHeightInPoints((short) Math.max(8, Math.min(48, headerFontSize - 2)));
            applyFontHexColorIfPossible(periodFont, headerFontColorHex);
            periodStyle.setFont(periodFont);
            periodStyle.setAlignment(HorizontalAlignment.LEFT);
            periodStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle createdAtStyle = workbook.createCellStyle();
            Font createdAtFont = workbook.createFont();
            createdAtFont.setBold(false);
            createdAtFont.setFontHeightInPoints((short) 9);
            applyFontHexColorIfPossible(createdAtFont, headerFontColorHex);
            createdAtStyle.setFont(createdAtFont);
            createdAtStyle.setAlignment(HorizontalAlignment.LEFT);
            createdAtStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle tableHeaderStyle = workbook.createCellStyle();
            Font tableHeaderFont = workbook.createFont();
            tableHeaderFont.setBold(true);
            tableHeaderFont.setFontHeightInPoints((short) Math.max(8, Math.min(48, tabCaptionFontSize)));
            applyFontHexColorIfPossible(tableHeaderFont, fontTabCaptionColorHex);
            tableHeaderStyle.setFont(tableHeaderFont);
            tableHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyFillHexColorIfPossible(tableHeaderStyle, backTabCaptionColorHex);
            tableHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            tableHeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            tableHeaderStyle.setBorderTop(BorderStyle.THIN);
            tableHeaderStyle.setBorderBottom(BorderStyle.THIN);
            tableHeaderStyle.setBorderLeft(BorderStyle.THIN);
            tableHeaderStyle.setBorderRight(BorderStyle.THIN);

            CellStyle dataDefaultStyle = workbook.createCellStyle();
            Font dataFont = workbook.createFont();
            dataFont.setFontHeightInPoints((short) Math.max(8, Math.min(48, recordFontSize)));
            dataDefaultStyle.setFont(dataFont);
            dataDefaultStyle.setBorderTop(BorderStyle.THIN);
            dataDefaultStyle.setBorderBottom(BorderStyle.THIN);
            dataDefaultStyle.setBorderLeft(BorderStyle.THIN);
            dataDefaultStyle.setBorderRight(BorderStyle.THIN);

            Map<String, CellStyle> dataStyleCache = new HashMap<>();
            Map<Short, CellStyle> hyperlinkStyleCache = new HashMap<>();
            Map<String, Font> dataFontCache = new HashMap<>();
            Map<String, Font> hyperlinkFontCache = new HashMap<>();

            final int fixedLogoWidthPx = (int) Math.round(1.4 * 96.0);
            final int fixedLogoHeightPx = (int) Math.round(0.8 * 96.0);
            final int fixedLogoWidthEmu = (int) Math.round(1.4 * 914400.0);
            final int fixedLogoHeightEmu = (int) Math.round(0.8 * 914400.0);
            final int logoOffsetEmu = 2 * Units.EMU_PER_PIXEL;
            int logoRenderedWidthPx = 0;
            int logoRenderedHeightPx = 0;
            byte[] logoBytesForExcel = reportLogoBytes;
            if (showLogoReport && reportLogoBytes != null && reportLogoBytes.length > 0) {
                logoRenderedWidthPx = fixedLogoWidthPx;
                logoRenderedHeightPx = fixedLogoHeightPx;
                try {
                    BufferedImage image = ImageIO.read(new ByteArrayInputStream(reportLogoBytes));
                    if (image != null && image.getWidth() > 0 && image.getHeight() > 0) {
                        BufferedImage normalizedLogo = new BufferedImage(
                            logoRenderedWidthPx,
                            logoRenderedHeightPx,
                            BufferedImage.TYPE_INT_ARGB
                        );
                        Graphics2D graphics = normalizedLogo.createGraphics();
                        graphics.setRenderingHint(
                            RenderingHints.KEY_INTERPOLATION,
                            RenderingHints.VALUE_INTERPOLATION_BILINEAR
                        );
                        graphics.setRenderingHint(
                            RenderingHints.KEY_RENDERING,
                            RenderingHints.VALUE_RENDER_QUALITY
                        );
                        graphics.drawImage(image, 0, 0, logoRenderedWidthPx, logoRenderedHeightPx, null);
                        graphics.dispose();
                        try (ByteArrayOutputStream logoOut = new ByteArrayOutputStream()) {
                            ImageIO.write(normalizedLogo, "png", logoOut);
                            logoBytesForExcel = logoOut.toByteArray();
                        }
                    }
                } catch (Exception ignored) {
                    // Keep original bytes and fixed anchor size.
                }
            }
            int titleColIndex = startColIndex;
            if (showLogoReport && logoBytesForExcel != null && logoBytesForExcel.length > 0) {
                titleColIndex = Math.max(startColIndex, 2);
            }
            int titleBaseRowIndex = Math.max(0, startRowIndex - 3);
            int tableLastColIndex = Math.max(startColIndex, startColIndex + visibleFields.size() - 1);
            float preTableRowHeightPoints = 22f;
            for (int rowIndex = 0; rowIndex < startRowIndex; rowIndex += 1) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    row = sheet.createRow(rowIndex);
                }
                row.setHeightInPoints(preTableRowHeightPoints);
            }
            String periodLine = buildReportPeriodLine(startReportValue, endReportValue);
            String createdAtLine =
                "Дата/время формирования отчета: " +
                ZonedDateTime.now(reportExcelZoneId).format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss"));

            if (headerCaption != null && !headerCaption.isBlank()) {
                Row titleRow = sheet.getRow(titleBaseRowIndex);
                if (titleRow == null) {
                    titleRow = sheet.createRow(titleBaseRowIndex);
                }
                Cell titleCell = titleRow.createCell(titleColIndex);
                titleCell.setCellValue(headerCaption);
                titleCell.setCellStyle(titleStyle);
            }

            Row periodRow = sheet.getRow(titleBaseRowIndex + 1);
            if (periodRow == null) {
                periodRow = sheet.createRow(titleBaseRowIndex + 1);
            }
            Cell periodCell = periodRow.createCell(titleColIndex);
            periodCell.setCellValue(periodLine);
            periodCell.setCellStyle(periodStyle);

            Row createdAtRow = sheet.getRow(titleBaseRowIndex + 2);
            if (createdAtRow == null) {
                createdAtRow = sheet.createRow(titleBaseRowIndex + 2);
            }
            Cell createdAtCell = createdAtRow.createCell(titleColIndex);
            createdAtCell.setCellValue(createdAtLine);
            createdAtCell.setCellStyle(createdAtStyle);

            if (showLogoReport && logoBytesForExcel != null && logoBytesForExcel.length > 0) {
                int pictureType = detectExcelPictureType(logoBytesForExcel);
                int pictureIndex = workbook.addPicture(logoBytesForExcel, pictureType);
                Drawing<?> drawing = sheet.createDrawingPatriarch();
                ClientAnchor anchor = createEmuSizedAnchor(
                    sheet,
                    creationHelper,
                    0,
                    0,
                    Math.max(1, fixedLogoWidthEmu),
                    Math.max(1, fixedLogoHeightEmu),
                    logoOffsetEmu,
                    logoOffsetEmu
                );
                anchor.setAnchorType(ClientAnchor.AnchorType.DONT_MOVE_AND_RESIZE);
                drawing.createPicture(anchor, pictureIndex);
            }

            Row headerRow = sheet.getRow(startRowIndex);
            if (headerRow == null) {
                headerRow = sheet.createRow(startRowIndex);
            }
            headerRow.setHeightInPoints(Math.max(12f, Math.min(200f, heightTabCaption)));

            int[] maxLengths = new int[visibleFields.size()];
            for (int index = 0; index < visibleFields.size(); index += 1) {
                ReportFieldConfig field = visibleFields.get(index);
                String caption = field.caption();
                int columnIndex = startColIndex + index;
                Cell cell = headerRow.createCell(columnIndex);
                cell.setCellValue(caption);
                CellStyle borderedHeaderStyle = workbook.createCellStyle();
                borderedHeaderStyle.cloneStyleFrom(tableHeaderStyle);
                borderedHeaderStyle.setBorderTop(BorderStyle.THICK);
                borderedHeaderStyle.setBorderBottom(BorderStyle.THICK);
                borderedHeaderStyle.setBorderLeft(index == 0 ? BorderStyle.THICK : BorderStyle.THIN);
                borderedHeaderStyle.setBorderRight(
                    index == visibleFields.size() - 1 ? BorderStyle.THICK : BorderStyle.THIN
                );
                cell.setCellStyle(borderedHeaderStyle);
                maxLengths[index] = Math.max(10, Math.min(80, caption.length() + 2));
            }

            long queryStartedAtNanos = System.nanoTime();
            final int[] currentRowIndex = {startRowIndex + 1};
            final long[] selectedRows = {0L};
            final long[] queryReadNanos = {0L};
            final long[] nextRowNanos = {0L};
            final long[] templateOnlyNanos = {0L};
            jdbcTemplate.query(connection -> {
                java.sql.PreparedStatement statement = connection.prepareStatement(
                    sql,
                    ResultSet.TYPE_FORWARD_ONLY,
                    ResultSet.CONCUR_READ_ONLY
                );
                statement.setFetchSize(REPORT_TEMPLATE_EXPORT_FETCH_SIZE);
                return statement;
            }, (resultSet) -> {
                Map<String, String> byLowerName = resolveResultSetColumnsByLowerName(resultSet);
                while (true) {
                    long nextStartedAtNanos = System.nanoTime();
                    boolean hasNext = resultSet.next();
                    long nextElapsedNanos = System.nanoTime() - nextStartedAtNanos;
                    queryReadNanos[0] += nextElapsedNanos;
                    nextRowNanos[0] += nextElapsedNanos;
                    if (!hasNext) {
                        break;
                    }
                    if (maxExportRows != null && maxExportRows > 0 && selectedRows[0] >= maxExportRows) {
                        throw new IllegalStateException(
                            "Превышен лимит строк для Excel-экспорта (" + maxExportRows + "). Уточните параметры отчета."
                        );
                    }
                    selectedRows[0] += 1L;
                    long rowStartedAtNanos = System.nanoTime();
                    long rowQueryNanos = 0L;
                    Row row = sheet.createRow(currentRowIndex[0]++);
                    for (int index = 0; index < visibleFields.size(); index += 1) {
                        ReportFieldConfig field = visibleFields.get(index);
                        int columnIndex = startColIndex + index;
                        long readValueStartedAtNanos = System.nanoTime();
                        Object value = readResultSetValue(resultSet, byLowerName, field.name());
                        long readValueNanos = System.nanoTime() - readValueStartedAtNanos;
                        queryReadNanos[0] += readValueNanos;
                        rowQueryNanos += readValueNanos;
                        Cell cell = row.createCell(columnIndex);

                        String textValue = writeValueToCell(cell, value, field.type());
                        if (isBooleanFieldType(field.type())) {
                            String normalizedBooleanText = String.valueOf(textValue).trim().toLowerCase(Locale.ROOT);
                            if ("true".equals(normalizedBooleanText) || "t".equals(normalizedBooleanText) || "1".equals(normalizedBooleanText)) {
                                textValue = "ДА";
                                cell.setCellValue(textValue);
                            } else if (
                                "false".equals(normalizedBooleanText) ||
                                "f".equals(normalizedBooleanText) ||
                                "0".equals(normalizedBooleanText)
                            ) {
                                textValue = "НЕТ";
                                cell.setCellValue(textValue);
                            }
                        }
                        CellStyle dataCellStyle = resolveDataCellStyle(
                            workbook,
                            dataDefaultStyle,
                            dataStyleCache,
                            dataFontCache,
                            creationHelper,
                            field.type(),
                            field.dataFormat(),
                            field.verticalAlign(),
                            field.horizontalAlign(),
                            field.autoTransfer(),
                            field.boldFont()
                        );
                        cell.setCellStyle(dataCellStyle);

                        String fieldLinkColumn = field.linkColumn();
                        if (fieldLinkColumn != null && !fieldLinkColumn.isBlank() && !textValue.isBlank()) {
                            long readLinkStartedAtNanos = System.nanoTime();
                            Object linkValue = readResultSetValue(resultSet, byLowerName, fieldLinkColumn);
                            long readLinkNanos = System.nanoTime() - readLinkStartedAtNanos;
                            queryReadNanos[0] += readLinkNanos;
                            rowQueryNanos += readLinkNanos;
                            String url = normalizeText(linkValue);
                            if (url != null && !url.isBlank()) {
                                String escapedUrl = url.replace("\"", "\"\"");
                                String escapedText = textValue.replace("\"", "\"\"");
                                cell.setCellFormula("HYPERLINK(\"" + escapedUrl + "\",\"" + escapedText + "\")");
                                CellStyle alignedHyperlinkStyle = resolveHyperlinkCellStyle(
                                    workbook,
                                    cell.getCellStyle(),
                                    hyperlinkStyleCache,
                                    hyperlinkFontCache
                                );
                                cell.setCellStyle(alignedHyperlinkStyle);
                            }
                        }

                        int normalizedLength = Math.max(10, Math.min(60, textValue.length() + 2));
                        if (normalizedLength > maxLengths[index]) {
                            maxLengths[index] = normalizedLength;
                        }
                    }
                    long rowElapsedNanos = System.nanoTime() - rowStartedAtNanos;
                    templateOnlyNanos[0] += Math.max(0L, rowElapsedNanos - rowQueryNanos);
                }
                return null;
            });
            long totalLoopNanos = System.nanoTime() - queryStartedAtNanos;
            queryExecutionNanos += Math.max(0L, queryReadNanos[0] + nextRowNanos[0]);
            templateFillNanos += Math.max(0L, templateOnlyNanos[0]);
            long accountedLoopNanos = queryExecutionNanos + templateFillNanos;
            if (accountedLoopNanos < totalLoopNanos) {
                templateFillNanos += (totalLoopNanos - accountedLoopNanos);
            }

            long postProcessStartedAtNanos = System.nanoTime();
            for (int index = 0; index < maxLengths.length; index += 1) {
                int columnIndex = startColIndex + index;
                ReportFieldConfig field = visibleFields.get(index);
                if (!field.autoWidth() && field.fixedWidth() != null) {
                    sheet.setColumnWidth(columnIndex, toExcelColumnWidthUnitsFromExcelWidth(field.fixedWidth()));
                    continue;
                }
                sheet.setColumnWidth(columnIndex, Math.min(255 * 256, maxLengths[index] * 256));
            }

            int lastDataRowIndex = Math.max(startRowIndex, currentRowIndex[0] - 1);
            if (filterSet && !visibleFields.isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(
                    startRowIndex,
                    lastDataRowIndex,
                    startColIndex,
                    startColIndex + visibleFields.size() - 1
                ));
            }
            sheet.createFreezePane(startColIndex, startRowIndex + 1);
            workbook.write(out);
            templateFillNanos += (System.nanoTime() - postProcessStartedAtNanos);
            long totalExecutionNanos = System.nanoTime() - totalStartedAtNanos;
            long queryExecutionMs = toRoundedMilliseconds(queryExecutionNanos);
            long templateFillMs = toRoundedMilliseconds(templateFillNanos);
            long totalExecutionMs = toRoundedMilliseconds(totalExecutionNanos);
            return new GeneratedExcelResult(
                out.toByteArray(),
                selectedRows[0],
                totalExecutionMs,
                queryExecutionMs,
                templateFillMs,
                Math.max(0L, queryExecutionNanos),
                Math.max(0L, templateFillNanos)
            );
        } finally {
            workbook.dispose();
            workbook.close();
        }
    }

    private Map<String, String> resolveResultSetColumnsByLowerName(ResultSet resultSet) throws SQLException {
        Map<String, String> byLowerName = new HashMap<>();
        int columnCount = resultSet.getMetaData().getColumnCount();
        for (int index = 1; index <= columnCount; index += 1) {
            String label = resultSet.getMetaData().getColumnLabel(index);
            if (label == null) {
                continue;
            }
            byLowerName.putIfAbsent(label.toLowerCase(Locale.ROOT), label);
        }
        return byLowerName;
    }

    private Object readResultSetValue(ResultSet resultSet, Map<String, String> byLowerName, String rawColumnName) throws SQLException {
        String columnName = normalizeText(rawColumnName);
        if (columnName == null) {
            return null;
        }
        String resolvedColumn = byLowerName.get(columnName.toLowerCase(Locale.ROOT));
        if (resolvedColumn == null) {
            return null;
        }
        return resultSet.getObject(resolvedColumn);
    }

    private boolean isBooleanFieldType(String fieldType) {
        String normalizedType = normalizeText(fieldType);
        if (normalizedType == null) {
            return false;
        }
        String lowered = normalizedType.toLowerCase(Locale.ROOT);
        return
            "boolean".equals(lowered) ||
            "bool".equals(lowered) ||
            "булево".equals(lowered) ||
            "булево (true/false)".equals(lowered);
    }

    private String writeValueToCell(Cell cell, Object value, String fieldType) {
        if (value == null) {
            cell.setCellValue("");
            return "";
        }
        if (value instanceof Boolean boolValue) {
            String display = boolValue ? "ДА" : "НЕТ";
            cell.setCellValue(display);
            return display;
        }
        if (isBooleanFieldType(fieldType)) {
            if (value instanceof Boolean boolValue) {
                String display = boolValue ? "ДА" : "НЕТ";
                cell.setCellValue(display);
                return display;
            }
            String rawText = String.valueOf(value).trim();
            String lowered = rawText.toLowerCase(Locale.ROOT);
            if ("true".equals(lowered) || "t".equals(lowered) || "1".equals(lowered)) {
                cell.setCellValue("ДА");
                return "ДА";
            }
            if ("false".equals(lowered) || "f".equals(lowered) || "0".equals(lowered)) {
                cell.setCellValue("НЕТ");
                return "НЕТ";
            }
            cell.setCellValue(rawText);
            return rawText;
        }
        if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
            return String.valueOf(value);
        }
        if (value instanceof java.time.LocalDate localDate) {
            java.util.Date dateValue = java.sql.Date.valueOf(localDate);
            cell.setCellValue(dateValue);
            return String.valueOf(value);
        }
        if (value instanceof java.time.LocalDateTime localDateTime) {
            java.util.Date dateValue = java.sql.Timestamp.valueOf(localDateTime);
            cell.setCellValue(dateValue);
            return String.valueOf(value);
        }
        if (value instanceof java.util.Date dateValue) {
            cell.setCellValue(dateValue);
            return String.valueOf(value);
        }
        String text = String.valueOf(value);
        cell.setCellValue(text);
        return text;
    }

    private long toRoundedMilliseconds(long nanos) {
        if (nanos <= 0L) {
            return 0L;
        }
        return Math.max(0L, Math.round(nanos / 1_000_000.0));
    }

    private CellStyle resolveDataCellStyle(
        Workbook workbook,
        CellStyle baseStyle,
        Map<String, CellStyle> styleCache,
        Map<String, Font> fontCache,
        CreationHelper creationHelper,
        String fieldType,
        String fieldDataFormat,
        String fieldVerticalAlign,
        String fieldHorizontalAlign,
        boolean fieldAutoTransfer,
        boolean fieldBoldFont
    ) {
        String normalizedType = normalizeText(fieldType);
        String normalizedFormat = normalizeExcelDataFormat(fieldDataFormat);
        VerticalAlignment verticalAlignment = toVerticalAlignment(fieldVerticalAlign);
        HorizontalAlignment horizontalAlignment = toHorizontalAlignment(fieldHorizontalAlign);
        String cacheKey =
            String.valueOf(normalizedType) +
            "|" +
            String.valueOf(normalizedFormat) +
            "|" +
            verticalAlignment.name() +
            "|" +
            horizontalAlignment.name() +
            "|" +
            (fieldAutoTransfer ? "1" : "0") +
            "|" +
            (fieldBoldFont ? "1" : "0");
        CellStyle cached = styleCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(baseStyle);
        style.setVerticalAlignment(verticalAlignment);
        style.setAlignment(horizontalAlignment);
        style.setWrapText(fieldAutoTransfer);
        if (fieldBoldFont) {
            int baseFontIndex = baseStyle == null ? 0 : baseStyle.getFontIndex();
            String fontCacheKey = baseFontIndex + "|bold";
            Font boldFont = fontCache.get(fontCacheKey);
            if (boldFont == null) {
                Font baseFont = workbook.getFontAt(baseFontIndex);
                Font createdBoldFont = workbook.createFont();
                createdBoldFont.setFontName(baseFont.getFontName());
                createdBoldFont.setFontHeight(baseFont.getFontHeight());
                createdBoldFont.setItalic(baseFont.getItalic());
                createdBoldFont.setStrikeout(baseFont.getStrikeout());
                createdBoldFont.setTypeOffset(baseFont.getTypeOffset());
                createdBoldFont.setUnderline(baseFont.getUnderline());
                createdBoldFont.setCharSet(baseFont.getCharSet());
                createdBoldFont.setColor(baseFont.getColor());
                createdBoldFont.setBold(true);
                boldFont = createdBoldFont;
                fontCache.put(fontCacheKey, boldFont);
            }
            style.setFont(boldFont);
        }
        if (normalizedFormat != null && !normalizedFormat.isBlank()) {
            style.setDataFormat(creationHelper.createDataFormat().getFormat(normalizedFormat));
        } else if (normalizedType != null) {
            String fallbackFormat = switch (normalizedType.toLowerCase(Locale.ROOT)) {
                case "date" -> "dd.MM.yyyy";
                case "datetime" -> "dd.MM.yyyy HH:mm:ss";
                case "number" -> "#,##0.00";
                default -> "";
            };
            if (!fallbackFormat.isBlank()) {
                style.setDataFormat(creationHelper.createDataFormat().getFormat(fallbackFormat));
            }
        }
        styleCache.put(cacheKey, style);
        return style;
    }

    private CellStyle resolveHyperlinkCellStyle(
        Workbook workbook,
        CellStyle baseCellStyle,
        Map<Short, CellStyle> styleCache,
        Map<String, Font> fontCache
    ) {
        short baseIndex = (short) (baseCellStyle == null ? 0 : baseCellStyle.getIndex());
        CellStyle cached = styleCache.get(baseIndex);
        if (cached != null) {
            return cached;
        }
        CellStyle style = workbook.createCellStyle();
        if (baseCellStyle != null) {
            style.cloneStyleFrom(baseCellStyle);
        }
        int baseFontIndex = baseCellStyle == null ? 0 : baseCellStyle.getFontIndex();
        String fontCacheKey = baseFontIndex + "|hyperlink";
        Font hyperlinkFont = fontCache.get(fontCacheKey);
        if (hyperlinkFont == null) {
            Font baseFont = workbook.getFontAt(baseFontIndex);
            Font createdHyperlinkFont = workbook.createFont();
            createdHyperlinkFont.setFontName(baseFont.getFontName());
            createdHyperlinkFont.setFontHeight(baseFont.getFontHeight());
            createdHyperlinkFont.setItalic(baseFont.getItalic());
            createdHyperlinkFont.setStrikeout(baseFont.getStrikeout());
            createdHyperlinkFont.setTypeOffset(baseFont.getTypeOffset());
            createdHyperlinkFont.setCharSet(baseFont.getCharSet());
            createdHyperlinkFont.setBold(baseFont.getBold());
            createdHyperlinkFont.setUnderline(Font.U_SINGLE);
            createdHyperlinkFont.setColor(IndexedColors.BLUE.getIndex());
            hyperlinkFont = createdHyperlinkFont;
            fontCache.put(fontCacheKey, hyperlinkFont);
        }
        style.setFont(hyperlinkFont);
        styleCache.put(baseIndex, style);
        return style;
    }

    private VerticalAlignment toVerticalAlignment(String rawValue) {
        String normalized = normalizeText(rawValue);
        if (normalized == null) {
            return VerticalAlignment.TOP;
        }
        return switch (normalized.trim().toUpperCase(Locale.ROOT)) {
            case "НИЗ", "BOTTOM" -> VerticalAlignment.BOTTOM;
            case "СЕРЕДИНА", "CENTER", "MIDDLE" -> VerticalAlignment.CENTER;
            default -> VerticalAlignment.TOP;
        };
    }

    private HorizontalAlignment toHorizontalAlignment(String rawValue) {
        String normalized = normalizeText(rawValue);
        if (normalized == null) {
            return HorizontalAlignment.LEFT;
        }
        return switch (normalized.trim().toUpperCase(Locale.ROOT)) {
            case "СПРАВА", "RIGHT" -> HorizontalAlignment.RIGHT;
            case "ЦЕНТР", "CENTER", "CENTRE" -> HorizontalAlignment.CENTER;
            default -> HorizontalAlignment.LEFT;
        };
    }

    private String normalizeExcelDataFormat(String rawFormat) {
        String text = normalizeText(rawFormat);
        if (text == null) {
            return null;
        }
        String normalized = text
            .replace("ГГГГ", "yyyy")
            .replace("ГГ", "yy")
            .replace("ДД", "dd")
            .replace("дд", "dd")
            .replace("ММ", "MM")
            .replace("мм", "mm")
            .replace("ЧЧ", "HH")
            .replace("чч", "HH")
            .replace("СС", "ss")
            .replace("сс", "ss");
        return normalized;
    }

    private String normalizeHexColorOrDefault(Object rawValue, String fallback) {
        String value = normalizeText(rawValue);
        if (value == null) {
            return fallback;
        }
        String normalized = value.toUpperCase(Locale.ROOT);
        if (!normalized.startsWith("#")) {
            normalized = "#" + normalized;
        }
        if (!normalized.matches("^#[0-9A-F]{6}$")) {
            return fallback;
        }
        return normalized;
    }

    private void applyFontHexColorIfPossible(Font font, String hexColor) {
        if (!(font instanceof XSSFFont xssfFont)) {
            return;
        }
        XSSFColor color = toXssfColor(hexColor);
        if (color != null) {
            xssfFont.setColor(color);
        }
    }

    private void applyFillHexColorIfPossible(CellStyle style, String hexColor) {
        if (!(style instanceof XSSFCellStyle xssfStyle)) {
            return;
        }
        XSSFColor color = toXssfColor(hexColor);
        if (color != null) {
            xssfStyle.setFillForegroundColor(color);
            return;
        }
        xssfStyle.setFillForegroundColor(new XSSFColor(new Color(255, 255, 255), new DefaultIndexedColorMap()));
    }

    private XSSFColor toXssfColor(String hexColor) {
        String normalized = normalizeText(hexColor);
        if (normalized == null) {
            return null;
        }
        String value = normalized.toUpperCase(Locale.ROOT);
        if (!value.startsWith("#")) {
            value = "#" + value;
        }
        if (!value.matches("^#[0-9A-F]{6}$")) {
            return null;
        }
        int red = Integer.parseInt(value.substring(1, 3), 16);
        int green = Integer.parseInt(value.substring(3, 5), 16);
        int blue = Integer.parseInt(value.substring(5, 7), 16);
        return new XSSFColor(new Color(red, green, blue), new DefaultIndexedColorMap());
    }

    private int detectExcelPictureType(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            return Workbook.PICTURE_TYPE_PNG;
        }
        if ((bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50 && (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47) {
            return Workbook.PICTURE_TYPE_PNG;
        }
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return Workbook.PICTURE_TYPE_JPEG;
        }
        return Workbook.PICTURE_TYPE_PNG;
    }

    private int estimateColumnWidthPx(Sheet sheet, int columnIndex) {
        float pixels = sheet.getColumnWidthInPixels(Math.max(0, columnIndex));
        return Math.max(8, Math.round(pixels));
    }

    private int estimateRowHeightPx(Sheet sheet, int rowIndex) {
        Row row = sheet.getRow(Math.max(0, rowIndex));
        float heightPoints = row == null ? sheet.getDefaultRowHeightInPoints() : row.getHeightInPoints();
        int pixels = Math.round(heightPoints * 96f / 72f);
        return Math.max(1, pixels);
    }

    private ClientAnchor createPixelSizedAnchor(
        Sheet sheet,
        CreationHelper creationHelper,
        int startCol,
        int startRow,
        int widthPx,
        int heightPx
    ) {
        ClientAnchor anchor = creationHelper.createClientAnchor();
        anchor.setCol1(Math.max(0, startCol));
        anchor.setRow1(Math.max(0, startRow));
        anchor.setDx1(0);
        anchor.setDy1(0);

        int remainingWidthPx = Math.max(1, widthPx);
        int col2 = Math.max(0, startCol);
        while (remainingWidthPx > estimateColumnWidthPx(sheet, col2)) {
            remainingWidthPx -= estimateColumnWidthPx(sheet, col2);
            col2 += 1;
        }
        anchor.setCol2(col2);
        anchor.setDx2(remainingWidthPx * Units.EMU_PER_PIXEL);

        int remainingHeightPx = Math.max(1, heightPx);
        int row2 = Math.max(0, startRow);
        while (remainingHeightPx > estimateRowHeightPx(sheet, row2)) {
            remainingHeightPx -= estimateRowHeightPx(sheet, row2);
            row2 += 1;
        }
        anchor.setRow2(row2);
        anchor.setDy2(remainingHeightPx * Units.EMU_PER_PIXEL);
        return anchor;
    }

    private ClientAnchor createEmuSizedAnchor(
        Sheet sheet,
        CreationHelper creationHelper,
        int startCol,
        int startRow,
        int widthEmu,
        int heightEmu,
        int offsetXEmu,
        int offsetYEmu
    ) {
        ClientAnchor anchor = creationHelper.createClientAnchor();
        anchor.setCol1(Math.max(0, startCol));
        anchor.setRow1(Math.max(0, startRow));
        int safeOffsetX = Math.max(0, offsetXEmu);
        int safeOffsetY = Math.max(0, offsetYEmu);
        anchor.setDx1(safeOffsetX);
        anchor.setDy1(safeOffsetY);
        anchor.setCol2(Math.max(0, startCol));
        anchor.setRow2(Math.max(0, startRow));
        anchor.setDx2(safeOffsetX + Math.max(1, widthEmu));
        anchor.setDy2(safeOffsetY + Math.max(1, heightEmu));
        return anchor;
    }

    private int calculateLastOccupiedColumnForWidth(Sheet sheet, int startColumn, int widthPx) {
        int remainingWidth = Math.max(1, widthPx);
        int currentColumn = Math.max(0, startColumn);
        while (remainingWidth > 0) {
            remainingWidth -= estimateColumnWidthPx(sheet, currentColumn);
            if (remainingWidth > 0) {
                currentColumn += 1;
            }
        }
        return currentColumn;
    }

    private LinkedHashMap<String, String> collectEmployeeReportFilters(Map<String, Object> body, List<SortRule> sorts) {
        LinkedHashMap<String, String> filters = new LinkedHashMap<>();
        for (Map.Entry<String, String> filter : List.of(
            Map.entry("fullName", "full_name"),
            Map.entry("surname", "surname"),
            Map.entry("firstName", "first_name"),
            Map.entry("middleName", "middle_name"),
            Map.entry("email", "email"),
            Map.entry("personalNumber", "personal_number"),
            Map.entry("phoneNumber", "phone_number"),
            Map.entry("sapId", "sap_id"),
            Map.entry("status", "status"),
            Map.entry("organName", "organ_name"),
            Map.entry("departName", "depart_name"),
            Map.entry("positionName", "position_name")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                filters.put(
                    EMPLOYEE_FILTER_TITLES.getOrDefault(filter.getValue(), filter.getValue()),
                    value
                );
            }
        }
        filters.put("Сортировка", formatSortRules(sorts, EMPLOYEE_SORT_TITLES));
        return filters;
    }

    private void fillEmployeePositions(List<Map<String, Object>> items) {
        if (items.isEmpty()) {
            return;
        }

        List<String> employeeIds = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            if (id != null) {
                employeeIds.add(String.valueOf(id));
            }
        }
        if (employeeIds.isEmpty()) {
            for (Map<String, Object> item : items) {
                item.put("positions", List.of());
                item.put("employeeId", item.get("id"));
                item.remove("id");
            }
            return;
        }

        String placeholders = employeeIds.stream().map(id -> "?").collect(Collectors.joining(", "));
        String sql = """
            with recursive chain as (
              select
                eou.employee_id::text as employee_id,
                eou.organ_unit_id as depart_unit_id,
                ou.parent_id,
                ou.id as current_id,
                ou.sh_name as current_name
              from party.emp_pos_empl_org_unit eou
              join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
              where eou.deleted = false
                and eou.employee_id::text in (%s)
              union all
              select
                chain.employee_id,
                chain.depart_unit_id,
                p.parent_id,
                p.id as current_id,
                p.sh_name as current_name
              from chain
              join party.organ_unit p on p.id = chain.parent_id and p.deleted = false
            ),
            roots as (
              select
                employee_id,
                depart_unit_id,
                current_id as organ_unit_id,
                current_name as organ_name
              from chain
              where parent_id is null
            )
            select
              eou.employee_id::text as employee_id,
              eou.id::text as employee_organ_id,
              boss.id::text as boss_id,
              boss.full_name as boss_name,
              roots.organ_name as organ_name,
              roots.organ_unit_id::text as organ_unit_id,
              rou.sap_id as organ_sap_id,
              rou.inn as organ_inn,
              rou.kpp as organ_kpp,
              rou.ogrn as organ_ogrn,
              addr.full_address as organ_full_address,
              ou.sh_name as depart_name,
              ou.id::text as depart_unit_id,
              eou.employee_position_id::text as position_id,
              ep.name as position_name
            from party.emp_pos_empl_org_unit eou
            join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
            left join roots on roots.employee_id = eou.employee_id::text and roots.depart_unit_id = eou.organ_unit_id
            left join party.employee boss on boss.id = eou.parent_id and boss.deleted = false
            left join party.organ_unit rou on rou.id = roots.organ_unit_id and rou.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = roots.organ_unit_id
                and a.deleted = false
              order by a.id
              limit 1
            ) addr on true
            left join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
            where eou.deleted = false
              and eou.employee_id::text in (%s)
            order by eou.employee_id::text, roots.organ_name, ou.sh_name, ep.name
            """.formatted(placeholders, placeholders);

        List<Object> sqlParams = new ArrayList<>(employeeIds);
        sqlParams.addAll(employeeIds);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, sqlParams.toArray());
        Map<String, List<Map<String, Object>>> positionsByEmployee = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String employeeId = String.valueOf(row.get("employee_id"));
            List<Map<String, Object>> list = positionsByEmployee.computeIfAbsent(employeeId, key -> new ArrayList<>());
            list.add(mapOf(
                "employeeOrganId", row.get("employee_organ_id"),
                "bossId", row.get("boss_id"),
                "bossName", row.get("boss_name"),
                "organName", row.get("organ_name"),
                "organUnitId", row.get("organ_unit_id"),
                "organSapId", row.get("organ_sap_id"),
                "organInn", row.get("organ_inn"),
                "organKpp", row.get("organ_kpp"),
                "organOgrn", row.get("organ_ogrn"),
                "organFullAddress", row.get("organ_full_address"),
                "departName", row.get("depart_name"),
                "departUnitId", row.get("depart_unit_id"),
                "positionId", row.get("position_id"),
                "positionName", row.get("position_name")
            ));
        }

        for (Map<String, Object> item : items) {
            String employeeId = String.valueOf(item.get("id"));
            List<Map<String, Object>> positions = positionsByEmployee.getOrDefault(employeeId, new ArrayList<>());
            item.put("positions", positions);
            item.put("employeeId", item.get("id"));
            item.remove("id");
        }
    }

    private LinkedHashMap<String, String> collectOrganizationReportFilters(Map<String, Object> body, List<SortRule> sorts) {
        LinkedHashMap<String, String> filters = new LinkedHashMap<>();
        for (Map.Entry<String, String> filter : List.of(
            Map.entry("sapId", "sap_id"),
            Map.entry("name", "name"),
            Map.entry("shName", "sh_name"),
            Map.entry("inn", "inn"),
            Map.entry("kpp", "kpp"),
            Map.entry("ogrn", "ogrn"),
            Map.entry("okpo", "okpo"),
            Map.entry("signResident", "sign_resident")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                filters.put(
                    ORG_FILTER_TITLES.getOrDefault(filter.getValue(), filter.getValue()),
                    value
                );
            }
        }

        String countryName = normalizeText(body.containsKey("countryName") ? body.get("countryName") : body.get("country"));
        if (countryName != null) {
            filters.put(ORG_FILTER_TITLES.get("country_name"), countryName);
        }
        String address = normalizeText(body.containsKey("address") ? body.get("address") : body.get("fullAddress"));
        if (address != null) {
            filters.put(ORG_FILTER_TITLES.get("address"), address);
        }
        List<String> organUnitTypeNames = normalizeStringList(
            body.containsKey("organUnitTypeNames") ? body.get("organUnitTypeNames") : body.get("organTypeNames")
        );
        if (!organUnitTypeNames.isEmpty()) {
            filters.put(
                ORG_FILTER_TITLES.get("organ_unit_type_names"),
                String.join(", ", organUnitTypeNames)
            );
        }

        filters.put("Сортировка", formatSortRules(sorts, ORG_FILTER_TITLES));
        return filters;
    }

    private LinkedHashMap<String, String> collectRelationReportFilters(Map<String, Object> body, List<SortRule> sorts) {
        LinkedHashMap<String, String> filters = new LinkedHashMap<>();
        for (Map.Entry<String, String> filter : List.of(
            Map.entry("employeeName", "employee_name"),
            Map.entry("organName", "organ_name"),
            Map.entry("relationName", "relation_name"),
            Map.entry("salesOrganName", "sales_organ_name"),
            Map.entry("productGroupName", "product_group_name")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                filters.put(
                    RELATION_FILTER_TITLES.getOrDefault(filter.getValue(), filter.getValue()),
                    value
                );
            }
        }

        String defaultFlag = normalizeText(body.get("defaultFlag"));
        if (defaultFlag != null) {
            filters.put(RELATION_FILTER_TITLES.getOrDefault("default_flag", "default_flag"), defaultFlag);
        }

        filters.put("Сортировка", formatSortRules(sorts, RELATION_SORT_TITLES));
        return filters;
    }

    private String formatSortRules(List<SortRule> sorts, Map<String, String> titles) {
        if (sorts == null || sorts.isEmpty()) {
            return "не задана";
        }
        List<String> parts = new ArrayList<>();
        for (SortRule sort : sorts) {
            String fieldTitle = titles.getOrDefault(sort.field(), sort.field());
            String direction = "ASC".equals(sort.direction()) ? "по возрастанию" : "по убыванию";
            parts.add(fieldTitle + " (" + direction + ")");
        }
        return String.join(", ", parts);
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

    private Map<String, Object> requestDadataFindParty(Map<String, Object> payload) throws Exception {
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
            throw new IllegalStateException("DaData вернул ошибку HTTP " + response.statusCode() + ": " + response.body());
        }
        return objectMapper.readValue(
            response.body(),
            new TypeReference<Map<String, Object>>() {}
        );
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
            "address", fullAddress,
            "stateStatus", stateStatus,
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

    private Map<String, Object> parseJsonObject(Object rawJson) {
        String jsonText = normalizeText(rawJson);
        if (jsonText == null) {
            return Map.of();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                jsonText,
                new TypeReference<Map<String, Object>>() {}
            );
            return parsed == null ? Map.of() : parsed;
        } catch (Exception exception) {
            return Map.of();
        }
    }

    private String toSqlTextArrayLiteral(List<String> roleNames) {
        if (roleNames == null || roleNames.isEmpty()) {
            return "ARRAY[]::text[]";
        }
        String joined = roleNames
            .stream()
            .map(this::toSqlStringOrNull)
            .collect(Collectors.joining(", "));
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
        // Replace named params like :startReport with NULL for syntax check.
        // Negative lookbehind avoids matching PostgreSQL casts like ::date.
        // Keep replacement length close to original to preserve Position mapping.
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

    private String buildReportPeriodLine(String startReportValue, String endReportValue) {
        String start = normalizeNullable(startReportValue);
        String end = normalizeNullable(endReportValue);
        if (start == null && end == null) {
            return "Отчет за весь период";
        }
        if (start != null && end != null) {
            return "Период формирования отчета: " + start + " - " + end;
        }
        return "Период формирования отчета: " + (start != null ? start : end);
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
        // SQL copied from office tools may contain non-breaking spaces and similar unicode separators.
        // PostgreSQL parser treats them as unexpected symbols, so normalize them to a regular space.
        String normalized = value
            .replace('\u00A0', ' ')
            .replace('\u2007', ' ')
            .replace('\u202F', ' ');
        return normalized;
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

    private void applyInsertBatch(List<PendingEmployeeRow> rows, ImportStats stats, List<String> protocolLines) {
        if (rows.isEmpty()) {
            return;
        }
        try {
            jdbcTemplate.batchUpdate(
                """
                insert into party.employee (
                    sap_id,
                    full_name,
                    email,
                    personal_number,
                    first_name,
                    surname,
                    middle_name,
                    phone_number,
                    deleted,
                    created_at,
                    updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, false, now(), now())
                """,
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement statement, int index) throws java.sql.SQLException {
                        PendingEmployeeRow row = rows.get(index);
                        ValidRowData data = row.data();
                        statement.setString(1, data.sapId());
                        statement.setString(2, data.fullName());
                        statement.setString(3, row.email());
                        if (data.personalNumber() == null) {
                            statement.setNull(4, java.sql.Types.INTEGER);
                        } else {
                            statement.setInt(4, data.personalNumber());
                        }
                        statement.setString(5, data.firstName());
                        statement.setString(6, data.surname());
                        statement.setString(7, data.middleName());
                        statement.setString(8, data.phoneNumber());
                    }

                    @Override
                    public int getBatchSize() {
                        return rows.size();
                    }
                }
            );
            for (PendingEmployeeRow row : rows) {
                stats.created++;
                protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "OK", "Создана новая запись"));
            }
        } catch (Exception exception) {
            for (PendingEmployeeRow row : rows) {
                try {
                    ValidRowData data = row.data();
                    jdbcTemplate.update(
                        """
                        insert into party.employee (
                            sap_id,
                            full_name,
                            email,
                            personal_number,
                            first_name,
                            surname,
                            middle_name,
                            phone_number,
                            deleted,
                            created_at,
                            updated_at
                        ) values (?, ?, ?, ?, ?, ?, ?, ?, false, now(), now())
                        """,
                        data.sapId(),
                        data.fullName(),
                        row.email(),
                        data.personalNumber(),
                        data.firstName(),
                        data.surname(),
                        data.middleName(),
                        data.phoneNumber()
                    );
                    stats.created++;
                    protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "OK", "Создана новая запись"));
                } catch (Exception singleException) {
                    stats.errors++;
                    protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "FALSE", getErrorMessage(singleException)));
                }
            }
        }
    }

    private void applyUpdateBatch(List<PendingEmployeeRow> rows, ImportStats stats, List<String> protocolLines) {
        if (rows.isEmpty()) {
            return;
        }
        try {
            jdbcTemplate.batchUpdate(
                """
                update party.employee
                set sap_id = ?,
                    full_name = ?,
                    personal_number = ?,
                    first_name = ?,
                    surname = ?,
                    middle_name = ?,
                    phone_number = ?,
                    deleted = false,
                    updated_at = now()
                where email = ?
                """,
                new BatchPreparedStatementSetter() {
                    @Override
                    public void setValues(java.sql.PreparedStatement statement, int index) throws java.sql.SQLException {
                        PendingEmployeeRow row = rows.get(index);
                        ValidRowData data = row.data();
                        statement.setString(1, data.sapId());
                        statement.setString(2, data.fullName());
                        if (data.personalNumber() == null) {
                            statement.setNull(3, java.sql.Types.INTEGER);
                        } else {
                            statement.setInt(3, data.personalNumber());
                        }
                        statement.setString(4, data.firstName());
                        statement.setString(5, data.surname());
                        statement.setString(6, data.middleName());
                        statement.setString(7, data.phoneNumber());
                        statement.setString(8, row.email());
                    }

                    @Override
                    public int getBatchSize() {
                        return rows.size();
                    }
                }
            );
            for (PendingEmployeeRow row : rows) {
                stats.updated++;
                protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "OK", "Обновлена существующая запись"));
            }
        } catch (Exception exception) {
            for (PendingEmployeeRow row : rows) {
                try {
                    ValidRowData data = row.data();
                    jdbcTemplate.update(
                        """
                        update party.employee
                        set sap_id = ?,
                            full_name = ?,
                            personal_number = ?,
                            first_name = ?,
                            surname = ?,
                            middle_name = ?,
                            phone_number = ?,
                            deleted = false,
                            updated_at = now()
                        where email = ?
                        """,
                        data.sapId(),
                        data.fullName(),
                        data.personalNumber(),
                        data.firstName(),
                        data.surname(),
                        data.middleName(),
                        data.phoneNumber(),
                        row.email()
                    );
                    stats.updated++;
                    protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "OK", "Обновлена существующая запись"));
                } catch (Exception singleException) {
                    stats.errors++;
                    protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "FALSE", getErrorMessage(singleException)));
                }
            }
        }
    }

    private String createExportFileName(String prefix) {
        return prefix + "-" + ZonedDateTime.now(reportExcelZoneId).format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".xlsx";
    }

    private List<Map<String, Object>> parseJsonArrayOfObjects(Object rawJson) {
        String jsonText = normalizeText(rawJson);
        if (jsonText == null) {
            return List.of();
        }
        try {
            List<Map<String, Object>> parsed = objectMapper.readValue(
                jsonText,
                new TypeReference<List<Map<String, Object>>>() {}
            );
            if (parsed == null) {
                return List.of();
            }
            return parsed;
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String createReportTemplateExportFileName(String outputFileNameTemplate, String outputFileType, String reportName) {
        String baseName = resolveReportTemplateExportBaseName(outputFileNameTemplate, reportName);

        String normalizedExtension = normalizeText(outputFileType);
        if (normalizedExtension == null) {
            normalizedExtension = "xlsx";
        }
        normalizedExtension = normalizedExtension.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
        if (normalizedExtension.isBlank()) {
            normalizedExtension = "xlsx";
        }
        return baseName + "." + normalizedExtension;
    }

    private String resolveReportTemplateExportBaseName(String outputFileNameTemplate, String reportName) {
        String fallbackPattern = "{reportName}_{now:dd.MM.yyyy_HH-mm-ss}";
        String template = normalizeText(outputFileNameTemplate);
        if (template == null) {
            template = fallbackPattern;
        }
        String normalizedReportName = normalizeText(reportName);
        if (normalizedReportName == null) {
            normalizedReportName = "report";
        }
        template = template.replace("{reportName}", normalizedReportName);
        template = template.replace("{REPORT_NAME}", normalizedReportName);

        ZonedDateTime now = ZonedDateTime.now(reportExcelZoneId);
        Matcher matcher = FILE_NAME_NOW_TOKEN_PATTERN.matcher(template);
        StringBuffer replaced = new StringBuffer();
        while (matcher.find()) {
            String rawPattern = normalizeText(matcher.group(1));
            String formatPattern = rawPattern == null ? "dd.MM.yyyy_HH-mm-ss" : rawPattern;
            String formatted;
            try {
                formatted = now.format(DateTimeFormatter.ofPattern(formatPattern));
            } catch (IllegalArgumentException exception) {
                formatted = now.format(DateTimeFormatter.ofPattern("dd.MM.yyyy_HH-mm-ss"));
            }
            matcher.appendReplacement(replaced, Matcher.quoteReplacement(formatted));
        }
        matcher.appendTail(replaced);
        String baseName = replaced.toString().replaceAll("\\.[^.]+$", "").trim();
        baseName = baseName.replaceAll("[\\\\/:*?\"<>|]+", " ").replaceAll("\\s+", " ").trim();
        if (baseName.isBlank()) {
            return "report";
        }
        return baseName;
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String fileName) {
        return excelResponse(data, fileName, Map.of());
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String fileName, Map<String, String> extraHeaders) {
        String encoded = UriUtils.encode(fileName, StandardCharsets.UTF_8);
        String disposition = "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encoded;
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition);
        if (extraHeaders != null) {
            for (Map.Entry<String, String> header : extraHeaders.entrySet()) {
                builder.header(header.getKey(), String.valueOf(header.getValue()));
            }
        }
        return builder
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(data);
    }

    private List<Map<String, String>> toSortMaps(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOf("field", sort.field(), "direction", sort.direction()));
        }
        return out;
    }

    private List<Map<String, String>> toSortMapsCamel(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOf("field", snakeToCamel(sort.field()), "direction", sort.direction()));
        }
        return out;
    }

    private List<String> readHeader(Row row, DataFormatter formatter) {
        if (row == null) {
            return List.of();
        }
        int lastCell = Math.max(row.getLastCellNum(), (short) 0);
        List<String> result = new ArrayList<>();
        for (int i = 0; i < lastCell; i += 1) {
            result.add(formatter.formatCellValue(row.getCell(i)).trim());
        }
        return result;
    }

    private boolean hasValidHeader(List<String> header) {
        if (header.size() != REQUIRED_COLUMNS_ORDER.size()) {
            return false;
        }
        Set<String> unique = new HashSet<>(header);
        if (unique.size() != header.size()) {
            return false;
        }
        return unique.containsAll(REQUIRED_COLUMNS);
    }

    private Map<String, String> readRowData(Row row, DataFormatter formatter, Map<String, Integer> headerIndex) {
        Map<String, String> rowData = new HashMap<>();
        for (String key : REQUIRED_COLUMNS_ORDER) {
            int index = headerIndex.getOrDefault(key, -1);
            String value = "";
            if (index >= 0 && row != null) {
                value = formatter.formatCellValue(row.getCell(index));
            }
            rowData.put(key, value);
        }
        return rowData;
    }

    private boolean isRowEmpty(Map<String, String> rowData) {
        for (String value : rowData.values()) {
            if (StringUtils.hasText(value)) {
                return false;
            }
        }
        return true;
    }

    private ValidationResult validateRow(Map<String, String> row) {
        String sapId = normalizeNullable(row.get("sap_id"));
        String surname = normalizeNullable(row.get("surname"));
        String firstName = normalizeNullable(row.get("first_name"));
        String middleName = normalizeNullable(row.get("middle_name"));
        String email = normalizeNullable(row.get("email"));
        String phoneNumber = normalizeNullable(row.get("phone_number"));
        String personalRaw = normalizeNullable(row.get("personal_number"));

        if (email == null || !isValidEmail(email)) {
            return ValidationResult.error("Некорректный email");
        }
        if (tooLong(surname, 250)) {
            return ValidationResult.error("Длина surname превышает 250 символов");
        }
        if (tooLong(firstName, 250)) {
            return ValidationResult.error("Длина first_name превышает 250 символов");
        }
        if (tooLong(middleName, 250)) {
            return ValidationResult.error("Длина middle_name превышает 250 символов");
        }
        if (tooLong(phoneNumber, 30)) {
            return ValidationResult.error("Длина phone_number превышает 30 символов");
        }
        if (tooLong(sapId, 255)) {
            return ValidationResult.error("Длина sap_id превышает 255 символов");
        }

        Integer personalNumber = null;
        if (personalRaw != null) {
            if (!personalRaw.matches("^\\d+$")) {
                return ValidationResult.error("personal_number должен содержать только цифры");
            }
            long value = Long.parseLong(personalRaw);
            if (value > 2_147_483_647L) {
                return ValidationResult.error("personal_number выходит за допустимый диапазон");
            }
            personalNumber = (int) value;
        }

        String fullNameRaw = String.join(" ", Arrays.asList(
            surname == null ? "" : surname,
            firstName == null ? "" : firstName,
            middleName == null ? "" : middleName
        )).trim();
        String fullName = fullNameRaw.isEmpty() ? null : fullNameRaw;
        if (tooLong(fullName, 250)) {
            return ValidationResult.error("Длина full_name превышает 250 символов");
        }

        return ValidationResult.ok(new ValidRowData(
            sapId, surname, firstName, middleName, email, personalNumber, phoneNumber, fullName
        ));
    }

    private boolean tooLong(String text, int maxLength) {
        return text != null && text.length() > maxLength;
    }

    private boolean isValidEmail(String email) {
        if (email.length() > 250) {
            return false;
        }
        return email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private String normalizeNullable(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        if (text.matches("(?i)^null\\.?$")) {
            return null;
        }
        return text;
    }

    private String firstDefined(String primary, String fallback) {
        if (primary != null) {
            return primary;
        }
        return fallback;
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

    private String camelToSnake(String value) {
        if (value == null || value.isEmpty()) {
            return "";
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

    private String snakeToCamel(String value) {
        if (value == null || value.isEmpty() || !value.contains("_")) {
            return value == null ? "" : value;
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

    private String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private List<String> splitSearchTokens(Object value) {
        String text = normalizeText(value);
        if (text == null) {
            return List.of();
        }
        return Arrays.stream(text.split("\\s+"))
            .map(String::trim)
            .filter(token -> !token.isEmpty())
            .toList();
    }

    private String formatLogLine(int rowNumber, Object email, String result, String reason) {
        String rowLabel = String.format("%04d", rowNumber);
        String normalizedEmail = email == null ? "-" : String.valueOf(email);
        String normalizedReason = reason == null ? "" : reason.replaceAll("\\s+", " ").trim();
        String line = "[row=" + rowLabel + "] [email=" + normalizedEmail + "] [result=" + result + "]";
        return normalizedReason.isEmpty() ? line : line + " [reason=" + normalizedReason + "]";
    }

    private List<OrganizationReferenceCheck> loadOrganizationReferenceChecks() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            """
            select
              c.table_schema,
              c.table_name,
              c.column_name,
              exists (
                select 1
                from information_schema.columns dc
                where dc.table_schema = c.table_schema
                  and dc.table_name = c.table_name
                  and dc.column_name = 'deleted'
              ) as has_deleted
            from information_schema.columns c
            where c.table_schema not in ('information_schema', 'pg_catalog')
              and c.column_name in (
                'client_id',
                'sales_organization_id',
                'claim_organization_id',
                'cliam_organization_id',
                'claim_organization_orig_id',
                'organ_unit_id'
              )
              and not (
                c.table_schema = 'party'
                and c.table_name in ('address', 'organ_unit_organ_unit_types', 'organ_unit_email')
              )
            order by c.table_schema, c.table_name, c.column_name
            """
        );
        List<OrganizationReferenceCheck> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String schema = normalizeText(row.get("table_schema"));
            String table = normalizeText(row.get("table_name"));
            String column = normalizeText(row.get("column_name"));
            if (schema == null || table == null || column == null) {
                continue;
            }
            if (
                !schema.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")
                    || !table.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")
                    || !column.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")
            ) {
                continue;
            }
            boolean hasDeleted = toBooleanOrDefault(row.get("has_deleted"), false);
            out.add(new OrganizationReferenceCheck(schema, table, column, hasDeleted));
        }
        return out;
    }

    private String buildOrganizationReferenceCheckSql(OrganizationReferenceCheck reference) {
        String schemaSql = quoteIdentifier(reference.schema());
        String tableSql = quoteIdentifier(reference.table());
        String columnSql = quoteIdentifier(reference.column());
        String deletedCondition = reference.hasDeleted()
            ? " and (t.deleted = false or t.deleted is null)"
            : "";
        return "select count(*)::int from "
            + schemaSql
            + "."
            + tableSql
            + " t where t."
            + columnSql
            + " = ?::uuid"
            + deletedCondition;
    }

    private String quoteIdentifier(String value) {
        if (value == null || !value.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
            throw new IllegalArgumentException("Недопустимое имя идентификатора SQL");
        }
        return "\"" + value + "\"";
    }

    private String getErrorMessage(Exception exception) {
        return exception.getMessage() == null ? "Неизвестная ошибка" : exception.getMessage();
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("ok", false, "error", message));
    }

    private ResponseEntity<Map<String, Object>> serverError(Exception exception, String fallbackMessage) {
        String message = exception.getMessage() == null ? fallbackMessage : exception.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("ok", false, "error", message));
    }

    private static <K, V> LinkedHashMap<K, V> mapOf(Object... values) {
        LinkedHashMap<K, V> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            @SuppressWarnings("unchecked")
            K key = (K) values[i];
            @SuppressWarnings("unchecked")
            V value = (V) values[i + 1];
            result.put(key, value);
        }
        return result;
    }

    private record ParseResult(Integer value, String error) {
    }

    private record SortRule(String field, String direction) {
    }

    private record SortParseResult(List<SortRule> sorts, String error) {
    }

    private record ColumnMeta(String title, String sql) {
    }

    private record ExportColumn(String key, String title, String sql) {
    }

    private record ColumnsParseResult(List<ExportColumn> columns, String error) {
    }

    private record ReportFieldConfig(
        String name,
        String caption,
        String type,
        String dataFormat,
        String linkColumn,
        String verticalAlign,
        String horizontalAlign,
        boolean autoWidth,
        Integer fixedWidth,
        boolean autoTransfer,
        boolean boldFont,
        int orderNumber,
        int sourceIndex
    ) {
    }

    private record GeneratedExcelResult(
        byte[] data,
        long selectedRows,
        long totalExecutionMs,
        long queryExecutionMs,
        long templateFillMs,
        long queryExecutionNs,
        long templateFillNs
    ) {
    }

    private static class ImportStats {
        int totalRead = 0;
        int created = 0;
        int updated = 0;
        int errors = 0;
        int deleted = 0;
    }

    private record ValidRowData(
        String sapId,
        String surname,
        String firstName,
        String middleName,
        String email,
        Integer personalNumber,
        String phoneNumber,
        String fullName
    ) {
    }

    private record ValidationResult(boolean valid, String reason, ValidRowData data) {
        static ValidationResult ok(ValidRowData data) {
            return new ValidationResult(true, null, data);
        }

        static ValidationResult error(String reason) {
            return new ValidationResult(false, reason, null);
        }
    }

    private record PendingEmployeeRow(int rowNumber, String email, ValidRowData data) {
    }

    private record OrganizationReferenceCheck(
        String schema,
        String table,
        String column,
        boolean hasDeleted
    ) {
        String fullTableName() {
            return schema + "." + table;
        }
    }
}
