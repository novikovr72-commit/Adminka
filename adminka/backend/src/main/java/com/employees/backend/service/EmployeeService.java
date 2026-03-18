package com.employees.backend.service;

import com.employees.backend.repository.EmployeeRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

@Service
public class EmployeeService {
    private static final Set<String> ALLOWED_SORT_DIRECTIONS = Set.of("ASC", "DESC");
    private static final Set<String> ALLOWED_STATUS = Set.of("ACTIVE", "INACTIVE");
    private static final Set<String> REQUIRED_COLUMNS = Set.of(
        "sap_id", "surname", "first_name", "middle_name", "email", "personal_number", "phone_number"
    );
    private static final List<String> REQUIRED_COLUMNS_ORDER = List.of(
        "sap_id", "surname", "first_name", "middle_name", "email", "personal_number", "phone_number"
    );
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

    private final EmployeeRepository employeeRepository;
    private final Path logsDir;

    public EmployeeService(
        EmployeeRepository employeeRepository,
        @Value("${app.logs-dir:backend/logs}") String logsDir
    ) {
        this.employeeRepository = employeeRepository;
        this.logsDir = Path.of(logsDir).toAbsolutePath().normalize();
    }

    public EmployeeRepository repository() {
        return employeeRepository;
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
            if (!isUuid(employeeIdFilter)) {
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
            List<Map<String, Object>> items = employeeRepository.queryForList(dataSql, pagedParams.toArray());
            fillEmployeePositions(items);
            Integer totalCount = employeeRepository.queryForObject(countSql, Integer.class, params.toArray());
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
            List<Map<String, Object>> rows = employeeRepository.queryForList(sql, params.toArray());
            byte[] excel = buildExcelFromRowsWithFilters(
                "Employees",
                columnsResult.columns(),
                rows,
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
            for (String emailValue : employeeRepository.loadAllEmployeeEmailsLower()) {
                if (emailValue != null && !emailValue.isBlank()) {
                    existingEmails.add(emailValue);
                }
            }

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

            applyInsertRows(pendingInserts, stats, protocolLines);
            applyUpdateRows(pendingUpdates, stats, protocolLines);

            if (deleteMissing) {
                List<Map<String, Object>> activeEmployees = employeeRepository.loadActiveEmployeeIdEmail();
                for (Map<String, Object> employeeRow : activeEmployees) {
                    String dbEmail = normalizeNullable(employeeRow.get("email"));
                    if (dbEmail == null) {
                        continue;
                    }
                    if (emailsFromFile.contains(dbEmail.toLowerCase(Locale.ROOT))) {
                        continue;
                    }
                    try {
                        employeeRepository.markEmployeeDeletedById(employeeRow.get("id"));
                        stats.deleted++;
                        protocolLines.add(formatLogLine(0, dbEmail, "OK", "Запись отсутствует в файле и помечена deleted=true"));
                    } catch (Exception exception) {
                        stats.errors++;
                        protocolLines.add(formatLogLine(0, dbEmail, "FALSE", getErrorMessage(exception)));
                    }
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
            List<Map<String, Object>> items = employeeRepository.queryForList(sql, params.toArray());
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

        if (departUnitId != null && !isUuid(departUnitId)) {
            return badRequest("Параметр departUnitId должен быть UUID");
        }
        if (employeeId != null && !isUuid(employeeId)) {
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
            List<Map<String, Object>> items = employeeRepository.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> employeeUpdate(
        String employeeIdRaw,
        Map<String, Object> rawBody
    ) {
        String employeeId = normalizeText(employeeIdRaw);
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (!isUuid(employeeId)) {
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
            Integer duplicateEmailCount = employeeRepository.queryForObject(
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
            int updatedCount = employeeRepository.update(
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

            Map<String, Object> item = employeeRepository.queryForMap(
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

    public ResponseEntity<Map<String, Object>> employeeCreate(Map<String, Object> rawBody) {
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
            Integer duplicateEmailCount = employeeRepository.queryForObject(
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

            String employeeId = employeeRepository.queryForObject(
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

            Map<String, Object> item = employeeRepository.queryForMap(
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

    public ResponseEntity<Map<String, Object>> employeeDelete(String employeeIdRaw) {
        String employeeId = normalizeText(employeeIdRaw);
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (!isUuid(employeeId)) {
            return badRequest("Параметр employeeId должен быть UUID");
        }

        try {
            Integer existingEmployeeCount = employeeRepository.queryForObject(
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

            Integer usedAsBossCount = employeeRepository.queryForObject(
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

            int deletedRelationsCount = employeeRepository.update(
                """
                delete from party.relation
                where employee_id = ?::uuid
                """,
                employeeId
            );

            int deletedSubordinationCount = employeeRepository.update(
                """
                delete from party.emp_pos_empl_org_unit
                where employee_id = ?::uuid
                   or parent_id = ?::uuid
                """,
                employeeId,
                employeeId
            );

            int deletedCount = employeeRepository.update(
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

    public ResponseEntity<Map<String, Object>> employeePositionDelete(String employeeOrganId) {
        String normalizedEmployeeOrganId = normalizeText(employeeOrganId);
        if (normalizedEmployeeOrganId == null) {
            return badRequest("Параметр employeeOrganId обязателен");
        }
        if (!isUuid(normalizedEmployeeOrganId)) {
            return badRequest("Параметр employeeOrganId должен быть UUID");
        }

        try {
            int deletedCount = employeeRepository.update(
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

    public ResponseEntity<Map<String, Object>> employeePositionCreate(Map<String, Object> rawBody) {
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
        if (!isUuid(employeeId)) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (employeePositionId != null && !isUuid(employeePositionId)) {
            return badRequest("Параметр employeePositionId должен быть UUID");
        }
        if (bossEmployeeId != null && !isUuid(bossEmployeeId)) {
            return badRequest("Параметр bossEmployeeId должен быть UUID");
        }
        if (bossEmployeeId != null && bossEmployeeId.equalsIgnoreCase(employeeId)) {
            return badRequest("Сотрудник не может быть руководителем сам себе");
        }

        try {
            String parentEmployeeOrganId = bossEmployeeId;
            Integer duplicateCount = employeeRepository.queryForObject(
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

            String employeeOrganId = employeeRepository.queryForObject(
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

            Map<String, Object> item = loadEmployeePositionItem(employeeOrganId);
            return ResponseEntity.status(HttpStatus.CREATED).body(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> employeePositionUpdate(
        String employeeOrganIdRaw,
        Map<String, Object> rawBody
    ) {
        String employeeOrganId = normalizeText(employeeOrganIdRaw);
        if (employeeOrganId == null) {
            return badRequest("Параметр employeeOrganId обязателен");
        }
        if (!isUuid(employeeOrganId)) {
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
        if (!isUuid(employeeId)) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (employeePositionId != null && !isUuid(employeePositionId)) {
            return badRequest("Параметр employeePositionId должен быть UUID");
        }
        if (bossEmployeeId != null && !isUuid(bossEmployeeId)) {
            return badRequest("Параметр bossEmployeeId должен быть UUID");
        }
        if (bossEmployeeId != null && bossEmployeeId.equalsIgnoreCase(employeeId)) {
            return badRequest("Сотрудник не может быть руководителем сам себе");
        }

        try {
            String parentEmployeeOrganId = bossEmployeeId;
            Integer duplicateCount = employeeRepository.queryForObject(
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

            int updatedCount = employeeRepository.update(
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

            Map<String, Object> item = loadEmployeePositionItem(employeeOrganId);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    private Map<String, Object> loadEmployeePositionItem(String employeeOrganId) {
        return employeeRepository.queryForMap(
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
    }

    private void applyInsertRows(List<PendingEmployeeRow> rows, ImportStats stats, List<String> protocolLines) {
        for (PendingEmployeeRow row : rows) {
            try {
                ValidRowData data = row.data();
                employeeRepository.insertEmployee(
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
            } catch (Exception exception) {
                stats.errors++;
                protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "FALSE", getErrorMessage(exception)));
            }
        }
    }

    private void applyUpdateRows(List<PendingEmployeeRow> rows, ImportStats stats, List<String> protocolLines) {
        for (PendingEmployeeRow row : rows) {
            try {
                ValidRowData data = row.data();
                employeeRepository.updateEmployeeByEmail(
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
            } catch (Exception exception) {
                stats.errors++;
                protocolLines.add(formatLogLine(row.rowNumber(), row.email(), "FALSE", getErrorMessage(exception)));
            }
        }
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

    private String firstDefined(String primary, String fallback) {
        if (primary != null) {
            return primary;
        }
        return fallback;
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

    private List<Map<String, String>> toSortMaps(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOfString("field", sort.field(), "direction", sort.direction()));
        }
        return out;
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

        String placeholders = employeeIds.stream().map(id -> "?").collect(java.util.stream.Collectors.joining(", "));
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
        List<Map<String, Object>> rows = employeeRepository.queryForList(sql, sqlParams.toArray());
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

    private ColumnsParseResult normalizeExportColumns(Object rawColumns, Map<String, ColumnMeta> registry, List<String> defaultOrder) {
        if (rawColumns == null) {
            List<ExportColumn> defaults = new ArrayList<>();
            for (String key : defaultOrder) {
                ColumnMeta meta = registry.get(key);
                defaults.add(new ExportColumn(key, meta.title(), meta.sql()));
            }
            return new ColumnsParseResult(defaults, null);
        }
        if (!(rawColumns instanceof List<?> list)) {
            return new ColumnsParseResult(null, "Параметр columns должен быть массивом");
        }

        List<ExportColumn> result = new ArrayList<>();
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (Object item : list) {
            String key;
            String titleOverride = null;
            if (item instanceof Map<?, ?> mapItem) {
                key = normalizeSortField(mapItem.get("key"));
                titleOverride = normalizeText(mapItem.get("title"));
            } else {
                key = normalizeSortField(item);
            }
            if (key.isEmpty()) {
                continue;
            }
            ColumnMeta meta = registry.get(key);
            if (meta == null) {
                return new ColumnsParseResult(null, "Параметр columns содержит недопустимую колонку: " + key);
            }
            if (seen.add(key)) {
                result.add(new ExportColumn(
                    key,
                    titleOverride == null ? meta.title() : titleOverride,
                    meta.sql()
                ));
            }
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
            Map.entry("positionName", "position_name"),
            Map.entry("bossName", "boss_name")
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

    private byte[] buildExcelFromRowsWithFilters(
        String sheetName,
        List<ExportColumn> columns,
        List<Map<String, Object>> rows,
        LinkedHashMap<String, String> reportFilters
    ) throws IOException {
        SXSSFWorkbook workbook = new SXSSFWorkbook(1000);
        workbook.setCompressTempFiles(false);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(sheetName);
            int rowIndex = 0;
            int columnsCount = columns.size();

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

            for (Map<String, Object> rowData : rows) {
                Row row = sheet.createRow(rowIndex++);
                for (int columnIndex = 0; columnIndex < columnsCount; columnIndex += 1) {
                    Object value = rowData.get("c" + columnIndex);
                    String text = value == null ? "" : String.valueOf(value);
                    row.createCell(columnIndex).setCellValue(text);
                    int normalizedLength = Math.max(10, Math.min(60, text.length() + 2));
                    if (normalizedLength > maxLengths[columnIndex]) {
                        maxLengths[columnIndex] = normalizedLength;
                    }
                }
            }

            for (int index = 0; index < maxLengths.length; index += 1) {
                sheet.setColumnWidth(index, Math.min(255 * 256, maxLengths[index] * 256));
            }
            int lastDataRowIndex = Math.max(tableHeaderRowIndex, rowIndex - 1);
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

    private String createExportFileName(String prefix) {
        return prefix + "-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".xlsx";
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String fileName) {
        String encoded = UriUtils.encode(fileName, StandardCharsets.UTF_8);
        String disposition = "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encoded;
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(data);
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

    private boolean isUuid(String value) {
        return value != null && value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
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

    private Map<String, String> mapOfString(String key1, String value1, String key2, String value2) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        result.put(key1, value1);
        result.put(key2, value2);
        return result;
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
}
