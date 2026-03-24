package com.employees.backend.controller;

import com.employees.backend.service.ReferenceBookService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class ReferenceBookController {

    private final ReferenceBookService referenceBookService;

    public ReferenceBookController(ReferenceBookService referenceBookService) {
        this.referenceBookService = referenceBookService;
    }

    @PostMapping("/reference-books")
    public ResponseEntity<Map<String, Object>> listPost(@RequestBody(required = false) Map<String, Object> rawBody) {
        return referenceBookService.listPost(rawBody);
    }

    /** Список справочников (query-параметры как у POST: limit, offset, code, name, procedureCode, referenceUrl, sortField, sortDirection). */
    @GetMapping("/reference-books")
    public ResponseEntity<Map<String, Object>> listGet(@RequestParam Map<String, String> queryParams) {
        Map<String, Object> body = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : queryParams.entrySet()) {
            if (entry.getValue() != null) {
                body.put(entry.getKey(), entry.getValue());
            }
        }
        return referenceBookService.listPost(body);
    }

    /** Имена всех базовых таблиц ({@code schema.table}) для выбора в «Связанные таблицы». */
    @GetMapping("/reference-books/db-tables")
    public ResponseEntity<Map<String, Object>> listDbTables() {
        return referenceBookService.listDbTables();
    }

    /** Имена столбцов таблицы (параметр {@code table}, например {@code public.product_groups}). */
    @GetMapping("/reference-books/db-table-columns")
    public ResponseEntity<Map<String, Object>> listDbTableColumns(@RequestParam("table") String table) {
        return referenceBookService.listDbTableColumns(table);
    }

    @GetMapping("/reference-books/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable("id") String id) {
        return referenceBookService.getById(id);
    }

    /** Строки таблицы справочника по полям из {@code properties} (fieldShow). {@code refSuffix} — значение {@code reference_url} (суффикс URL). */
    @PostMapping("/reference-books/{refSuffix}/records")
    public ResponseEntity<Map<String, Object>> listDataRecords(
        @PathVariable("refSuffix") String refSuffix,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.listDataRecords(refSuffix, rawBody);
    }

    /** Вставка строки в таблицу справочника (тело: {@code values}). */
    @PostMapping("/reference-books/{refSuffix}/records/insert")
    public ResponseEntity<Map<String, Object>> insertDataRecord(
        @PathVariable("refSuffix") String refSuffix,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.insertDataRecord(refSuffix, rawBody);
    }

    /** Обновление строки: {@code id}, {@code values}. */
    @PatchMapping("/reference-books/{refSuffix}/records/update")
    public ResponseEntity<Map<String, Object>> updateDataRecord(
        @PathVariable("refSuffix") String refSuffix,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.updateDataRecord(refSuffix, rawBody);
    }

    /**
     * Варианты для поля со связью: {@code fieldLinkTable}, {@code fieldLinkField}, {@code fieldLinkShowFields} / Lists.
     * Режим списка задаётся в properties поля ({@code fieldLinkListType}: full/match); тело: опционально {@code search},
     * {@code limit} (≤100), {@code offset}; {@code hasMore} — есть ли следующая порция (full и match).
     * Для {@code fieldLinkFiltr} с плейсхолдерами {@code [имя_поля]} — передать {@code referenceRowValues}: текущие значения полей записи (fieldName → значение).
     */
    @PostMapping("/reference-books/{refSuffix}/link-options")
    public ResponseEntity<Map<String, Object>> listLinkFieldOptions(
        @PathVariable("refSuffix") String refSuffix,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.listLinkFieldOptions(refSuffix, rawBody);
    }

    @PostMapping("/reference-book")
    public ResponseEntity<Map<String, Object>> create(@RequestBody(required = false) Map<String, Object> rawBody) {
        return referenceBookService.create(rawBody);
    }

    @PatchMapping("/reference-books/{id}")
    public ResponseEntity<Map<String, Object>> updateMain(
        @PathVariable("id") String id,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.updateMain(id, rawBody);
    }

    @PatchMapping("/reference-books/{id}/properties")
    public ResponseEntity<Map<String, Object>> updateProperties(
        @PathVariable("id") String id,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.updateProperties(id, rawBody);
    }

    @PatchMapping("/reference-books/{id}/rules")
    public ResponseEntity<Map<String, Object>> updateRules(
        @PathVariable("id") String id,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return referenceBookService.updateRules(id, rawBody);
    }

    @DeleteMapping("/reference-books/{id}")
    public ResponseEntity<Map<String, Object>> deleteReferenceBook(@PathVariable("id") String id) {
        return referenceBookService.deleteReferenceBook(id);
    }
}
