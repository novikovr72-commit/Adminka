-- Справочник id=129: колонка «Организация» — показывать sh_name (party.organ_unit), а не id.
-- Перед применением проверьте в БД: SELECT id, code, name, properties FROM reference_books WHERE id = 129;
-- При необходимости сузьте условие в CASE (fieldCaption / fieldName).

UPDATE public.reference_books rb
SET
    properties = sub.new_props::json,
    updated_at = COALESCE(rb.updated_at, now())
FROM (
    SELECT
        rb2.id,
        jsonb_set(
            rb2.properties::jsonb,
            '{fields}',
            COALESCE(
                (
                    SELECT jsonb_agg(
                        CASE
                            WHEN
                                elem->>'fieldCaption' = 'Организация'
                                OR lower(elem->>'fieldName') IN ('organ_unit_id', 'organization_id', 'org_id')
                            THEN
                                elem
                                || jsonb_build_object(
                                    'fieldLinkTable',
                                    COALESCE(elem->>'fieldLinkTable', 'party.organ_unit')
                                )
                                || jsonb_build_object(
                                    'fieldLinkField',
                                    COALESCE(elem->>'fieldLinkField', 'id')
                                )
                                || jsonb_build_object(
                                    'fieldLinkShowFields',
                                    jsonb_build_array(
                                        jsonb_build_object(
                                            'fieldLinkShowField',
                                            'sh_name',
                                            'orderPos',
                                            1
                                        )
                                    )
                                )
                            ELSE elem
                        END
                        ORDER BY ord
                    )
                    FROM jsonb_array_elements(rb2.properties::jsonb->'fields')
                        WITH ORDINALITY AS t(elem, ord)
                ),
                rb2.properties::jsonb->'fields'
            ),
            true
        ) AS new_props
    FROM public.reference_books rb2
    WHERE rb2.id = 129
      AND rb2.deleted IS NOT TRUE
      AND jsonb_typeof(rb2.properties::jsonb->'fields') = 'array'
) sub
WHERE rb.id = sub.id;
