import { lazy, memo, Suspense } from "react";
import {
  REPORT_TEMPLATE_FIELDS_COLUMNS,
  REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS,
  REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS,
  REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS
} from "../reportTemplateConstants";
import { REPORT_TEMPLATE_VIEW_MODES } from "../reportCardConstants";
import {
  IconCheck,
  IconClose,
  IconDownload,
  IconFileJson,
  IconMinus,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSliders,
  IconUpload
} from "./AppIcons";
import ReportTemplateFieldTableRow from "./ReportTemplateFieldTableRow";

const ReportTemplateJsonEditorPanel = lazy(() => import("./ReportTemplateJsonEditorPanel"));

function ReportCardTemplateTab({
  isActive,
  isReportTemplateSettingsLoading,
  isReportTemplateSqlSyncing,
  reportTemplateViewMode,
  isReportTemplateEditMode,
  isReportTemplateSettingsSaving,
  isReportSqlEditMode,
  hasReportTemplateContentLoaded,
  isReportTemplateLevelTwoExpanded,
  isReportTemplateLevelThreeExpanded,
  setIsReportTemplateLevelTwoExpanded,
  setIsReportTemplateLevelThreeExpanded,
  reportTemplateLogoBase64,
  reportTemplateLogoMimeType,
  reportTemplateGeneralSettingsTableWrapperRef,
  reportTemplateGeneralParameterColumnWidth,
  reportTemplateGeneralSettingsSortDirection,
  reportTemplateGeneralSettingsRows,
  reportTemplateSettingsDraft,
  reportTemplateFieldsTableWrapperRef,
  reportTemplateFieldsTableWidthPx,
  reportTemplateFieldsColumnWidths,
  sortedReportTemplateFields,
  reportTemplateVisibleOrderBySourceIndex,
  reportTemplateLinkFieldOptions,
  reportTemplateJsonEditorPanelRef,
  reportTemplateJsonDraft,
  isReportTemplateJsonEditMode,
  reportTemplateJsonZoom,
  reportTemplateJsonFileInputRef,
  handleRefreshReportTemplateFieldsFromSql,
  handleSaveReportTemplateSettings,
  handleCancelReportTemplateEdit,
  handleOpenReportTemplateJsonView,
  handleStartReportTemplateEdit,
  handleSaveReportTemplateJson,
  handleCancelReportTemplateJsonEdit,
  handleDecreaseReportTemplateJsonZoom,
  handleIncreaseReportTemplateJsonZoom,
  handleOpenReportTemplateSettingsView,
  handleDownloadReportTemplateJson,
  handleUploadReportTemplateJsonClick,
  handleToggleReportTemplateJsonEdit,
  handleReportTemplateJsonFileSelect,
  handleReportTemplateLogoSelect,
  handleClearReportTemplateLogo,
  handleToggleReportTemplateGeneralSettingsSort,
  handleResizeReportTemplateGeneralSettingsParameterColumnStart,
  handleChangeReportTemplateField,
  handleResizeReportTemplateFieldColumnStart,
  handleChangeReportTemplateSettingsFieldRow,
  handleReportTemplateFieldDragOver,
  handleReportTemplateFieldDrop,
  handleReportTemplateFieldDragStart,
  handleReportTemplateFieldDrag,
  handleReportTemplateFieldDragEnd,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave,
  isReportTemplateFieldVisible,
  normalizeHexColorOrDefault
}) {
  return (
<div
  className={`report-card-tab-content${!isActive ? " is-hidden" : ""}`}
  role="tabpanel"
  hidden={!isActive}
>
    <section className="employee-card-section report-template-settings-section">
      <div className="employee-card-subordination-header">
      <h3>Настройка шаблона</h3>
        {!isReportTemplateSettingsLoading && (
          <div className="report-template-settings-actions">
            {isReportTemplateSqlSyncing && (
              <span className="report-template-sql-sync-indicator">
                Сверка с SQL...
              </span>
            )}
            {reportTemplateViewMode === REPORT_TEMPLATE_VIEW_MODES.SETTINGS ? (
              isReportTemplateEditMode ? (
                <>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleRefreshReportTemplateFieldsFromSql}
                    disabled={isReportTemplateSettingsSaving || isReportSqlEditMode}
                  >
                    <IconRefresh aria-hidden />
                    <span>Обновить</span>
                  </button>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleSaveReportTemplateSettings}
                    disabled={isReportTemplateSettingsSaving}
                  >
                    <IconCheck aria-hidden />
                    <span>
                      {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleCancelReportTemplateEdit}
                    disabled={isReportTemplateSettingsSaving}
                  >
                    <IconClose aria-hidden />
                    <span>Отменить</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleOpenReportTemplateJsonView}
                    disabled={isReportTemplateSettingsSaving}
                  >
                    <IconFileJson aria-hidden />
                    <span>Параметры json</span>
                  </button>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleStartReportTemplateEdit}
                    disabled={isReportTemplateSettingsSaving}
                  >
                    <IconPencil aria-hidden />
                    <span>Изменить</span>
                  </button>
                </>
              )
            ) : isReportTemplateJsonEditMode ? (
              <>
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleSaveReportTemplateJson}
                  disabled={isReportTemplateSettingsSaving}
                >
                  <IconCheck aria-hidden />
                  <span>
                    {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                  </span>
                </button>
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleCancelReportTemplateJsonEdit}
                  disabled={isReportTemplateSettingsSaving}
                >
                  <IconClose aria-hidden />
                  <span>Отменить</span>
                </button>
                <button
                  type="button"
                  className="panel-action-button report-card-sql-zoom-button"
                  onClick={handleDecreaseReportTemplateJsonZoom}
                  aria-label="Отдалить текст JSON"
                  data-tooltip="Отдалить"
                  disabled={reportTemplateJsonZoom <= 0.7}
                >
                  <IconMinus aria-hidden />
                </button>
                <button
                  type="button"
                  className="panel-action-button report-card-sql-zoom-button"
                  onClick={handleIncreaseReportTemplateJsonZoom}
                  aria-label="Приблизить текст JSON"
                  data-tooltip="Приблизить"
                  disabled={reportTemplateJsonZoom >= 1.6}
                >
                  <IconPlus aria-hidden />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleOpenReportTemplateSettingsView}
                  disabled={isReportTemplateSettingsSaving}
                >
                  <IconSliders aria-hidden />
                  <span>Настройка параметров</span>
                </button>
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleDownloadReportTemplateJson}
                  disabled={isReportTemplateSettingsSaving}
                >
                  <IconDownload aria-hidden />
                  <span>Выгрузить json</span>
                </button>
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleUploadReportTemplateJsonClick}
                  disabled={isReportTemplateSettingsSaving}
                >
                  <IconUpload aria-hidden />
                  <span>Загрузить json</span>
                </button>
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleToggleReportTemplateJsonEdit}
                  disabled={isReportTemplateSettingsSaving}
                >
                  <IconPencil aria-hidden />
                  <span>Изменить</span>
                </button>
                <button
                  type="button"
                  className="panel-action-button report-card-sql-zoom-button"
                  onClick={handleDecreaseReportTemplateJsonZoom}
                  aria-label="Отдалить текст JSON"
                  data-tooltip="Отдалить"
                  disabled={reportTemplateJsonZoom <= 0.7}
                >
                  <IconMinus aria-hidden />
                </button>
                <button
                  type="button"
                  className="panel-action-button report-card-sql-zoom-button"
                  onClick={handleIncreaseReportTemplateJsonZoom}
                  aria-label="Приблизить текст JSON"
                  data-tooltip="Приблизить"
                  disabled={reportTemplateJsonZoom >= 1.6}
                >
                  <IconPlus aria-hidden />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={reportTemplateJsonFileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleReportTemplateJsonFileSelect}
      />

      <div className="report-template-content-shell">
        {!hasReportTemplateContentLoaded ? (
          <div className="report-template-loading-state">Загрузка настроек шаблона...</div>
        ) : (
          <>
          <div
            className={`report-template-content-slider${
              reportTemplateViewMode === REPORT_TEMPLATE_VIEW_MODES.JSON ? " is-json" : ""
            }`}
          >
            <div className="report-template-content-track">
              <div className="report-template-content-pane report-template-content-pane-settings">
          <div className="report-template-level-section report-template-level-section-two">
            <button
              type="button"
              className="report-template-level-toggle"
              onClick={() => setIsReportTemplateLevelTwoExpanded((prev) => !prev)}
            >
              <span className="report-template-level-toggle-icon" aria-hidden="true">
                {isReportTemplateLevelTwoExpanded ? "▾" : "▸"}
              </span>
              <span>Логотип и общие настройки</span>
            </button>
            {isReportTemplateLevelTwoExpanded ? (
          <div className="report-template-top-grid">
            <div className="report-template-logo-card">
              <h4>Логотип</h4>
              <label
                className={`report-template-logo-uploader${
                  isReportTemplateEditMode ? " editable" : ""
                }`}
              >
                {reportTemplateLogoBase64 ? (
                  <img
                    src={`data:${reportTemplateLogoMimeType || "image/png"};base64,${reportTemplateLogoBase64}`}
                    alt="Логотип отчета"
                  />
                ) : (
                  <span className="report-template-logo-placeholder">Логотип не задан</span>
                )}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  hidden
                  disabled={!isReportTemplateEditMode}
                  onChange={handleReportTemplateLogoSelect}
                />
              </label>
              {isReportTemplateEditMode && reportTemplateLogoBase64 ? (
                <button
                  type="button"
                  className="panel-action-button report-template-logo-clear-button"
                  onClick={handleClearReportTemplateLogo}
                >
                  <IconClose aria-hidden />
                  <span>Очистить логотип</span>
                </button>
              ) : null}
            </div>

            <div className="report-template-general-card">
              <h4>Общие настройки</h4>
              <div
                className="report-template-general-table-wrapper"
                ref={reportTemplateGeneralSettingsTableWrapperRef}
              >
                <table className="report-template-general-table">
                  <colgroup>
                    <col style={{ width: `${reportTemplateGeneralParameterColumnWidth}px` }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          className="column-sort-button report-template-general-sort-button"
                          onClick={handleToggleReportTemplateGeneralSettingsSort}
                        >
                          <span>{REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS.parameter.title}</span>
                          <span className="sort-icon-group">
                            <span className="sort-icon">
                              {reportTemplateGeneralSettingsSortDirection ===
                              REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.ASC
                                ? "▲"
                                : "▼"}
                            </span>
                          </span>
                        </button>
                        <span
                          className="column-resize-handle"
                          onMouseDown={
                            handleResizeReportTemplateGeneralSettingsParameterColumnStart
                          }
                          role="presentation"
                        />
                      </th>
                      <th>{REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS.value.title}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportTemplateGeneralSettingsRows.map((row) => {
                      const rowValue = reportTemplateSettingsDraft[row.key];
                      const isBooleanField = row.type === "boolean";
                      const isNumberField = row.type === "number";
                      const isColorField = row.type === "color";
                      const isTextField = row.type === "text";
                      return (
                        <tr key={`report-template-general-${row.key}`}>
                          <td>{row.label}</td>
                          <td>
                            {isReportTemplateEditMode ? (
                              isBooleanField ? (
                                <select
                                  className="employee-card-field-input employee-card-field-select"
                                  value={rowValue ? "true" : "false"}
                                  onChange={(event) =>
                                    handleChangeReportTemplateField(
                                      row.key,
                                      String(event.target.value) === "true"
                                    )
                                  }
                                >
                                  <option value="true">ДА</option>
                                  <option value="false">НЕТ</option>
                                </select>
                              ) : isColorField ? (
                                <div className="report-template-color-input-group">
                                  <input
                                    type="color"
                                    className="report-template-color-picker"
                                    value={normalizeHexColorOrDefault(rowValue, "#000000")}
                                    onChange={(event) =>
                                      handleChangeReportTemplateField(
                                        row.key,
                                        String(event.target.value ?? "").toUpperCase()
                                      )
                                    }
                                  />
                                  <input
                                    type="text"
                                    className="employee-card-field-input"
                                    defaultValue={String(rowValue ?? "")}
                                    key={`report-template-general-color-text-${row.key}-${String(
                                      rowValue ?? ""
                                    )}`}
                                    inputMode="text"
                                    maxLength={7}
                                    onBlur={(event) =>
                                      handleChangeReportTemplateField(row.key, event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  className="employee-card-field-input"
                                  defaultValue={String(rowValue ?? "")}
                                  key={`report-template-general-text-${row.key}-${String(
                                    rowValue ?? ""
                                  )}`}
                                  inputMode={isNumberField ? "numeric" : "text"}
                                  maxLength={isColorField ? 7 : undefined}
                                  onBlur={(event) =>
                                    handleChangeReportTemplateField(row.key, event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                  }}
                                />
                              )
                            ) : isBooleanField ? (
                              rowValue ? (
                                "ДА"
                              ) : (
                                "НЕТ"
                              )
                            ) : isTextField ? (
                              String(rowValue ?? "").trim() || "-"
                            ) : (
                              String(rowValue ?? "").trim() || "-"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
            ) : null}
          </div>
          <div
            className={`report-template-level-gap${
              !isReportTemplateLevelTwoExpanded && !isReportTemplateLevelThreeExpanded
                ? " is-collapsed"
                : ""
            }`}
            aria-hidden="true"
          />

          <div className="report-template-level-section report-template-level-section-three">
          <div
            className="report-template-fields-card"
          >
            <div className="report-template-fields-header">
              <button
                type="button"
                className="report-template-level-toggle report-template-level-toggle-inline"
                onClick={() => setIsReportTemplateLevelThreeExpanded((prev) => !prev)}
              >
                <span className="report-template-level-toggle-icon" aria-hidden="true">
                  {isReportTemplateLevelThreeExpanded ? "▾" : "▸"}
                </span>
                <span>Настройка столбцов</span>
              </button>
            </div>
            {isReportTemplateLevelThreeExpanded ? (
            <div
              className="report-template-fields-table-wrapper"
              ref={reportTemplateFieldsTableWrapperRef}
              onDragOver={handleReportTemplateFieldsWrapperDragOver}
            >
              <table
                className="report-template-fields-table"
                style={{ width: `${reportTemplateFieldsTableWidthPx}px` }}
              >
                <colgroup>
                  {REPORT_TEMPLATE_FIELDS_COLUMNS.map((column) => (
                    <col
                      key={`report-template-fields-col-${column.key}`}
                      style={{
                        width: `${
                          Number(reportTemplateFieldsColumnWidths[column.key]) ||
                          REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS[column.key]
                        }px`
                      }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {REPORT_TEMPLATE_FIELDS_COLUMNS.map((column) => {
                      return (
                        <th key={column.key}>
                          <div className="column-sort-button">
                            <span>{column.title}</span>
                          </div>
                          <span
                            className="column-resize-handle"
                            onMouseDown={(event) =>
                              handleResizeReportTemplateFieldColumnStart(column.key, event)
                            }
                            role="presentation"
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(reportTemplateSettingsDraft.fields) &&
                  reportTemplateSettingsDraft.fields.length > 0 ? (
                    sortedReportTemplateFields.map(({ field, sourceIndex }) => {
                      const isFieldVisible = isReportTemplateFieldVisible(field);
                      const isRowEditable = isReportTemplateEditMode && isFieldVisible;
                      const visibleOrderText = isFieldVisible
                        ? String(
                            reportTemplateVisibleOrderBySourceIndex.get(sourceIndex) ?? "-"
                          )
                        : "-";
                      return (
                        <ReportTemplateFieldTableRow
                          key={`report-template-field-${sourceIndex}`}
                          field={field}
                          sourceIndex={sourceIndex}
                          visibleOrderText={visibleOrderText}
                          isReportTemplateEditMode={isReportTemplateEditMode}
                          isFieldVisible={isFieldVisible}
                          isRowEditable={isRowEditable}
                          linkFieldOptions={reportTemplateLinkFieldOptions}
                          onFieldRowChange={handleChangeReportTemplateSettingsFieldRow}
                          onFieldDragOver={handleReportTemplateFieldDragOver}
                          onFieldDrop={handleReportTemplateFieldDrop}
                          onFieldDragStart={handleReportTemplateFieldDragStart}
                          onFieldDrag={handleReportTemplateFieldDrag}
                          onFieldDragEnd={handleReportTemplateFieldDragEnd}
                          onOverflowMouseEnter={handleCellMouseEnter}
                          onOverflowMouseMove={updateCellTooltipPosition}
                          onOverflowMouseLeave={handleCellMouseLeave}
                        />
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={13}>Поля для настройки отсутствуют</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : null}
          </div>
          </div>
              </div>
              <div className="report-template-content-pane report-template-content-pane-json">
            <Suspense
              fallback={
                <div
                  className="report-template-json-panel"
                  aria-busy="true"
                  aria-label="Загрузка редактора JSON"
                >
                  Загрузка редактора…
                </div>
              }
            >
              <ReportTemplateJsonEditorPanel
                ref={reportTemplateJsonEditorPanelRef}
                committedText={reportTemplateJsonDraft}
                isEditing={isReportTemplateJsonEditMode}
                zoom={reportTemplateJsonZoom}
              />
            </Suspense>
              </div>
            </div>
          </div>
          </>
        )}
        {isReportTemplateSettingsLoading && hasReportTemplateContentLoaded ? (
          <div className="report-template-loading-overlay" aria-hidden="true">
            <span className="report-template-loading-overlay-text">
              Загрузка настроек шаблона...
            </span>
          </div>
        ) : null}
      </div>
    </section>
  </div>

  );
}

export default memo(ReportCardTemplateTab);
