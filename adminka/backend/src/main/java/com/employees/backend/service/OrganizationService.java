package com.employees.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.employees.backend.repository.OrganizationRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.util.UriUtils;

@Service
public class OrganizationService {
    private static final Set<String> ALLOWED_SORT_DIRECTIONS = Set.of("ASC", "DESC");
    private static final Set<String> ORG_SORT_FIELDS = Set.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "country_name", "address", "sign_resident",
        "organ_unit_type_names"
    );
    private static final Set<String> ORG_TEXT_SORT_FIELDS = Set.of(
        "sap_id", "name", "sh_name", "inn", "kpp", "ogrn", "okpo", "country_name", "address",
        "organ_unit_type_names"
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

    private final OrganizationRepository organizationRepository;
    private final ObjectMapper objectMapper;
    private final String dadataApiToken;
    private final String dadataFindPartyUrl;

    public OrganizationService(
        OrganizationRepository organizationRepository,
        ObjectMapper objectMapper,
        @Value("${app.dadata.api-token:}") String dadataApiToken,
        @Value("${app.dadata.find-party-url:https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party}") String dadataFindPartyUrl
    ) {
        this.organizationRepository = organizationRepository;
        this.objectMapper = objectMapper;
        this.dadataApiToken = dadataApiToken;
        this.dadataFindPartyUrl = dadataFindPartyUrl;
    }

    public OrganizationRepository repository() {
        return organizationRepository;
    }

    public ResponseEntity<Map<String, Object>> organizationsGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/organizations с JSON body"));
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
        if (organUnitId != null && !isUuid(organUnitId)) {
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
            List<Map<String, Object>> rawItems = organizationRepository.queryForNamedListByArgs(
                dataSql,
                pagedParams.toArray()
            );
            List<Map<String, Object>> items = new ArrayList<>(rawItems.size());
            for (Map<String, Object> item : rawItems) {
                LinkedHashMap<String, Object> mapped = new LinkedHashMap<>(item);
                List<Map<String, Object>> types = parseJsonArrayOfObjects(item.get("organ_unit_types"));
                types.sort((left, right) -> {
                    Integer leftSort = left.get("organUnitTypeSort") instanceof Number value ? value.intValue() : Integer.MAX_VALUE;
                    Integer rightSort = right.get("organUnitTypeSort") instanceof Number value ? value.intValue() : Integer.MAX_VALUE;
                    if (!Objects.equals(leftSort, rightSort)) {
                        return Integer.compare(leftSort, rightSort);
                    }
                    return String.valueOf(left.get("organUnitTypeName")).compareToIgnoreCase(String.valueOf(right.get("organUnitTypeName")));
                });
                mapped.put("organ_unit_types", types);
                List<String> typeNames = new ArrayList<>();
                for (Map<String, Object> typeItem : types) {
                    String typeName = normalizeText(typeItem.get("organUnitTypeName"));
                    if (typeName != null) {
                        typeNames.add(typeName);
                    }
                }
                mapped.put("organ_unit_type_names", typeNames);
                items.add(mapped);
            }
            Integer totalCount = organizationRepository.queryForNamedObjectByArgs(
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

    public ResponseEntity<Map<String, Object>> refreshOrganizationDadata(String organUnitIdRaw) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!isUuid(organUnitId)) {
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
            List<Map<String, Object>> organizationRows = organizationRepository.queryForNamedListByArgs(
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
            organizationRepository.updateNamedByArgs(
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
            List<Map<String, Object>> rows = organizationRepository.queryForNamedListByArgs(sql, params.toArray());
            byte[] excel = buildExcelFromRowsWithFilters(
                "Organizations",
                columnsResult.columns(),
                rows,
                reportFilters
            );
            String fileName = createExportFileName("organizations-export");
            return excelResponse(excel, fileName);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка выгрузки");
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
            List<Map<String, Object>> items = organizationRepository.queryForNamedListByArgs(sql, params.toArray());

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
                        organizationRepository.queryForNamedListByArgs(departmentsSql, organizationIds.toArray());

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

    public ResponseEntity<Map<String, Object>> listOrganizationUnitTypes(String nameRaw) {
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
            List<Map<String, Object>> items = organizationRepository.queryForNamedListByArgs(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size()
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка списка типов организаций");
        }
    }

    public ResponseEntity<Map<String, Object>> listCountries(String nameRaw) {
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
            List<Map<String, Object>> items = organizationRepository.queryForNamedListByArgs(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size()
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка списка стран");
        }
    }

    public ResponseEntity<Map<String, Object>> organizationDetails(String organUnitIdRaw) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }

        try {
            List<Map<String, Object>> rows = organizationRepository.findOrganizationDetailsById(organUnitId);
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
        if (!isUuid(organUnitId)) {
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

        if (countryId != null && !isUuid(countryId)) {
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
                if (!isUuid(typeId)) {
                    return badRequest("Параметр organUnitTypeIds должен содержать только UUID");
                }
                uniqueTypeIds.add(typeId);
            }
        }
        List<String> organUnitTypeIds = new ArrayList<>(uniqueTypeIds);

        try {
            Integer organizationExists = organizationRepository.queryForNamedObject(
                """
                select count(*)::int
                from party.organ_unit ou
                where ou.id = cast(:organUnitId as uuid)
                  and ou.deleted = false
                """,
                Integer.class,
                new OrganUnitIdParams(organUnitId)
            );
            if (organizationExists == null || organizationExists == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена"
                ));
            }

            Map<String, Object> currentOrg = organizationRepository.queryForNamedMap(
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
                where ou.id = cast(:organUnitId as uuid)
                  and ou.deleted = false
                limit 1
                """,
                new OrganUnitIdParams(organUnitId)
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
                Integer countryExists = organizationRepository.queryForNamedObject(
                    """
                    select count(*)::int
                    from nsi.country c
                    where c.id = cast(:countryId as uuid)
                      and c.deleted = false
                    """,
                    Integer.class,
                    new CountryIdParams(countryId)
                );
                if (countryExists == null || countryExists == 0) {
                    return badRequest("Параметр countryId содержит несуществующую страну");
                }
            }

            if (hasOrganUnitTypeIds && !organUnitTypeIds.isEmpty()) {
                String typePlaceholders = String.join(", ", Collections.nCopies(organUnitTypeIds.size(), "?::uuid"));
                List<Object> typeParams = new ArrayList<>(organUnitTypeIds);
                Integer existingTypes = organizationRepository.queryForNamedObjectByArgs(
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

            int updatedCount = organizationRepository.updateNamed(
                """
                update party.organ_unit
                set
                  sap_id = :sapId,
                  name = :name,
                  sh_name = :shName,
                  inn = :inn,
                  kpp = :kpp,
                  ogrn = :ogrn,
                  okpo = :okpo,
                  short_code = :shortCode,
                  country_id = cast(:countryId as uuid),
                  sign_resident = :signResident,
                  additional = cast(:additionalJson as jsonb),
                  updated_at = now()
                where id = cast(:organUnitId as uuid)
                  and deleted = false
                """,
                new UpdateOrganizationParams(
                    organUnitId,
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
                    additionalJson
                )
            );
            if (updatedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена или удалена"
                ));
            }

            if (hasOrganUnitTypeIds) {
                organizationRepository.updateNamed(
                    """
                    delete from party.organ_unit_organ_unit_types
                    where organ_unit_id = cast(:organUnitId as uuid)
                    """,
                    new OrganUnitIdParams(organUnitId)
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
                    organizationRepository.updateNamedByArgs(
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

            List<Map<String, Object>> addressRows = organizationRepository.queryForNamedList(
                """
                select a.id::text as id
                from party.address a
                where a.organ_unit_id = cast(:organUnitId as uuid)
                  and a.deleted = false
                order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id
                limit 1
                """,
                new OrganUnitIdParams(organUnitId)
            );
            String addressId = addressRows.isEmpty() ? null : normalizeText(addressRows.get(0).get("id"));
            if (hasAddress) {
                if (addressId != null) {
                    organizationRepository.updateNamed(
                        """
                        update party.address
                        set
                          full_address = :fullAddress,
                          updated_at = now()
                        where id = cast(:addressId as uuid)
                        """,
                        new AddressUpdateParams(addressId, address)
                    );
                } else if (address != null) {
                    organizationRepository.updateNamed(
                        """
                        insert into party.address (
                          id,
                          full_address,
                          organ_unit_id,
                          deleted,
                          created_at,
                          updated_at
                        )
                        values (
                          cast(:addressId as uuid),
                          :fullAddress,
                          cast(:organUnitId as uuid),
                          false,
                          now(),
                          now()
                        )
                        """,
                        new AddressInsertParams(UUID.randomUUID().toString(), organUnitId, address)
                    );
                }
            }

            return organizationDetails(organUnitId);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка обновления организации");
        }
    }

    public ResponseEntity<Map<String, Object>> deleteOrganization(String organUnitIdRaw) {
        String organUnitId = normalizeText(organUnitIdRaw);
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }

        try {
            int existingOrganizationCount = organizationRepository.countActiveOrganizationById(organUnitId);
            if (existingOrganizationCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Организация не найдена или уже удалена"
                ));
            }

            List<OrganizationReferenceCheck> references = loadOrganizationReferenceChecks();
            for (OrganizationReferenceCheck reference : references) {
                String referenceSql = buildOrganizationReferenceCheckSql(reference);
                int referencesCount = organizationRepository.countByDynamicReferenceSql(referenceSql, organUnitId);
                if (referencesCount > 0) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf(
                        "ok", false,
                        "error", "Организация используется в таблице " + reference.fullTableName()
                    ));
                }
            }

            int deletedOrganUnitCount = organizationRepository.softDeleteOrganUnitById(organUnitId);
            int deletedAddressCount = organizationRepository.softDeleteAddressesByOrganUnitId(organUnitId);
            int deletedEmailCount = organizationRepository.softDeleteEmailsByOrganUnitId(organUnitId);
            int deletedTypeRelationsCount = organizationRepository.deleteTypeRelationsByOrganUnitId(organUnitId);

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

    private List<OrganizationReferenceCheck> loadOrganizationReferenceChecks() {
        List<Map<String, Object>> rows = organizationRepository.loadOrganizationReferenceCandidates();
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
            + " = cast(:organUnitId as uuid)"
            + deletedCondition;
    }

    private String quoteIdentifier(String value) {
        if (value == null || !value.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
            throw new IllegalArgumentException("Недопустимое имя идентификатора SQL");
        }
        return "\"" + value + "\"";
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

    private String buildOrganizationOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = ORG_SORT_SQL.get(sort.field());
            String sortExpr = ORG_TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private List<Map<String, String>> toSortMapsCamel(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOfString("field", snakeToCamel(sort.field()), "direction", sort.direction()));
        }
        return out;
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

    private String firstDefined(String primary, String fallback) {
        if (primary != null) {
            return primary;
        }
        return fallback;
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
        LinkedHashSet<String> seen = new LinkedHashSet<>();
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

    private record OrganUnitIdParams(String organUnitId) {
    }

    private record CountryIdParams(String countryId) {
    }

    private record UpdateOrganizationParams(
        String organUnitId,
        String sapId,
        String name,
        String shName,
        String inn,
        String kpp,
        String ogrn,
        String okpo,
        String shortCode,
        String countryId,
        boolean signResident,
        String additionalJson
    ) {
    }

    private record AddressUpdateParams(
        String addressId,
        String fullAddress
    ) {
    }

    private record AddressInsertParams(
        String addressId,
        String organUnitId,
        String fullAddress
    ) {
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
