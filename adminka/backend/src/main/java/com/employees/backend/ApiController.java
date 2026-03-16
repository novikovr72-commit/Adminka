package com.employees.backend;

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
import org.apache.poi.ss.usermodel.Hyperlink;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Picture;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.common.usermodel.HyperlinkType;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.util.Units;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class ApiController {

    private static final Set<String> ALLOWED_STATUS = Set.of("ACTIVE", "INACTIVE");
    private static final Pattern NAMED_SQL_PARAM_PATTERN = Pattern.compile("(?<!:):[a-zA-Z_][a-zA-Z0-9_]*");
    private static final Pattern SQL_ERROR_POSITION_PATTERN = Pattern.compile("Position:\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FILE_NAME_NOW_TOKEN_PATTERN = Pattern.compile("\\{now(?::([^{}]+))?\\}", Pattern.CASE_INSENSITIVE);
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
    private static final Set<String> ORG_SORT_FIELDS = Set.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "country_name", "address", "sign_resident"
    );
    private static final Set<String> ORG_TEXT_SORT_FIELDS = Set.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "country_name", "address"
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
    private static final Map<String, ColumnMeta> ORG_EXPORT_COLUMNS = Map.of(
        "sap_id", new ColumnMeta("sap_id", "ou.sap_id"),
        "name", new ColumnMeta("Наименование", "ou.name"),
        "sh_name", new ColumnMeta("Краткое наименование", "ou.sh_name"),
        "inn", new ColumnMeta("ИНН", "ou.inn"),
        "kpp", new ColumnMeta("КПП", "ou.kpp"),
        "ogrn", new ColumnMeta("ОГРН", "ou.ogrn"),
        "okpo", new ColumnMeta("ОКПО", "ou.okpo"),
        "sign_resident", new ColumnMeta("Резидент", "case when ou.sign_resident = true then 'ДА' else 'НЕТ' end"),
        "country_name", new ColumnMeta("Страна", "c.name"),
        "address", new ColumnMeta("Адрес", "addr.full_address")
    );
    private static final List<String> ORG_EXPORT_DEFAULT_ORDER = List.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "sign_resident", "country_name", "address"
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
    private static final Map<String, String> ORG_SORT_SQL = Map.of(
        "sap_id", "ou.sap_id",
        "name", "ou.name",
        "sh_name", "ou.sh_name",
        "inn", "ou.inn",
        "kpp", "ou.kpp",
        "ogrn", "ou.ogrn",
        "okpo", "ou.okpo",
        "country_name", "c.name",
        "address", "addr.full_address",
        "sign_resident", "ou.sign_resident"
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
    private static final Set<String> REPORT_TEMPLATE_SORT_FIELDS = Set.of(
        "code_report", "name", "output_file_name", "output_file_type", "version", "status", "method"
    );
    private static final Set<String> REPORT_TEMPLATE_TEXT_SORT_FIELDS = Set.of(
        "code_report", "name", "output_file_name", "output_file_type", "version", "status", "method"
    );
    private static final Map<String, String> REPORT_TEMPLATE_SORT_SQL = Map.of(
        "code_report", "rt.code_report",
        "name", "rt.name",
        "output_file_name", "rt.output_file_name",
        "output_file_type", "rt.output_file_type",
        "version", "rt.version",
        "status", "rt.status",
        "method", "rt.method"
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
    private static final Map<String, String> ORG_FILTER_TITLES = Map.of(
        "sap_id", "sap_id",
        "name", "Наименование",
        "sh_name", "Краткое наименование",
        "inn", "ИНН",
        "kpp", "КПП",
        "ogrn", "ОГРН",
        "okpo", "ОКПО",
        "country_name", "Страна",
        "address", "Адрес",
        "sign_resident", "Резидент"
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
    private final ObjectMapper objectMapper;
    private final Path logsDir;
    private final String frontendBaseUrl;

    public ApiController(
        JdbcTemplate jdbcTemplate,
        ObjectMapper objectMapper,
        @Value("${app.logs-dir:backend/logs}") String logsDir,
        @Value("${app.frontend-base-url:http://localhost:5175}") String frontendBaseUrl
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.logsDir = Path.of(logsDir).toAbsolutePath().normalize();
        this.frontendBaseUrl = StringUtils.trimTrailingCharacter(
            StringUtils.trimWhitespace(frontendBaseUrl == null ? "" : frontendBaseUrl),
            '/'
        );
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return mapOf("ok", true, "message", "Backend employees запущен");
    }

    @GetMapping("/db-health")
    public ResponseEntity<Map<String, Object>> dbHealth() {
        try {
            String dbName = jdbcTemplate.queryForObject("select current_database()", String.class);
            return ResponseEntity.ok(mapOf("ok", true, "database", dbName));
        } catch (Exception exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", exception.getMessage() == null ? "DB connection error" : exception.getMessage()));
        }
    }

    @GetMapping("/list_organizations")
    public ResponseEntity<Map<String, Object>> listOrganizations(
        @RequestParam(name = "show_short_code", required = false) String showShortCodeSnakeRaw,
        @RequestParam(name = "showShortCode", required = false) String showShortCodeCamelRaw,
        @RequestParam(name = "organ_name", required = false) String organNameSnakeRaw,
        @RequestParam(name = "organName", required = false) String organNameCamelRaw
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

    @GetMapping("/list_relations")
    public ResponseEntity<Map<String, Object>> listRelations(
        @RequestParam(name = "relation_name", required = false) String relationNameSnakeRaw,
        @RequestParam(name = "relationName", required = false) String relationNameCamelRaw
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

    @GetMapping("/list_product_groups")
    public ResponseEntity<Map<String, Object>> listProductGroups(
        @RequestParam(name = "product_group_name", required = false) String productGroupNameSnakeRaw,
        @RequestParam(name = "productGroupName", required = false) String productGroupNameCamelRaw
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

    @GetMapping("/list_positions")
    public ResponseEntity<Map<String, Object>> listPositions(
        @RequestParam(name = "position_name", required = false) String positionNameSnakeRaw,
        @RequestParam(name = "positionName", required = false) String positionNameCamelRaw
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

    @GetMapping("/list_employees")
    public ResponseEntity<Map<String, Object>> listEmployees(
        @RequestParam(name = "departUnitId", required = false) String departUnitId,
        @RequestParam(name = "employeeId", required = false) String employeeId,
        @RequestParam(name = "employeeName", required = false) String employeeName
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

    @GetMapping("/employees")
    public ResponseEntity<Map<String, Object>> employeesGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/employees с JSON body"));
    }

    @PostMapping("/employees")
    public ResponseEntity<Map<String, Object>> employeesPost(@RequestBody(required = false) Map<String, Object> rawBody) {
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

    @PostMapping("/employees/export")
    public ResponseEntity<?> employeesExport(@RequestBody(required = false) Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts", "columns"));
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
        String orderBy = buildEmployeeOrderBy(sorts);
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

    @PostMapping("/employees/import")
    public ResponseEntity<Map<String, Object>> employeesImport(
        @RequestPart("file") MultipartFile file,
        @RequestParam(name = "delete_missing", required = false) String deleteMissingSnakeRaw,
        @RequestParam(name = "deleteMissing", required = false) String deleteMissingCamelRaw,
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

    @GetMapping("/organizations")
    public ResponseEntity<Map<String, Object>> organizationsGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/organizations с JSON body"));
    }

    @PostMapping("/organizations")
    public ResponseEntity<Map<String, Object>> organizationsPost(@RequestBody(required = false) Map<String, Object> rawBody) {
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

        String orgWhereSql = "where " + String.join(" and ", orgWhere);
        String extraWhereSql = extraWhere.isEmpty() ? "" : "and " + String.join(" and ", extraWhere);
        String orderBySql = buildOrganizationOrderBy(sorts);

        int limit = limitParsed.value();
        int offset = offsetParsed.value();
        int sqlOffset = (offset - 1) * limit;

        boolean isFastPath = !hasCountryName && !hasAddress && sorts.stream()
            .noneMatch(rule -> "country_name".equals(rule.field()) || "address".equals(rule.field()));

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
              p.sap_id,
              p.name,
              p.sh_name,
              p.inn,
              p.kpp,
              p.ogrn,
              p.okpo,
              case when p.sign_resident = true then 'ДА' else 'НЕТ' end as sign_resident,
              c.name as country_name,
              addr.full_address as address
            from paged p
            left join nsi.country c on c.id = p.country_id and c.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = p.id and a.deleted = false
              order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
              limit 1
            ) as addr on true
            order by p.order_idx
            """.formatted(orgWhereSql, orderBySql)
            : """
            select
              ou.sap_id,
              ou.name,
              ou.sh_name,
              ou.inn,
              ou.kpp,
              ou.ogrn,
              ou.okpo,
              case when ou.sign_resident = true then 'ДА' else 'НЕТ' end as sign_resident,
              c.name as country_name,
              addr.full_address as address
            from party.organ_unit ou
            left join nsi.country c on c.id = ou.country_id and c.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id and a.deleted = false
              order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
              limit 1
            ) as addr on true
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
            List<Map<String, Object>> items = jdbcTemplate.queryForList(dataSql, pagedParams.toArray());
            Integer totalCount = jdbcTemplate.queryForObject(countSql, Integer.class, params.toArray());
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

    @PostMapping("/organizations/export")
    public ResponseEntity<?> organizationsExport(@RequestBody(required = false) Map<String, Object> rawBody) {
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

    @GetMapping("/report-templates")
    public ResponseEntity<Map<String, Object>> reportTemplatesGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/report-templates с JSON body"));
    }

    @PostMapping("/report-template")
    public ResponseEntity<Map<String, Object>> createReportTemplate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String codeReport = normalizeText(body.get("codeReport"));
        String name = normalizeText(body.get("name"));
        String outputFileName = normalizeText(body.get("outputFileName"));
        String outputFileType = normalizeText(body.get("outputFileType"));
        String version = normalizeText(body.get("version"));
        String status = normalizeText(body.get("status"));
        String method = normalizeText(body.get("method"));

        if (codeReport == null) {
            return badRequest("Параметр codeReport обязателен");
        }
        if (name == null) {
            return badRequest("Параметр name обязателен");
        }
        if (outputFileName == null) {
            return badRequest("Параметр outputFileName обязателен");
        }

        String normalizedOutputFileType = outputFileType == null ? "XLSX" : outputFileType.toUpperCase(Locale.ROOT);
        if (!"XLSX".equals(normalizedOutputFileType)) {
            return badRequest("Параметр outputFileType должен быть XLSX");
        }

        String normalizedMethod = method == null ? "AUTO" : method.toUpperCase(Locale.ROOT);
        if (!Set.of("AUTO", "HAND").contains(normalizedMethod)) {
            return badRequest("Параметр method должен быть AUTO или HAND");
        }

        String normalizedStatus = status == null ? "ACTIVE" : status.toUpperCase(Locale.ROOT);
        if (!Set.of("ACTIVE", "INACTIVE").contains(normalizedStatus)) {
            return badRequest("Параметр status должен быть ACTIVE или INACTIVE");
        }

        Integer numberDays = null;
        if (body.containsKey("numberDays")) {
            String normalizedNumberDaysText = normalizeText(body.get("numberDays"));
            if (normalizedNumberDaysText != null) {
                if (!normalizedNumberDaysText.matches("^\\d+$")) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
                try {
                    numberDays = Integer.valueOf(normalizedNumberDaysText);
                } catch (Exception exception) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
            }
        }

        String reportTemplateId = UUID.randomUUID().toString();
        try {
            jdbcTemplate.update(
                """
                insert into public.report_templates(
                  id, code_report, name, output_file_name, output_file_type,
                  version, status, method, number_days, sql_query, report_info, deleted
                )
                values (?::uuid, ?, ?, ?, ?, ?, ?, ?, ?, '', null, false)
                """,
                reportTemplateId,
                codeReport,
                name,
                outputFileName,
                normalizedOutputFileType,
                version,
                normalizedStatus,
                normalizedMethod,
                numberDays
            );
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "reportTemplateId", reportTemplateId,
                    "codeReport", codeReport,
                    "name", name,
                    "outputFileName", outputFileName,
                    "outputFileType", normalizedOutputFileType,
                    "version", version,
                    "status", normalizedStatus,
                    "method", normalizedMethod,
                    "numberDays", numberDays,
                    "sqlQuery", "",
                    "reportInfo", null,
                    "organizations", List.of(),
                    "accessGroups", List.of()
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка создания отчета");
        }
    }

    @PostMapping("/report-templates/create")
    public ResponseEntity<Map<String, Object>> createReportTemplateAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return createReportTemplate(rawBody);
    }

    @PostMapping("/report-templates")
    public ResponseEntity<Map<String, Object>> reportTemplatesPost(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
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

        SortParseResult sortsResult = parseSorts(body, REPORT_TEMPLATE_SORT_FIELDS, "code_report");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("code_report", "ASC"))
            : sortsResult.sorts();

        int limit = limitParsed.value();
        int offset = offsetParsed.value();
        int sqlOffset = (offset - 1) * limit;

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("rt.deleted = false");

        String codeReport = normalizeText(body.get("codeReport"));
        if (codeReport != null) {
            for (String token : splitSearchTokens(codeReport)) {
                where.add("rt.code_report ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String name = normalizeText(body.get("name"));
        if (name != null) {
            for (String token : splitSearchTokens(name)) {
                where.add("rt.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String outputFileName = normalizeText(body.get("outputFileName"));
        if (outputFileName != null) {
            for (String token : splitSearchTokens(outputFileName)) {
                where.add("rt.output_file_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String outputFileType = normalizeText(body.get("outputFileType"));
        if (outputFileType != null) {
            for (String token : splitSearchTokens(outputFileType)) {
                where.add("rt.output_file_type ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String version = normalizeText(body.get("version"));
        if (version != null) {
            for (String token : splitSearchTokens(version)) {
                where.add("rt.version::text ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String status = normalizeText(body.get("status"));
        if (status != null) {
            for (String token : splitSearchTokens(status)) {
                where.add("rt.status ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String method = normalizeText(body.get("method"));
        if (method != null) {
            for (String token : splitSearchTokens(method)) {
                where.add("rt.method ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildReportTemplateOrderBy(sorts);

        String dataSql = """
            select
              rt.id::text as report_template_id,
              rt.code_report as code_report,
              rt.name as name,
              rt.output_file_name as output_file_name,
              rt.output_file_type as output_file_type,
              rt.version as version,
              rt.status as status,
              rt.method as method,
              rt.number_days as number_days,
              rt.sql_query as sql_query,
              rt.report_info as report_info,
              coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'organUnitId', organization_item.organ_unit_id,
                    'organUnitName', organization_item.organ_unit_name
                  )
                  order by organization_item.organ_unit_name, organization_item.organ_unit_id
                )
                from (
                  select distinct
                    rto.claim_organization_id::text as organ_unit_id,
                    coalesce(ou.sh_name, '') as organ_unit_name
                  from public.report_template_organizations rto
                  left join party.organ_unit ou
                    on ou.id = rto.claim_organization_id
                  where rto.report_template_id = rt.id
                ) organization_item
              ), '[]'::jsonb)::text as organizations,
              coalesce((
                select jsonb_agg(
                  jsonb_build_object('codeAccess', access_item.code_access)
                  order by access_item.code_access
                )
                from (
                  select distinct
                    rag.code_access as code_access
                  from public.report_access_group rag
                  where rag.report_template_id = rt.id
                    and rag.code_access is not null
                ) access_item
              ), '[]'::jsonb)::text as access_groups
            from public.report_templates rt
            %s
            order by %s
            limit ?
            offset ?
            """.formatted(whereSql, orderBy);
        String countSql = """
            select count(*)::int
            from public.report_templates rt
            %s
            """.formatted(whereSql);

        try {
            List<Object> pagedParams = new ArrayList<>(params);
            pagedParams.add(limit);
            pagedParams.add(sqlOffset);
            List<Map<String, Object>> rawItems = jdbcTemplate.queryForList(dataSql, pagedParams.toArray());
            List<Map<String, Object>> items = new ArrayList<>(rawItems.size());
            for (Map<String, Object> item : rawItems) {
                LinkedHashMap<String, Object> mapped = new LinkedHashMap<>();
                mapped.put("reportTemplateId", item.get("report_template_id"));
                mapped.put("codeReport", item.get("code_report"));
                mapped.put("name", item.get("name"));
                mapped.put("outputFileName", item.get("output_file_name"));
                mapped.put("outputFileType", item.get("output_file_type"));
                mapped.put("version", item.get("version"));
                mapped.put("status", item.get("status"));
                mapped.put("method", item.get("method"));
                mapped.put("numberDays", item.get("number_days"));
                mapped.put("sqlQuery", item.get("sql_query"));
                mapped.put("reportInfo", item.get("report_info"));
                mapped.put("organizations", parseJsonArrayOfObjects(item.get("organizations")));
                mapped.put("accessGroups", parseJsonArrayOfObjects(item.get("access_groups")));
                items.add(mapped);
            }
            Integer totalCount = jdbcTemplate.queryForObject(countSql, Integer.class, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", totalCount == null ? 0 : totalCount,
                "limit", limit,
                "offset", offset,
                "sorts", toSortMapsCamel(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    @PatchMapping("/report-template/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> updateReportTemplateMainSettings(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String codeReport = normalizeText(body.get("codeReport"));
        String name = normalizeText(body.get("name"));
        String outputFileName = normalizeText(body.get("outputFileName"));
        String outputFileType = normalizeText(body.get("outputFileType"));
        String version = normalizeText(body.get("version"));
        String status = normalizeText(body.get("status"));
        String method = normalizeText(body.get("method"));
        Integer numberDays = null;
        if (body.containsKey("numberDays")) {
            Object numberDaysRaw = body.get("numberDays");
            String normalizedNumberDaysText = normalizeText(numberDaysRaw);
            if (normalizedNumberDaysText != null) {
                if (!normalizedNumberDaysText.matches("^\\d+$")) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
                try {
                    numberDays = Integer.valueOf(normalizedNumberDaysText);
                } catch (Exception exception) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
            }
        }
        try {
            int updated = jdbcTemplate.update(
                """
                update public.report_templates
                set code_report = ?,
                    name = ?,
                    output_file_name = ?,
                    output_file_type = ?,
                    version = ?,
                    status = ?,
                    method = ?,
                    number_days = ?
                where id = ?::uuid
                  and deleted = false
                """,
                codeReport,
                name,
                outputFileName,
                outputFileType,
                version,
                status,
                method,
                numberDays,
                normalizedReportTemplateId
            );
            if (updated == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "reportTemplateId", normalizedReportTemplateId,
                    "codeReport", codeReport,
                    "name", name,
                    "outputFileName", outputFileName,
                    "outputFileType", outputFileType,
                    "version", version,
                    "status", status,
                    "method", method,
                    "numberDays", numberDays
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка сохранения основных настроек отчета");
        }
    }

    @PatchMapping("/report-templates/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> updateReportTemplateMainSettingsAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return updateReportTemplateMainSettings(reportTemplateId, rawBody);
    }

    @DeleteMapping("/report-template/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplate(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        try {
            Integer templateExists = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                Integer.class,
                normalizedReportTemplateId
            );
            if ((templateExists == null ? 0 : templateExists) == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            int deletedAccessGroups = jdbcTemplate.update(
                """
                delete from public.report_access_group
                where report_template_id = ?::uuid
                """,
                normalizedReportTemplateId
            );
            int deletedOrganizations = jdbcTemplate.update(
                """
                delete from public.report_template_organizations
                where report_template_id = ?::uuid
                """,
                normalizedReportTemplateId
            );
            int deletedTemplates = jdbcTemplate.update(
                """
                delete from public.report_templates
                where id = ?::uuid
                  and deleted = false
                """,
                normalizedReportTemplateId
            );
            if (deletedTemplates == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deletedReportTemplateId", normalizedReportTemplateId,
                "deletedAccessGroups", deletedAccessGroups,
                "deletedOrganizations", deletedOrganizations,
                "deletedTemplates", deletedTemplates
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка удаления отчета");
        }
    }

    @DeleteMapping("/report-templates/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateAlias(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        return deleteReportTemplate(reportTemplateId);
    }

    @PostMapping("/report-template/sql/validate")
    public ResponseEntity<Map<String, Object>> validateReportTemplateSql(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
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
        if (!reportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Integer numberDays = getReportTemplateNumberDays(reportTemplateId);
        if (numberDays == null) {
            return badRequest("Шаблон отчета не найден");
        }
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
        String method = getReportTemplateMethod(reportTemplateId);
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
            jdbcTemplate.queryForList("explain " + sqlForExplain);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "SQL-скрипт корректен"
            ));
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, sqlQuery, "Ошибка проверки SQL-скрипта");
        }
    }

    @PostMapping("/report-templates/sql/validate")
    public ResponseEntity<Map<String, Object>> validateReportTemplatesSqlAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return validateReportTemplateSql(rawBody);
    }

    @DeleteMapping("/report-template/{reportTemplateId}/organizations/{organUnitId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateOrganization(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @PathVariable("organUnitId") String organUnitId
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        String normalizedOrganUnitId = normalizeText(organUnitId);
        if (normalizedOrganUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!normalizedOrganUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        try {
            int deletedCount = jdbcTemplate.update(
                """
                delete from public.report_template_organizations
                where report_template_id = ?::uuid
                  and claim_organization_id = ?::uuid
                """,
                normalizedReportTemplateId,
                normalizedOrganUnitId
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь отчета с организацией не найдена"
                ));
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deletedCount", deletedCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }

    @DeleteMapping("/report-templates/{reportTemplateId}/organizations/{organUnitId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateOrganizationAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @PathVariable("organUnitId") String organUnitId
    ) {
        return deleteReportTemplateOrganization(reportTemplateId, organUnitId);
    }

    @DeleteMapping("/report-template/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateAccessGroup(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestParam("codeAccess") String codeAccess
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        String normalizedCodeAccess = normalizeText(codeAccess);
        if (normalizedCodeAccess == null) {
            return badRequest("Параметр codeAccess обязателен");
        }
        try {
            int deletedCount = jdbcTemplate.update(
                """
                delete from public.report_access_group
                where report_template_id = ?::uuid
                  and code_access = ?
                """,
                normalizedReportTemplateId,
                normalizedCodeAccess
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Группа доступа отчета не найдена"
                ));
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deletedCount", deletedCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }

    @DeleteMapping("/report-templates/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateAccessGroupAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestParam("codeAccess") String codeAccess
    ) {
        return deleteReportTemplateAccessGroup(reportTemplateId, codeAccess);
    }

    @PostMapping("/report-template/{reportTemplateId}/organizations")
    public ResponseEntity<Map<String, Object>> addReportTemplateOrganization(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        try {
            Integer templateExists = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                Integer.class,
                normalizedReportTemplateId
            );
            if ((templateExists == null ? 0 : templateExists) == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            List<Map<String, Object>> organizations = jdbcTemplate.queryForList(
                """
                select
                  ou.id::text as organ_unit_id,
                  coalesce(ou.sh_name, '') as organ_unit_name
                from party.organ_unit ou
                where ou.id = ?::uuid
                  and ou.deleted = false
                limit 1
                """,
                organUnitId
            );
            if (organizations.isEmpty()) {
                return badRequest("Организация не найдена");
            }
            Map<String, Object> organization = organizations.get(0);
            int insertedCount = jdbcTemplate.update(
                """
                insert into public.report_template_organizations(report_template_id, claim_organization_id)
                select ?::uuid, ?::uuid
                where not exists (
                  select 1
                  from public.report_template_organizations rto
                  where rto.report_template_id = ?::uuid
                    and rto.claim_organization_id = ?::uuid
                )
                """,
                normalizedReportTemplateId,
                organUnitId,
                normalizedReportTemplateId,
                organUnitId
            );
            if (insertedCount == 0) {
                return badRequest("Связь Отчет-Организация уже существует");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "organUnitId", organization.get("organ_unit_id"),
                    "organUnitName", organization.get("organ_unit_name")
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка добавления");
        }
    }

    @PostMapping("/report-templates/{reportTemplateId}/organizations")
    public ResponseEntity<Map<String, Object>> addReportTemplateOrganizationAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return addReportTemplateOrganization(reportTemplateId, rawBody);
    }

    @PostMapping("/report-template/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> addReportTemplateAccessGroup(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String codeAccess = normalizeText(body.get("codeAccess"));
        if (codeAccess == null) {
            return badRequest("Параметр codeAccess обязателен");
        }
        if (!codeAccess.matches("^GRP(0[1-9]|10)$")) {
            return badRequest("Параметр codeAccess должен быть в диапазоне GRP01-GRP10");
        }
        try {
            Integer templateExists = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                Integer.class,
                normalizedReportTemplateId
            );
            if ((templateExists == null ? 0 : templateExists) == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            int insertedCount = jdbcTemplate.update(
                """
                insert into public.report_access_group(report_template_id, code_access)
                select ?::uuid, ?
                where not exists (
                  select 1
                  from public.report_access_group rag
                  where rag.report_template_id = ?::uuid
                    and rag.code_access = ?
                )
                """,
                normalizedReportTemplateId,
                codeAccess,
                normalizedReportTemplateId,
                codeAccess
            );
            if (insertedCount == 0) {
                return badRequest("Связь Отчет-Группа доступа уже существует");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "codeAccess", codeAccess
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка добавления");
        }
    }

    @PostMapping("/report-templates/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> addReportTemplateAccessGroupAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return addReportTemplateAccessGroup(reportTemplateId, rawBody);
    }

    @PostMapping("/report-template/sql/execute-check")
    public ResponseEntity<Map<String, Object>> executeCheckReportTemplateSql(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
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
        if (!reportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Integer numberDays = getReportTemplateNumberDays(reportTemplateId);
        if (numberDays == null) {
            return badRequest("Шаблон отчета не найден");
        }
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
        String method = getReportTemplateMethod(reportTemplateId);
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
            Long selectedRows = jdbcTemplate.queryForObject(countSql, Long.class);
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

    @PostMapping("/report-templates/sql/execute-check")
    public ResponseEntity<Map<String, Object>> executeCheckReportTemplatesSqlAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return executeCheckReportTemplateSql(rawBody);
    }

    @PostMapping("/report-template/sql/results")
    public ResponseEntity<Map<String, Object>> reportTemplateSqlResults(
        @RequestBody(required = false) Map<String, Object> rawBody
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
        ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
        if (offsetParsed.error() != null) {
            return badRequest(offsetParsed.error());
        }

        int limit = Math.min(limitParsed.value() == null ? 500 : limitParsed.value(), 500);
        int page = offsetParsed.value() == null ? 1 : offsetParsed.value();
        int sqlOffset = (page - 1) * limit;

        String savedSqlQuery = "";
        try {
            List<Map<String, Object>> templates = jdbcTemplate.queryForList(
                """
                select
                  rt.sql_query as sql_query,
                  coalesce(rt.number_days, 0)::int as number_days,
                  upper(coalesce(rt.method, 'AUTO')) as method
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                reportTemplateId
            );
            if (templates.isEmpty()) {
                return badRequest("Шаблон отчета не найден");
            }
            Map<String, Object> template = templates.get(0);
            savedSqlQuery = template.get("sql_query") == null ? null : String.valueOf(template.get("sql_query"));
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
            Long totalRows = jdbcTemplate.queryForObject(countSql, Long.class);
            List<String> columns = new ArrayList<>();
            List<Map<String, Object>> rows = jdbcTemplate.query(
                pagedSql,
                (resultSet) -> {
                    List<Map<String, Object>> extractedRows = new ArrayList<>();
                    int columnCount = resultSet.getMetaData().getColumnCount();
                    if (columns.isEmpty()) {
                        for (int index = 1; index <= columnCount; index += 1) {
                            columns.add(resultSet.getMetaData().getColumnLabel(index));
                        }
                    }
                    while (resultSet.next()) {
                        LinkedHashMap<String, Object> mappedRow = new LinkedHashMap<>();
                        for (int index = 1; index <= columnCount; index += 1) {
                            String columnName = columns.get(index - 1);
                            mappedRow.put(columnName, resultSet.getObject(index));
                        }
                        extractedRows.add(mappedRow);
                    }
                    return extractedRows;
                },
                limit,
                sqlOffset
            );
            long elapsedMs = (System.nanoTime() - startedAtNanos) / 1_000_000L;
            long total = totalRows == null ? 0L : totalRows;
            boolean hasMore = sqlOffset + rows.size() < total;

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "columns", columns,
                "rows", rows,
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

    @PostMapping("/report-templates/sql/results")
    public ResponseEntity<Map<String, Object>> reportTemplatesSqlResultsAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlResults(rawBody);
    }

    @PostMapping("/report-template/execute")
    public ResponseEntity<?> executeReportTemplate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        boolean preview = toBooleanOrDefault(body.get("preview"), false);
        if (preview && !body.containsKey("limit")) {
            LinkedHashMap<String, Object> previewBody = new LinkedHashMap<>(body);
            previewBody.put("limit", 50);
            return reportTemplateExcelPreview(previewBody);
        }
        return preview ? reportTemplateExcelPreview(body) : reportTemplateExcelExport(body);
    }

    @PostMapping("/report-templates/execute")
    public ResponseEntity<?> executeReportTemplateAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return executeReportTemplate(rawBody);
    }

    @PostMapping("/report-template/excel-preview")
    public ResponseEntity<?> reportTemplateExcelPreview(
        @RequestBody(required = false) Map<String, Object> rawBody
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
            List<Map<String, Object>> templates = jdbcTemplate.queryForList(
                """
                select
                  rt.sql_query as sql_query,
                  coalesce(rt.number_days, 0)::int as number_days,
                  upper(coalesce(rt.method, 'AUTO')) as method,
                  coalesce(nullif(trim(rt.output_file_name), ''), 'report-preview') as output_file_name,
                  coalesce(nullif(trim(rt.name), ''), 'Отчет') as report_name,
                  rt.report_info::text as report_info,
                  rt.report_logo as report_logo
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                reportTemplateId
            );
            if (templates.isEmpty()) {
                return badRequest("Шаблон отчета не найден");
            }
            Map<String, Object> template = templates.get(0);
            savedSqlQuery = template.get("sql_query") == null ? null : String.valueOf(template.get("sql_query"));
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

            Long totalRows = jdbcTemplate.queryForObject(countSql, Long.class);
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
                endReportValue
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

    @PostMapping("/report-templates/excel-preview")
    public ResponseEntity<?> reportTemplatesExcelPreviewAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExcelPreview(rawBody);
    }

    @PostMapping("/report-template/excel")
    public ResponseEntity<?> reportTemplateExcelExport(
        @RequestBody(required = false) Map<String, Object> rawBody
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
            List<Map<String, Object>> templates = jdbcTemplate.queryForList(
                """
                select
                  rt.sql_query as sql_query,
                  coalesce(rt.number_days, 0)::int as number_days,
                  upper(coalesce(rt.method, 'AUTO')) as method,
                  coalesce(nullif(trim(rt.output_file_name), ''), 'report') as output_file_name,
                  coalesce(nullif(trim(rt.output_file_type), ''), 'xlsx') as output_file_type,
                  coalesce(nullif(trim(rt.name), ''), 'Отчет') as report_name,
                  rt.report_info::text as report_info,
                  rt.report_logo as report_logo
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                reportTemplateId
            );
            if (templates.isEmpty()) {
                return badRequest("Шаблон отчета не найден");
            }
            Map<String, Object> template = templates.get(0);
            savedSqlQuery = template.get("sql_query") == null ? null : String.valueOf(template.get("sql_query"));
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
                endReportValue
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

    @PostMapping("/report-templates/excel")
    public ResponseEntity<?> reportTemplatesExcelExportAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExcelExport(rawBody);
    }

    @PatchMapping("/report-template/{reportTemplateId}/sql")
    public ResponseEntity<Map<String, Object>> updateReportTemplateSql(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        String sqlQuery = normalizeText(body.get("sqlQuery"));
        String validationError = validateReportTemplateSqlText(sqlQuery);
        if (validationError != null) {
            return badRequest(validationError);
        }
        Integer numberDays = getReportTemplateNumberDays(normalizedReportTemplateId);
        if (numberDays == null) {
            return badRequest("Шаблон отчета не найден");
        }
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
        String method = getReportTemplateMethod(normalizedReportTemplateId);
        if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
            return badRequest("Для отчетов с method=HAND параметр roleNames обязателен");
        }
        String sqlForExplain = toReportTemplateCheckSql(
            sqlQuery,
            normalizedReportTemplateId,
            numberDays,
            null,
            null,
            claimOrganizationId,
            reportId,
            roleNames
        );

        try {
            jdbcTemplate.queryForList("explain " + sqlForExplain);
            int updated = jdbcTemplate.update(
                """
                update public.report_templates
                set sql_query = ?
                where id = ?::uuid
                  and deleted = false
                """,
                sqlQuery,
                normalizedReportTemplateId
            );
            if (updated == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "SQL-скрипт сохранен",
                "item", mapOf(
                    "reportTemplateId", normalizedReportTemplateId,
                    "sqlQuery", sqlQuery
                )
            ));
        } catch (Exception exception) {
            return sqlValidationErrorResponse(exception, sqlQuery, "Ошибка сохранения SQL-скрипта");
        }
    }

    @PatchMapping("/report-templates/{reportTemplateId}/sql")
    public ResponseEntity<Map<String, Object>> updateReportTemplatesSqlAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return updateReportTemplateSql(reportTemplateId, rawBody);
    }

    @GetMapping("/report-template/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> reportTemplateSettingsGet(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        try {
            List<Map<String, Object>> templates = jdbcTemplate.queryForList(
                """
                select
                  rt.id::text as report_template_id,
                  rt.name as name,
                  rt.report_info::text as report_info,
                  jsonb_pretty(rt.report_info) as report_info_pretty,
                  encode(rt.report_logo, 'base64') as report_logo_base64,
                  case
                    when rt.report_logo is null then null
                    when substring(rt.report_logo from 1 for 8) = decode('89504E470D0A1A0A', 'hex') then 'image/png'
                    when substring(rt.report_logo from 1 for 3) = decode('FFD8FF', 'hex') then 'image/jpeg'
                    when substring(rt.report_logo from 1 for 6) = decode('474946383761', 'hex')
                      or substring(rt.report_logo from 1 for 6) = decode('474946383961', 'hex')
                      then 'image/gif'
                    when substring(rt.report_logo from 9 for 4) = decode('57454250', 'hex') then 'image/webp'
                    else 'application/octet-stream'
                  end as report_logo_mime_type
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                normalizedReportTemplateId
            );
            if (templates.isEmpty()) {
                return badRequest("Шаблон отчета не найден");
            }
            Map<String, Object> template = templates.get(0);
            String reportInfoText = normalizeText(template.get("report_info"));
            Object reportInfo = null;
            if (reportInfoText != null) {
                reportInfo = objectMapper.readValue(reportInfoText, new TypeReference<Map<String, Object>>() {});
            }
            String reportInfoJson = normalizeText(template.get("report_info_pretty"));
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "reportTemplateId", template.get("report_template_id"),
                    "name", template.get("name"),
                    "reportInfo", reportInfo,
                    "reportInfoJson", reportInfoJson,
                    "reportLogoBase64", template.get("report_logo_base64"),
                    "reportLogoMimeType", template.get("report_logo_mime_type")
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка получения настроек шаблона отчета");
        }
    }

    @GetMapping("/report-templates/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> reportTemplatesSettingsGetAlias(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        return reportTemplateSettingsGet(reportTemplateId);
    }

    @PatchMapping("/report-template/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> updateReportTemplateSettings(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!normalizedReportTemplateId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        Object reportInfoRaw = body.get("reportInfo");
        if (!(reportInfoRaw instanceof Map<?, ?> reportInfoMap)) {
            return badRequest("Параметр reportInfo обязателен и должен быть объектом");
        }
        Map<String, Object> sanitizedReportInfo = sanitizeReportInfoBeforeSave(reportInfoMap);
        String reportInfoJson;
        try {
            reportInfoJson = objectMapper.writeValueAsString(sanitizedReportInfo);
        } catch (Exception exception) {
            return badRequest("Параметр reportInfo должен быть корректным JSON-объектом");
        }

        String reportLogoBase64 = normalizeText(body.get("reportLogoBase64"));
        boolean clearReportLogo = Boolean.TRUE.equals(body.get("clearReportLogo"))
            || "true".equalsIgnoreCase(String.valueOf(body.get("clearReportLogo")));
        boolean shouldUpdateLogo = clearReportLogo || body.containsKey("reportLogoBase64");
        byte[] reportLogoBytes = null;
        if (!clearReportLogo && reportLogoBase64 != null) {
            try {
                reportLogoBytes = decodeBase64Lenient(reportLogoBase64);
            } catch (IllegalArgumentException exception) {
                return badRequest("Параметр reportLogoBase64 должен быть корректной base64-строкой");
            }
        }

        try {
            int updated;
            if (shouldUpdateLogo) {
                updated = jdbcTemplate.update(
                    """
                    update public.report_templates
                    set report_info = ?::jsonb,
                        report_logo = ?
                    where id = ?::uuid
                      and deleted = false
                    """,
                    reportInfoJson,
                    reportLogoBytes,
                    normalizedReportTemplateId
                );
            } else {
                updated = jdbcTemplate.update(
                    """
                    update public.report_templates
                    set report_info = ?::jsonb
                    where id = ?::uuid
                      and deleted = false
                    """,
                    reportInfoJson,
                    normalizedReportTemplateId
                );
            }
            if (updated == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "Настройки шаблона отчета сохранены",
                "item", mapOf(
                    "reportTemplateId", normalizedReportTemplateId,
                    "reportInfo", sanitizedReportInfo,
                    "reportInfoJson", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(sanitizedReportInfo),
                    "reportLogoBase64", shouldUpdateLogo ? reportLogoBase64 : null
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка сохранения настроек шаблона отчета");
        }
    }

    private Map<String, Object> sanitizeReportInfoBeforeSave(Map<?, ?> reportInfoMap) {
        LinkedHashMap<String, Object> sanitized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : reportInfoMap.entrySet()) {
            String key = String.valueOf(entry.getKey());
            if ("fields".equals(key) && entry.getValue() instanceof Collection<?> fieldsCollection) {
                List<Map<String, Object>> filteredFields = new ArrayList<>();
                for (Object fieldRaw : fieldsCollection) {
                    if (!(fieldRaw instanceof Map<?, ?> fieldMap)) {
                        continue;
                    }
                    boolean reportVisible = toBooleanOrDefault(fieldMap.get("reportVisible"), true);
                    Integer normalizedOrderNumber = normalizePositiveOrderNumber(
                        fieldMap.containsKey("fieldOrderNumber")
                            ? fieldMap.get("fieldOrderNumber")
                            : fieldMap.get("fielOrderNumber")
                    );
                    if (reportVisible && normalizedOrderNumber == null) {
                        continue;
                    }
                    LinkedHashMap<String, Object> normalizedField = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> fieldEntry : fieldMap.entrySet()) {
                        normalizedField.put(String.valueOf(fieldEntry.getKey()), fieldEntry.getValue());
                    }
                    normalizedField.remove("fielOrderNumber");
                    normalizedField.put("reportVisible", reportVisible);
                    normalizedField.put("fieldOrderNumber", reportVisible ? normalizedOrderNumber : "");
                    filteredFields.add(normalizedField);
                }
                sanitized.put(key, filteredFields);
                continue;
            }
            sanitized.put(key, entry.getValue());
        }
        return sanitized;
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

    private byte[] decodeBase64Lenient(String base64Value) {
        String normalized = normalizeText(base64Value);
        if (normalized == null) {
            throw new IllegalArgumentException("empty base64");
        }
        String compact = normalized.replaceAll("\\s+", "");
        if (compact.isEmpty()) {
            throw new IllegalArgumentException("empty base64");
        }
        try {
            return Base64.getDecoder().decode(compact);
        } catch (IllegalArgumentException exception) {
            return Base64.getUrlDecoder().decode(compact);
        }
    }

    @PatchMapping("/report-templates/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> updateReportTemplatesSettingsAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return updateReportTemplateSettings(reportTemplateId, rawBody);
    }

    @PostMapping("/relation/{employeeId}")
    public ResponseEntity<Map<String, Object>> relationsPost(
        @PathVariable("employeeId") String employeeId,
        @RequestBody(required = false) Map<String, Object> rawBody
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

    @PostMapping("/relations")
    public ResponseEntity<Map<String, Object>> relationsPostAll(
        @RequestBody(required = false) Map<String, Object> rawBody
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

    @PostMapping("/relations/export")
    public ResponseEntity<?> relationsExport(@RequestBody(required = false) Map<String, Object> rawBody) {
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

    @PostMapping("/relation")
    public ResponseEntity<Map<String, Object>> relationCreate(@RequestBody(required = false) Map<String, Object> rawBody) {
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

    @PatchMapping("/relation/{relationId}")
    public ResponseEntity<Map<String, Object>> relationUpdate(
        @PathVariable("relationId") String relationId,
        @RequestBody(required = false) Map<String, Object> rawBody
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

    @DeleteMapping("/relation/{relationId}")
    public ResponseEntity<Map<String, Object>> relationDelete(@PathVariable("relationId") String relationId) {
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

    @PatchMapping("/employee/{employeeId}")
    public ResponseEntity<Map<String, Object>> employeeUpdate(
        @PathVariable("employeeId") String employeeIdRaw,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String employeeId = normalizeText(employeeIdRaw);
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (!employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        String surname = normalizeText(body.get("surname"));
        String firstName = normalizeText(body.get("firstName"));
        String middleName = normalizeText(body.get("middleName"));
        String email = normalizeText(body.get("email"));
        String phoneNumber = normalizeText(body.get("phoneNumber"));
        String sapId = normalizeText(body.get("sapId"));
        String personalNumberRaw = normalizeText(body.get("personalNumber"));
        String status = normalizeText(body.get("status"));

        if (email == null) {
            return badRequest("Параметр email обязателен");
        }
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return badRequest("Параметр email должен соответствовать шаблону email");
        }
        if (status == null) {
            return badRequest("Параметр status обязателен");
        }
        status = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUS.contains(status)) {
            return badRequest("Параметр status должен быть ACTIVE или INACTIVE");
        }

        try {
            Integer duplicateEmailCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.employee e
                where e.deleted = false
                  and lower(e.email) = lower(?)
                  and e.id <> ?::uuid
                """,
                Integer.class,
                email,
                employeeId
            );
            if (duplicateEmailCount != null && duplicateEmailCount > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                    "ok", false,
                    "error", "Указанный адрес электронной почты уже используется другим сотрудником"
                ));
            }
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка проверки email");
        }

        if (sapId != null) {
            if (!sapId.matches("^\\d{1,10}$")) {
                return badRequest("Параметр sapId должен содержать только цифры (до 10 символов)");
            }
        }
        if (phoneNumber != null) {
            if (!phoneNumber.matches("^[0-9()+-]+$")) {
                return badRequest("Параметр phoneNumber может содержать только цифры и символы + - ( )");
            }
        }

        Integer personalNumber = null;
        if (personalNumberRaw != null) {
            if (!personalNumberRaw.matches("^\\d{1,10}$")) {
                return badRequest("Параметр personalNumber должен содержать только цифры (до 10 символов)");
            }
            long parsed = Long.parseLong(personalNumberRaw);
            if (parsed > Integer.MAX_VALUE) {
                return badRequest("Параметр personalNumber превышает допустимое значение");
            }
            personalNumber = (int) parsed;
        }

        String fullName = String.join(
            " ",
            Arrays.asList(surname, firstName, middleName).stream()
                .filter(value -> value != null && !value.isBlank())
                .toList()
        );
        if (fullName.isBlank()) {
            fullName = "";
        }

        try {
            int updatedCount = jdbcTemplate.update(
                """
                update party.employee
                set
                  surname = ?,
                  first_name = ?,
                  middle_name = ?,
                  full_name = coalesce(?, ''),
                  email = ?,
                  phone_number = ?,
                  sap_id = ?,
                  personal_number = ?,
                  status = ?,
                  updated_at = now()
                where id = ?::uuid
                  and deleted = false
                """,
                surname,
                firstName,
                middleName,
                fullName,
                email,
                phoneNumber,
                sapId,
                personalNumber,
                status,
                employeeId
            );
            if (updatedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Сотрудник не найден или удален"
                ));
            }

            Map<String, Object> item = jdbcTemplate.queryForMap(
                """
                select
                  e.id::text as id,
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
                where e.id = ?::uuid
                  and e.deleted = false
                limit 1
                """,
                employeeId
            );

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка обновления");
        }
    }

    @PostMapping("/employee")
    public ResponseEntity<Map<String, Object>> employeeCreate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String surname = normalizeText(body.get("surname"));
        String firstName = normalizeText(body.get("firstName"));
        String middleName = normalizeText(body.get("middleName"));
        String email = normalizeText(body.get("email"));
        String phoneNumber = normalizeText(body.get("phoneNumber"));
        String sapId = normalizeText(body.get("sapId"));
        String personalNumberRaw = normalizeText(body.get("personalNumber"));
        String status = normalizeText(body.get("status"));

        if (email == null) {
            return badRequest("Параметр email обязателен");
        }
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return badRequest("Параметр email должен соответствовать шаблону email");
        }
        if (status == null) {
            return badRequest("Параметр status обязателен");
        }
        status = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUS.contains(status)) {
            return badRequest("Параметр status должен быть ACTIVE или INACTIVE");
        }
        if (sapId != null && !sapId.matches("^\\d{1,10}$")) {
            return badRequest("Параметр sapId должен содержать только цифры (до 10 символов)");
        }
        if (phoneNumber != null && !phoneNumber.matches("^[0-9()+-]+$")) {
            return badRequest("Параметр phoneNumber может содержать только цифры и символы + - ( )");
        }

        Integer personalNumber = null;
        if (personalNumberRaw != null) {
            if (!personalNumberRaw.matches("^\\d{1,10}$")) {
                return badRequest("Параметр personalNumber должен содержать только цифры (до 10 символов)");
            }
            long parsed = Long.parseLong(personalNumberRaw);
            if (parsed > Integer.MAX_VALUE) {
                return badRequest("Параметр personalNumber превышает допустимое значение");
            }
            personalNumber = (int) parsed;
        }

        String fullName = String.join(
            " ",
            Arrays.asList(surname, firstName, middleName).stream()
                .filter(value -> value != null && !value.isBlank())
                .toList()
        );
        if (fullName.isBlank()) {
            fullName = "";
        }

        try {
            Integer duplicateEmailCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.employee e
                where e.deleted = false
                  and lower(e.email) = lower(?)
                """,
                Integer.class,
                email
            );
            if (duplicateEmailCount != null && duplicateEmailCount > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                    "ok", false,
                    "error", "Указанный адрес электронной почты уже используется другим сотрудником"
                ));
            }

            String employeeId = jdbcTemplate.queryForObject(
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
                  status,
                  deleted
                )
                values (?, coalesce(?, ''), ?, ?, ?, ?, ?, ?, ?, false)
                returning id::text
                """,
                String.class,
                sapId,
                fullName,
                email,
                personalNumber,
                firstName,
                surname,
                middleName,
                phoneNumber,
                status
            );

            Map<String, Object> item = jdbcTemplate.queryForMap(
                """
                select
                  e.id::text as id,
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
                where e.id = ?::uuid
                  and e.deleted = false
                limit 1
                """,
                employeeId
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка создания");
        }
    }

    @DeleteMapping("/employee/{employeeId}")
    public ResponseEntity<Map<String, Object>> employeeDelete(
        @PathVariable("employeeId") String employeeIdRaw
    ) {
        String employeeId = normalizeText(employeeIdRaw);
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (!employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }

        try {
            Integer existingEmployeeCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.employee e
                where e.id = ?::uuid
                  and e.deleted = false
                """,
                Integer.class,
                employeeId
            );
            if (existingEmployeeCount == null || existingEmployeeCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Сотрудник не найден или уже удален"
                ));
            }

            Integer usedAsBossCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.emp_pos_empl_org_unit eou
                join party.employee e on e.id = eou.employee_id
                where eou.deleted = false
                  and e.deleted = false
                  and eou.parent_id = ?::uuid
                """,
                Integer.class,
                employeeId
            );
            if (usedAsBossCount != null && usedAsBossCount > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                    "ok", false,
                    "error", "Вы пытаетесь удалить сотрудника, который является руководителем для других сотрудников"
                ));
            }

            int deletedRelationsCount = jdbcTemplate.update(
                """
                delete from party.relation
                where employee_id = ?::uuid
                """,
                employeeId
            );

            int deletedSubordinationCount = jdbcTemplate.update(
                """
                delete from party.emp_pos_empl_org_unit
                where employee_id = ?::uuid
                   or parent_id = ?::uuid
                """,
                employeeId,
                employeeId
            );

            int deletedCount = jdbcTemplate.update(
                """
                update party.employee
                set
                  deleted = true,
                  updated_at = now()
                where id = ?::uuid
                  and deleted = false
                """,
                employeeId
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Сотрудник не найден или уже удален"
                ));
            }

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deleted_count", deletedCount,
                "relationDeletedCount", deletedRelationsCount,
                "subordinationDeletedCount", deletedSubordinationCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }

    @DeleteMapping("/employee-position/{employeeOrganId}")
    public ResponseEntity<Map<String, Object>> employeePositionDelete(
        @PathVariable("employeeOrganId") String employeeOrganId
    ) {
        String normalizedEmployeeOrganId = normalizeText(employeeOrganId);
        if (normalizedEmployeeOrganId == null) {
            return badRequest("Параметр employeeOrganId обязателен");
        }
        if (!normalizedEmployeeOrganId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeOrganId должен быть UUID");
        }

        try {
            int deletedCount = jdbcTemplate.update(
                """
                delete from party.emp_pos_empl_org_unit
                where id = ?::uuid
                """,
                normalizedEmployeeOrganId
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь подчинения не найдена"
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

    @PostMapping("/employee-position")
    public ResponseEntity<Map<String, Object>> employeePositionCreate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String employeeId = normalizeText(body.get("employeeId"));
        String organUnitId = normalizeText(body.get("organUnitId"));
        String employeePositionId = normalizeText(body.get("employeePositionId"));
        String bossEmployeeId = normalizeText(body.get("bossEmployeeId"));

        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (employeePositionId != null
            && !employeePositionId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeePositionId должен быть UUID");
        }
        if (bossEmployeeId != null
            && !bossEmployeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр bossEmployeeId должен быть UUID");
        }
        if (bossEmployeeId != null && bossEmployeeId.equalsIgnoreCase(employeeId)) {
            return badRequest("Сотрудник не может быть руководителем сам себе");
        }

        try {
            String parentEmployeeOrganId = bossEmployeeId;

            Integer duplicateCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.emp_pos_empl_org_unit eou
                where eou.deleted = false
                  and eou.employee_id = ?::uuid
                  and eou.organ_unit_id = ?::uuid
                """,
                Integer.class,
                employeeId,
                organUnitId
            );
            if (duplicateCount != null && duplicateCount > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                    "ok", false,
                    "error", "Связь подчинения с указанными параметрами уже существует"
                ));
            }

            String employeeOrganId = jdbcTemplate.queryForObject(
                """
                insert into party.emp_pos_empl_org_unit (
                  employee_id,
                  organ_unit_id,
                  employee_position_id,
                  parent_id
                )
                values (?::uuid, ?::uuid, ?::uuid, ?::uuid)
                returning id::text
                """,
                String.class,
                employeeId,
                organUnitId,
                employeePositionId,
                parentEmployeeOrganId
            );

            Map<String, Object> item = jdbcTemplate.queryForMap(
                """
                with recursive chain as (
                  select
                    ou.id,
                    ou.parent_id,
                    coalesce(ou.sh_name, ou.name) as sh_name
                  from party.emp_pos_empl_org_unit eou
                  join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                  where eou.id = ?::uuid
                    and eou.deleted = false
                  union all
                  select
                    p.id,
                    p.parent_id,
                    coalesce(p.sh_name, p.name) as sh_name
                  from chain
                  join party.organ_unit p on p.id = chain.parent_id and p.deleted = false
                ),
                root as (
                  select id, sh_name
                  from chain
                  where parent_id is null
                  limit 1
                )
                select
                  eou.id::text as "employeeOrganId",
                  root.sh_name as organ_name,
                  root.id::text as organ_unit_id,
                  root_ou.sap_id as organ_sap_id,
                  root_ou.inn as organ_inn,
                  root_ou.kpp as organ_kpp,
                  root_ou.ogrn as organ_ogrn,
                  addr.full_address as organ_full_address,
                  coalesce(ou.sh_name, ou.name) as depart_name,
                  ou.id::text as depart_unit_id,
                  eou.employee_position_id::text as position_id,
                  ep.name as position_name,
                  boss.id::text as boss_id,
                  boss.full_name as boss_name
                from party.emp_pos_empl_org_unit eou
                join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                left join root on true
                left join party.organ_unit root_ou on root_ou.id = root.id and root_ou.deleted = false
                left join lateral (
                  select a.full_address
                  from party.address a
                  where a.organ_unit_id = root.id
                    and a.deleted = false
                  order by a.id
                  limit 1
                ) addr on true
                left join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
                left join party.employee boss on boss.id = eou.parent_id and boss.deleted = false
                where eou.id = ?::uuid
                  and eou.deleted = false
                limit 1
                """,
                employeeOrganId,
                employeeOrganId
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    @PatchMapping("/employee-position/{employeeOrganId}")
    public ResponseEntity<Map<String, Object>> employeePositionUpdate(
        @PathVariable("employeeOrganId") String employeeOrganIdRaw,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        String employeeOrganId = normalizeText(employeeOrganIdRaw);
        if (employeeOrganId == null) {
            return badRequest("Параметр employeeOrganId обязателен");
        }
        if (!employeeOrganId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeOrganId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        String employeeId = normalizeText(body.get("employeeId"));
        String organUnitId = normalizeText(body.get("organUnitId"));
        String employeePositionId = normalizeText(body.get("employeePositionId"));
        String bossEmployeeId = normalizeText(body.get("bossEmployeeId"));

        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!employeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!organUnitId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (employeePositionId != null
            && !employeePositionId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр employeePositionId должен быть UUID");
        }
        if (bossEmployeeId != null
            && !bossEmployeeId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")) {
            return badRequest("Параметр bossEmployeeId должен быть UUID");
        }
        if (bossEmployeeId != null && bossEmployeeId.equalsIgnoreCase(employeeId)) {
            return badRequest("Сотрудник не может быть руководителем сам себе");
        }

        try {
            String parentEmployeeOrganId = bossEmployeeId;

            Integer duplicateCount = jdbcTemplate.queryForObject(
                """
                select count(*)::int
                from party.emp_pos_empl_org_unit eou
                where eou.deleted = false
                  and eou.employee_id = ?::uuid
                  and eou.organ_unit_id = ?::uuid
                  and eou.id <> ?::uuid
                """,
                Integer.class,
                employeeId,
                organUnitId,
                employeeOrganId
            );
            if (duplicateCount != null && duplicateCount > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                    "ok", false,
                    "error", "Связь подчинения с указанными параметрами уже существует"
                ));
            }

            int updatedCount = jdbcTemplate.update(
                """
                update party.emp_pos_empl_org_unit
                set
                  employee_id = ?::uuid,
                  organ_unit_id = ?::uuid,
                  employee_position_id = ?::uuid,
                  parent_id = ?::uuid,
                  updated_at = now()
                where id = ?::uuid
                  and deleted = false
                """,
                employeeId,
                organUnitId,
                employeePositionId,
                parentEmployeeOrganId,
                employeeOrganId
            );
            if (updatedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь подчинения не найдена"
                ));
            }

            Map<String, Object> item = jdbcTemplate.queryForMap(
                """
                with recursive chain as (
                  select
                    ou.id,
                    ou.parent_id,
                    coalesce(ou.sh_name, ou.name) as sh_name
                  from party.emp_pos_empl_org_unit eou
                  join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                  where eou.id = ?::uuid
                    and eou.deleted = false
                  union all
                  select
                    p.id,
                    p.parent_id,
                    coalesce(p.sh_name, p.name) as sh_name
                  from chain
                  join party.organ_unit p on p.id = chain.parent_id and p.deleted = false
                ),
                root as (
                  select id, sh_name
                  from chain
                  where parent_id is null
                  limit 1
                )
                select
                  eou.id::text as "employeeOrganId",
                  root.sh_name as organ_name,
                  root.id::text as organ_unit_id,
                  root_ou.sap_id as organ_sap_id,
                  root_ou.inn as organ_inn,
                  root_ou.kpp as organ_kpp,
                  root_ou.ogrn as organ_ogrn,
                  addr.full_address as organ_full_address,
                  coalesce(ou.sh_name, ou.name) as depart_name,
                  ou.id::text as depart_unit_id,
                  eou.employee_position_id::text as position_id,
                  ep.name as position_name,
                  boss.id::text as boss_id,
                  boss.full_name as boss_name
                from party.emp_pos_empl_org_unit eou
                join party.organ_unit ou on ou.id = eou.organ_unit_id and ou.deleted = false
                left join root on true
                left join party.organ_unit root_ou on root_ou.id = root.id and root_ou.deleted = false
                left join lateral (
                  select a.full_address
                  from party.address a
                  where a.organ_unit_id = root.id
                    and a.deleted = false
                  order by a.id
                  limit 1
                ) addr on true
                left join party.employee_position ep on ep.id = eou.employee_position_id and ep.deleted = false
                left join party.employee boss on boss.id = eou.parent_id and boss.deleted = false
                where eou.id = ?::uuid
                  and eou.deleted = false
                limit 1
                """,
                employeeOrganId,
                employeeOrganId
            );

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
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

    private String buildReportTemplateOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = REPORT_TEMPLATE_SORT_SQL.get(sort.field());
            String sortExpr =
                REPORT_TEMPLATE_TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
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
        String endReportValue
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
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss"));

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
            jdbcTemplate.query(sql, (resultSet) -> {
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

                        String textValue = writeValueToCell(cell, value);
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
                                Hyperlink hyperlink = creationHelper.createHyperlink(HyperlinkType.URL);
                                hyperlink.setAddress(url);
                                cell.setHyperlink(hyperlink);
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

    private String writeValueToCell(Cell cell, Object value) {
        if (value == null) {
            cell.setCellValue("");
            return "";
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
            return "Параметр sqlQuery обязателен";
        }
        String normalizedSql = normalizeSingleSqlStatement(sqlQuery);
        if (normalizedSql.isEmpty()) {
            return "Параметр sqlQuery обязателен";
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

    private Integer getReportTemplateNumberDays(String reportTemplateId) {
        try {
            return jdbcTemplate.queryForObject(
                """
                select coalesce(rt.number_days, 0)::int
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                Integer.class,
                reportTemplateId
            );
        } catch (Exception exception) {
            return null;
        }
    }

    private String getReportTemplateMethod(String reportTemplateId) {
        try {
            return jdbcTemplate.queryForObject(
                """
                select upper(coalesce(rt.method, 'AUTO'))
                from public.report_templates rt
                where rt.id = ?::uuid
                  and rt.deleted = false
                """,
                String.class,
                reportTemplateId
            );
        } catch (Exception exception) {
            return null;
        }
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
            .collect(Collectors.joining(", "));
        return "ARRAY[" + joined + "]::text[]";
    }

    private String toReportTemplateCheckSql(String sqlQuery, String reportTemplateId, Integer numberDays) {
        return toReportTemplateCheckSql(sqlQuery, reportTemplateId, numberDays, null, null, null, reportTemplateId, List.of());
    }

    private String toReportTemplateCheckSql(
        String sqlQuery,
        String reportTemplateId,
        Integer numberDays,
        String startReportValue,
        String endReportValue
    ) {
        return toReportTemplateCheckSql(
            sqlQuery,
            reportTemplateId,
            numberDays,
            startReportValue,
            endReportValue,
            null,
            reportTemplateId,
            List.of()
        );
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
        String normalized = sqlQuery == null ? "" : sqlQuery.trim();
        while (normalized.endsWith(";")) {
            normalized = normalized.substring(0, normalized.length() - 1).trim();
        }
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
        return prefix + "-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".xlsx";
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

        LocalDateTime now = LocalDateTime.now();
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
}
