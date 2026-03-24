WITH params AS (
    SELECT
        NULL::date AS startReport,
        NULL::date AS endReport,
        NULL::uuid AS claimOrganizationId,
        NULL::integer AS numberDays,
        '5d293572-97a2-46ef-b1c9-358717a1d0f7'::uuid AS reportId
),
   
allowed_codes AS (
    SELECT DISTINCT rto.claim_organization_id AS org_id
    FROM report_template_organizations rto
    CROSS JOIN params
    JOIN party.organ_unit ou ON ou.short_code IS NOT NULL
            AND ou.id = rto.claim_organization_id        
    WHERE rto.report_template_id = params.reportId
),
 
latest_position_results AS (
    SELECT DISTINCT ON (res.position_id)
           res.position_id,
           ROUND(res.recognized_net_weight, 3)  AS pos_recognized_net_weight,
           ROUND(res.recognized_amount_net, 2)  AS pos_recognized_amount_net,
           ROUND(res.recognized_amount_vat, 2)  AS pos_recognized_amount_vat
    FROM public.position_results res
    WHERE NOT res.deleted
    ORDER BY res.position_id, res.created_at DESC
),
latest_corrective_invoice_positions AS (
    SELECT DISTINCT ON (inv.position_id)
           inv.position_id,
           inv.number AS ksf_number_pos
    FROM public.corrective_invoice_positions inv
    WHERE NOT inv.deleted
    ORDER BY inv.position_id, inv.created_at DESC
),
events_by_claim AS (
    SELECT DISTINCT ev.object_id AS claim_id
    FROM public.events ev
    JOIN public.stages stg2
      ON stg2.id = ev.stage_id
     AND stg2.code IN ('103','111','112','113','151','191','201','661')
    WHERE ev.object_type = 'CLAIMS'
),
other_claims AS (
    SELECT
        p1.cert_position_id,
        p1.claim_id,
        STRING_AGG(DISTINCT c2.number, ', ' ORDER BY c2.number) AS other_claim_numbers
    FROM public.positions p1
    JOIN public.positions p2
      ON p2.cert_position_id = p1.cert_position_id
     AND p2.claim_id <> p1.claim_id
     AND NOT p2.deleted
    JOIN public.claims c2
      ON c2.id = p2.claim_id
     AND NOT c2.deleted
    WHERE NOT p1.deleted
    GROUP BY p1.cert_position_id, p1.claim_id
),
position_info AS (
SELECT
    cl.id AS claim_guid,
    cl.claim_organization_id,
    org.sh_name AS claim_organization_name,
    cl.source,
 
    CASE WHEN cl.source = 'LK' THEN cl.transfer_date::date
         ELSE cl.created_at::date
    END AS start_date,
 
    CASE WHEN cl.source = 'LK' THEN cl.transfer_date::timestamptz
         ELSE cl.created_at
    END AS start_date_full,
 
    pos.number AS pos_id,
    pos.position_note AS position_note,
    pos.declared_defect_note AS declared_defect_note,
    ((pos.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow') AS pos_created_at,
    cl.number AS claim_number,
    cl.draft_number AS claim_id,
    cl.transfer_date,
    cl.outgoing_notification_number,
    cl.outgoing_notification_date,
    cl.recognition_date,
    ((cl.updated_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow') AS updated_at,
    cl.payment_order_date,
    cl.completion_date,
 
    cp.cert_number,
    cp.cert_date,
    cp.cert_position,
    cp.kceh_number,
    ('Клиент - ' || org2.sap_id || ' - ' || org2.sh_name) AS client_name,
 
    CASE
        WHEN cl.nonconformity_type = 'QUALITY'  THEN 'По качеству'
        WHEN cl.nonconformity_type = 'QUANTITY' THEN 'По количеству'
        WHEN cl.nonconformity_type = 'REGRADING' THEN 'По пересортице'
        ELSE 'Другие'
    END AS nonconformity_type_name,
 
    cp.heat_number,
    cp.batch_number,
    cp.roll_number,
    cp.pack_number,
    cp.order_number,
    cp.order_position,
    cp.technical_specifications,
    cp.mark,
    cp.scheme_pack,
    cp.shipping_document_number,
    cp.shipping_document_date,
    cp.transport_number,
    cp.invoice_number,
    cp.invoice_date,
    cp.patch_number,
    cp.invoice_position,
    cp.external_correction_invoice,
    cp.correction_invoice_date,
 
    cip.ksf_number_pos,
    ''::text AS ksf_date,
 
    d.name  AS declared_defect_name,
    d2.name AS actual_defect_name,
    stt.name  AS pos_status_name,
    stg.name  AS stage_name,
    stt2.name AS claim_status_name,
 
    emp3.full_name AS claim_responsible,
    pg.name  AS product_group_name,
    tpk.name AS type_product_name,
    (org3.sap_id || ' - ' || org3.sh_name) AS customer_name,
 
    CASE WHEN cl.fast_track THEN 'ДА' ELSE 'НЕТ' END AS fast_track,
 
    CASE WHEN ebc.claim_id IS NOT NULL THEN 'НЕТ' ELSE 'ДА' END AS standard_procedure,
 
    oc.other_claim_numbers,
 
    prd.name AS product_names,  -- прямая привязка к продукту по cp.product_sap_id
 
    ROUND(cp.weight_position_certificate, 3) AS weight_position_certificate,
    ROUND(cp.thickness, 3) AS thickness,
    ROUND(cp.width, 3)     AS width,
    ROUND(cp.length, 3)    AS length,
    ROUND(cp.price, 2)     AS price,
    ROUND(cp.price_corr_vf, 2) AS price_corr_vf,
    ROUND(pos.defective_part_weight, 3) AS defective_part_weight,
 
    ROUND(
        cp.weight_position_certificate
        - COALESCE(
            CASE
                WHEN jsonb_exists(pos.metal_fact_attribute::jsonb, 'incomingQuantityNet')
                 AND (pos.metal_fact_attribute->>'incomingQuantityNet') ~ '^\s*-?\d+(?:[.,]\d+)?\s*$'
                THEN REPLACE(TRIM(pos.metal_fact_attribute->>'incomingQuantityNet'), ',', '.')::numeric
            END,
            0
        ),
        3
    ) AS discrepancy_net,
 
    ROUND(
        cp.weight_position_certificate
        - COALESCE(
            CASE
                WHEN jsonb_exists(pos.metal_fact_attribute::jsonb, 'incomingQuantityGross')
                 AND (pos.metal_fact_attribute->>'incomingQuantityGross') ~ '^\s*-?\d+(?:[.,]\d+)?\s*$'
                THEN REPLACE(TRIM(pos.metal_fact_attribute->>'incomingQuantityGross'), ',', '.')::numeric
            END,
            0
        ),
        3
    ) AS discrepancy_brutto,
 
    ROUND(cp.brutto_position_certificate, 3) AS brutto_position_certificate,
 
    lpr.pos_recognized_net_weight,
    ROUND(pos.settlement_price_net, 2) AS settlement_price_net,
    lpr.pos_recognized_amount_net,
    lpr.pos_recognized_amount_vat,
 
    ROUND(pos.add_expenses_net, 2) AS pos_add_expenses_net,
    cur.code AS currency_code,
    pos.acceptance_act_num,
    pos.acceptance_act_date,
    ROUND(pos.requested_amount_vat, 2) AS requested_amount_vat,
 
    CASE WHEN cl.type = 'NOTIFICATION' THEN 'Уведомление' ELSE 'Претензия' END AS type_name,
 
    cp.contract_number,
    (split_part(replace(cp.contract_number,' ',''),'-',1)||'-'||split_part(replace(cp.contract_number,' ',''),'-',2)) AS short_contract_number,
    cp.spec_number,
    ''::text AS outgoing_claim_date,
    ''::text AS incoming_claim_date,
    ROUND(cp.price, 2) AS purchase_price,
    cur.code AS purchase_currency_code,
    ROUND(cp.trader_effective_price, 2) AS trader_effective_price,
    ''::text AS sales_currency_code,
    cp.trading_contract_external_identifier,
    cp.unit_number,
    ''::text AS sap_batch_number,
    ''::text AS requested_customer_amount,
    ''::text AS requested_currency_code,
    ''::text AS heat_number_tech,
    ''::text AS coil_id,
    ''::text AS product_item_no_tech,
 
    cip.ksf_number_pos AS ksf_number
 
FROM public.claims cl
JOIN public.positions pos
  ON pos.claim_id = cl.id
 AND NOT pos.deleted
 
LEFT JOIN cert_repo.certificate_positions cp ON cp.id = pos.cert_position_id
LEFT JOIN latest_corrective_invoice_positions cip ON cip.position_id = pos.id
 
LEFT JOIN party.organ_unit org  ON org.id = cl.claim_organization_id
LEFT JOIN party.organ_unit org2 ON org2.sap_id = cp.client
LEFT JOIN party.organ_unit org3 ON org3.sap_id = cp.customer_sap_id
 
LEFT JOIN nsi.defect d  ON d.id  = pos.declared_defect_id
LEFT JOIN nsi.defect d2 ON d2.id = pos.actually_defect_id
 
LEFT JOIN public.statuses stt  ON stt.id  = pos.status_id
LEFT JOIN public.statuses stt2 ON stt2.id = cl.status_id
LEFT JOIN public.stages   stg  ON stg.id  = cl.stage_id
LEFT JOIN party.employee  emp3 ON emp3.id = cl.responsible_id
 
LEFT JOIN nsi.products prd       ON prd.code   = cp.product_sap_id
LEFT JOIN nsi.product_groups pg  ON pg.id      = prd.group_id
LEFT JOIN public.types_products_kdpr tpk ON tpk.code = cp.product_code
 
LEFT JOIN latest_position_results lpr ON lpr.position_id = pos.id
LEFT JOIN public.currencies cur       ON cur.id = pos.currency_id
 
LEFT JOIN events_by_claim ebc ON ebc.claim_id = cl.id
LEFT JOIN other_claims oc
  ON oc.cert_position_id = pos.cert_position_id
 AND oc.claim_id = cl.id
 
WHERE
    NOT cl.deleted
    AND (cl.source <> 'LK' OR cl.transfer_date IS NOT NULL)
)
 
SELECT
      claim_organization_name AS "Поставщик металла",
      pos_id,
      pos_created_at,
      COALESCE (claim_number, '') AS claim_number,
      claim_id AS "ID",
      transfer_date,
      payment_order_date,
      completion_date,
      cert_number,
      cert_date ,
      cert_position,
      COALESCE (kceh_number,'') AS kceh_number,
      client_name,
      nonconformity_type_name,
      heat_number,
      batch_number,
      COALESCE (roll_number,'') AS roll_number,
      COALESCE (pack_number,'') AS pack_number,
      order_number,
      order_position,
      technical_specifications,
      mark,
      COALESCE (scheme_pack,'') AS scheme_pack,
      shipping_document_number,
      shipping_document_date,
      transport_number,
      COALESCE (invoice_number,'') AS invoice_number,
      invoice_date,
      COALESCE (patch_number::text,'') AS patch_number,
      COALESCE (invoice_position::text,'') AS invoice_position,
      COALESCE (external_correction_invoice,'') AS external_correction_invoice,
      correction_invoice_date,
      COALESCE (declared_defect_name,'') AS declared_defect_name,
      COALESCE (actual_defect_name,'') AS actual_defect_name,
      COALESCE (pos_status_name,'') AS pos_status_name,
      COALESCE (stage_name,'') AS stage_name,
      COALESCE (claim_status_name,'') AS claim_status_name,
      COALESCE (claim_responsible,'') AS claim_responsible,
      COALESCE (product_names,'') AS product_names,
      COALESCE (type_product_name,'') AS type_product_name,
      COALESCE (customer_name,'') AS customer_name,
      fast_track,
      recognition_date,
      COALESCE (standard_procedure,'') AS standard_procedure,
      COALESCE (other_claim_numbers,'') AS other_claim_numbers,
      weight_position_certificate,
      thickness,
      width,
      length,
      price,
      price_corr_vf,
      defective_part_weight,
      discrepancy_net,
      brutto_position_certificate,
      pos_recognized_net_weight,
      settlement_price_net,
      pos_recognized_amount_net,
      pos_recognized_amount_vat,
      pos_add_expenses_net,
      currency_code,
      COALESCE (ksf_number_pos,'') AS ksf_number_pos,
      COALESCE (acceptance_act_num,'') AS acceptance_act_num,
      acceptance_act_date,
      requested_amount_vat,
      COALESCE (unit_number,'') AS unit_number,
      COALESCE (type_name,'') AS type_name,
      COALESCE (heat_number_tech,'') AS heat_number_tech,
      COALESCE (coil_id,'') AS coil_id,
      discrepancy_brutto,
      COALESCE (contract_number,'') AS contract_number,
      COALESCE (short_contract_number,'') AS short_contract_number,
      COALESCE (product_item_no_tech,'') AS product_item_no_tech,
      updated_at ,
      COALESCE (spec_number,'') AS spec_number,
      COALESCE (outgoing_notification_number,'') AS outgoing_notification_number,
      COALESCE (declared_defect_note,'') AS declared_defect_note,
      COALESCE (position_note,'') AS position_note,
      'https://claims.nlmk.com/claims/'||claim_guid AS "LINK"
   
FROM position_info
CROSS JOIN params
CROSS JOIN generate_series(1, 30) AS load_repeat(replica_idx)
JOIN allowed_codes ac ON ac.org_id = claim_organization_id
WHERE ((params.startReport IS NOT NULL AND start_date >= params.startReport) OR params.startReport IS NULL) AND
        ((params.endReport IS NOT NULL AND start_date <= params.endReport) OR params.endReport IS NULL)
--      AND transfer_date IS NOT NULL
ORDER BY load_repeat.replica_idx, start_date_full DESC