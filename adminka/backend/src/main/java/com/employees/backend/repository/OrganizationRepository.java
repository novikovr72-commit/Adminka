package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OrganizationRepository {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public OrganizationRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public List<Map<String, Object>> queryForNamedListByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForList(prepared.sql(), prepared.params());
    }

    public List<Map<String, Object>> queryForNamedList(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForList(sql, params(beanParams));
    }

    public int updateNamedByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.update(prepared.sql(), prepared.params());
    }

    public int updateNamed(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.update(sql, params(beanParams));
    }

    public <T> T queryForNamedObjectByArgs(String sql, Class<T> requiredType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForObject(prepared.sql(), prepared.params(), requiredType);
    }

    public <T> T queryForNamedObject(String sql, Class<T> requiredType, Object beanParams) {
        return namedParameterJdbcTemplate.queryForObject(sql, params(beanParams), requiredType);
    }

    public Map<String, Object> queryForNamedMapByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForMap(prepared.sql(), prepared.params());
    }

    public Map<String, Object> queryForNamedMap(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForMap(sql, params(beanParams));
    }

    public int countActiveOrganizationById(String organUnitId) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from party.organ_unit ou
            where ou.id = cast(:organUnitId as uuid)
              and ou.deleted = false
            """,
            params(new OrganizationIdParams(organUnitId)),
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public List<Map<String, Object>> loadOrganizationReferenceCandidates() {
        return namedParameterJdbcTemplate.queryForList(
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
            ,
            params(new EmptyParams())
        );
    }

    public int countByDynamicReferenceSql(String sql, String organUnitId) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            sql,
            params(new OrganizationIdParams(organUnitId)),
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public int softDeleteOrganUnitById(String organUnitId) {
        return namedParameterJdbcTemplate.update(
            """
            update party.organ_unit
            set
              deleted = true,
              updated_at = now()
            where id = cast(:organUnitId as uuid)
              and deleted = false
            """,
            params(new OrganizationIdParams(organUnitId))
        );
    }

    public int softDeleteAddressesByOrganUnitId(String organUnitId) {
        return namedParameterJdbcTemplate.update(
            """
            update party.address
            set
              deleted = true,
              updated_at = now()
            where organ_unit_id = cast(:organUnitId as uuid)
              and deleted = false
            """,
            params(new OrganizationIdParams(organUnitId))
        );
    }

    public int softDeleteEmailsByOrganUnitId(String organUnitId) {
        return namedParameterJdbcTemplate.update(
            """
            update party.organ_unit_email
            set
              deleted = true,
              updated_at = now()
            where organ_unit_id = cast(:organUnitId as uuid)
              and deleted = false
            """,
            params(new OrganizationIdParams(organUnitId))
        );
    }

    public int deleteTypeRelationsByOrganUnitId(String organUnitId) {
        return namedParameterJdbcTemplate.update(
            """
            delete from party.organ_unit_organ_unit_types
            where organ_unit_id = cast(:organUnitId as uuid)
            """,
            params(new OrganizationIdParams(organUnitId))
        );
    }

    public List<Map<String, Object>> findOrganizationDetailsById(String organUnitId) {
        return namedParameterJdbcTemplate.queryForList(
            """
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
              and ou.id = cast(:organUnitId as uuid)
            limit 1
            """,
            params(new OrganizationIdParams(organUnitId))
        );
    }

    public <T> List<T> queryForBeans(String sql, Class<T> beanType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.query(prepared.sql(), prepared.params(), BeanPropertyRowMapper.newInstance(beanType));
    }

    private static BeanPropertySqlParameterSource params(Object value) {
        return new BeanPropertySqlParameterSource(value);
    }

    private record EmptyParams() {
    }

    private record OrganizationIdParams(String organUnitId) {
    }
}
