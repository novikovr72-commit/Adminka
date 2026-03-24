package com.employees.backend.repository;

import com.employees.backend.dto.OrganUnitDescendantEmployeeRow;
import com.employees.backend.dto.OrganUnitDescendantRow;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OrganizationRepository {
    /**
     * Явные RowMapper: для record {@link OrganUnitDescendantRow} / {@link OrganUnitDescendantEmployeeRow}
     * {@link BeanPropertyRowMapper} даёт сбой конструктора (несовпадение колонок JDBC и record).
     */
    private static final RowMapper<OrganUnitDescendantRow> ORGAN_UNIT_DESCENDANT_ROW_MAPPER =
        (rs, rowNum) ->
            new OrganUnitDescendantRow(
                rs.getString("organ_unit_child_id"),
                rs.getString("organ_unit_name"),
                rs.getString("organ_unit_short"),
                rs.getString("organ_unit_code"),
                rs.getString("organ_unit_hierarchy"),
                rs.getString("kceh_number")
            );

    private static final RowMapper<OrganUnitDescendantEmployeeRow> ORGAN_UNIT_DESCENDANT_EMPLOYEE_ROW_MAPPER =
        (rs, rowNum) ->
            new OrganUnitDescendantEmployeeRow(
                rs.getString("organ_unit_child_id"),
                rs.getString("employee_organ_id"),
                rs.getString("employee_id"),
                rs.getString("employee_parent_id"),
                rs.getString("employee_parent_name"),
                rs.getString("employee_full_name"),
                rs.getString("employee_position_id"),
                rs.getString("employee_position_name")
            );

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

    /**
     * Число неудалённых дочерних {@code party.organ_unit} (прямые потомки по {@code parent_id}).
     */
    public int countActiveChildOrganUnitsByParentId(String parentOrganUnitId) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from party.organ_unit ou
            where ou.parent_id = cast(:organUnitId as uuid)
              and ou.deleted = false
            """,
            params(new OrganizationIdParams(parentOrganUnitId)),
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

    public List<OrganUnitDescendantRow> findNonDeletedDescendantsOfOrganUnit(String organUnitId) {
        return namedParameterJdbcTemplate.query(
            """
            with recursive descendants as (
              select
                ou.id,
                ou.parent_id,
                ou.name,
                ou.sh_name,
                ou.code,
                ou.short_code,
                ou.sap_id,
                coalesce(
                  nullif(trim(both from ou.code::text), ''),
                  nullif(trim(both from ou.short_code::text), ''),
                  ou.sap_id::text,
                  ou.id::text
                ) as organ_unit_hierarchy
              from party.organ_unit ou
              where ou.parent_id = cast(:organUnitId as uuid)
                and ou.deleted = false
              union all
              select
                c.id,
                c.parent_id,
                c.name,
                c.sh_name,
                c.code,
                c.short_code,
                c.sap_id,
                d.organ_unit_hierarchy || '.' || coalesce(
                  nullif(trim(both from c.code::text), ''),
                  nullif(trim(both from c.short_code::text), ''),
                  c.sap_id::text,
                  c.id::text
                )
              from party.organ_unit c
              inner join descendants d on c.parent_id = d.id
              where c.deleted = false
            )
            select
              d.id::text as organ_unit_child_id,
              d.name as organ_unit_name,
              d.sh_name as organ_unit_short,
              coalesce(
                nullif(trim(both from d.code::text), ''),
                nullif(trim(both from d.short_code::text), ''),
                d.sap_id::text
              ) as organ_unit_code,
              d.organ_unit_hierarchy as organ_unit_hierarchy,
              nullif(
                trim(
                  coalesce(ou.additional ->> 'kceh_number', ou.additional ->> 'cekh_number')
                ),
                ''
              ) as kceh_number
            from descendants d
            join party.organ_unit ou on ou.id = d.id and ou.deleted = false
            order by d.organ_unit_hierarchy, d.name
            """,
            params(new OrganizationIdParams(organUnitId)),
            ORGAN_UNIT_DESCENDANT_ROW_MAPPER
        );
    }

    public List<OrganUnitDescendantEmployeeRow> findEmployeesForOrganUnitIds(List<String> organUnitIds) {
        if (organUnitIds == null || organUnitIds.isEmpty()) {
            return Collections.emptyList();
        }
        return namedParameterJdbcTemplate.query(
            """
            select
              eou.organ_unit_id::text as organ_unit_child_id,
              eou.id::text as employee_organ_id,
              eou.employee_id::text as employee_id,
              eou.parent_id::text as employee_parent_id,
              nullif(
                trim(
                  both from coalesce(
                    nullif(trim(both from parent_emp.full_name), ''),
                    trim(
                      both from concat_ws(
                        ' ',
                        nullif(trim(both from parent_emp.surname), ''),
                        nullif(trim(both from parent_emp.first_name), ''),
                        nullif(trim(both from parent_emp.middle_name), '')
                      )
                    )
                  )
                ),
                ''
              ) as employee_parent_name,
              nullif(
                trim(
                  both from coalesce(
                    nullif(trim(both from e.full_name), ''),
                    trim(
                      both from concat_ws(
                        ' ',
                        nullif(trim(both from e.surname), ''),
                        nullif(trim(both from e.first_name), ''),
                        nullif(trim(both from e.middle_name), '')
                      )
                    )
                  )
                ),
                ''
              ) as employee_full_name,
              eou.employee_position_id::text as employee_position_id,
              pos.name as employee_position_name
            from party.emp_pos_empl_org_unit eou
            join party.employee e on e.id = eou.employee_id and e.deleted = false
            left join party.employee parent_emp on parent_emp.id = eou.parent_id and parent_emp.deleted = false
            left join party.employee_position pos on pos.id = eou.employee_position_id and pos.deleted = false
            where eou.deleted = false
              and eou.organ_unit_id::text in (:organUnitIds)
            order by eou.organ_unit_id, e.full_name collate "C" asc, eou.employee_id
            """,
            params(new OrganUnitIdListParams(organUnitIds)),
            ORGAN_UNIT_DESCENDANT_EMPLOYEE_ROW_MAPPER
        );
    }

    /**
     * Сколько узлов в поддереве {@code rootOrganUnitId} (включая корень) совпадают с {@code candidateOrganUnitId}.
     */
    public int countSelfOrDescendantMatchingId(String rootOrganUnitId, String candidateOrganUnitId) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            with recursive sub as (
              select ou.id
              from party.organ_unit ou
              where ou.id = cast(:rootOrganUnitId as uuid)
                and ou.deleted = false
              union all
              select ou.id
              from party.organ_unit ou
              inner join sub s on ou.parent_id = s.id
              where ou.deleted = false
            )
            select count(*)::int
            from sub
            where id = cast(:candidateOrganUnitId as uuid)
            """,
            params(new OrganUnitSubtreeParams(rootOrganUnitId, candidateOrganUnitId)),
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public int updateOrganUnitParent(String organUnitId, String organUnitParentId) {
        return namedParameterJdbcTemplate.update(
            """
            update party.organ_unit
            set
              parent_id = cast(:organUnitParentId as uuid),
              updated_at = now()
            where id = cast(:organUnitId as uuid)
              and deleted = false
            """,
            params(new OrganUnitParentParams(organUnitId, organUnitParentId))
        );
    }

    public List<Map<String, Object>> findOrganizationDetailsById(String organUnitId) {
        return namedParameterJdbcTemplate.queryForList(
            """
            select
              ou.id::text as organ_unit_id,
              ou.sap_id,
              ou.short_code,
              ou.code as organ_unit_code,
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

    public int countSubtreeOrganUnitsWithKcehExcluding(
        String subtreeRootId,
        String kcehNormalized,
        String excludeOrganUnitId
    ) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            with recursive subtree as (
              select ou.id
              from party.organ_unit ou
              where ou.id = cast(:subtreeRootId as uuid)
                and ou.deleted = false
              union all
              select c.id
              from party.organ_unit c
              inner join subtree s on c.parent_id = s.id
              where c.deleted = false
            )
            select count(*)::int
            from party.organ_unit ou
            inner join subtree st on st.id = ou.id
            where ou.deleted = false
              and nullif(
                trim(both from coalesce(ou.additional ->> 'kceh_number', ou.additional ->> 'cekh_number')),
                ''
              ) = :kcehNormalized
              and (
                :excludeOrganUnitId is null
                or ou.id <> cast(:excludeOrganUnitId as uuid)
              )
            """,
            params(new KcehSubtreeCountParams(subtreeRootId, kcehNormalized, excludeOrganUnitId)),
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public int countEmployeesLinkedToOrganUnit(String organUnitId) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from party.emp_pos_empl_org_unit eou
            where eou.organ_unit_id = cast(:organUnitId as uuid)
              and eou.deleted = false
            """,
            params(new OrganizationIdParams(organUnitId)),
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public String insertOrganUnitChild(
        String parentOrganUnitId,
        String name,
        String shName,
        String code,
        String additionalJson
    ) {
        return namedParameterJdbcTemplate.queryForObject(
            """
            insert into party.organ_unit (
              parent_id,
              name,
              sh_name,
              code,
              additional,
              deleted,
              country_id,
              sign_resident
            )
            select
              cast(:parentId as uuid),
              :name,
              :shName,
              :code,
              coalesce(cast(:additionalJson as jsonb), '{}'::jsonb),
              false,
              p.country_id,
              coalesce(p.sign_resident, false)
            from party.organ_unit p
            where p.id = cast(:parentId as uuid)
              and p.deleted = false
            returning id::text
            """,
            params(
                new InsertOrganUnitChildParams(
                    parentOrganUnitId,
                    name,
                    shName,
                    code,
                    additionalJson != null ? additionalJson : "{}"
                )
            ),
            String.class
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

    private record OrganUnitSubtreeParams(String rootOrganUnitId, String candidateOrganUnitId) {
    }

    private record OrganUnitParentParams(String organUnitId, String organUnitParentId) {
    }

    private record OrganUnitIdListParams(List<String> organUnitIds) {
    }

    private record KcehSubtreeCountParams(String subtreeRootId, String kcehNormalized, String excludeOrganUnitId) {
    }

    private record InsertOrganUnitChildParams(String parentId, String name, String shName, String code, String additionalJson) {
    }
}
