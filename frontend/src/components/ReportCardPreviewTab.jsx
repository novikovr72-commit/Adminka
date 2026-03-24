import { memo } from "react";
import ExportToExcelButton from "./ExportToExcelButton";

function ReportCardPreviewTab({
  isActive,
  requestFullReportTemplateExcel,
  isReportPreviewLoading,
  isReportPreviewTabAvailable,
  setReportPreviewError,
  onRefreshReportPreview,
  reportPreviewStats,
  reportPreviewPeriodLabel,
  reportPreviewError,
  reportPreviewSheetRows,
  reportPreviewSheetMeta,
  formatReportSqlResultCellValue
}) {
  return (
    <div
      className={`report-card-tab-content${isActive ? "" : " is-hidden"}`}
      role="tabpanel"
      hidden={!isActive}
    >
      <section className="employee-card-section report-preview-section">
        <div className="employee-card-subordination-header report-preview-header">
          <h3>Просмотр отчета Excel</h3>
          <div className="report-preview-actions">
            <ExportToExcelButton
              exportFile={requestFullReportTemplateExcel}
              disabled={isReportPreviewLoading || !isReportPreviewTabAvailable}
              className="panel-action-button"
              onError={(error) =>
                setReportPreviewError(
                  error instanceof Error && error.message
                    ? error.message
                    : "Ошибка формирования Excel-отчета"
                )
              }
            />
            <button
              type="button"
              className="panel-action-button"
              onClick={onRefreshReportPreview}
              disabled={isReportPreviewLoading}
            >
              {isReportPreviewLoading ? "Обновление..." : "Обновить"}
            </button>
          </div>
        </div>
        <div className="report-preview-stats">
          <span>Найдено записей: {Number(reportPreviewStats.selectedRows).toLocaleString("ru-RU")}</span>
          <span>
            Время выполнения: {reportPreviewStats.executionTime} (
            {Number(reportPreviewStats.executionMs).toLocaleString("ru-RU")} мс)
          </span>
          <span>Запрос: {Number(reportPreviewStats.queryExecutionMs ?? 0).toLocaleString("ru-RU")} мс</span>
          <span>
            Заполнение шаблона: {Number(reportPreviewStats.templateFillMs ?? 0).toLocaleString("ru-RU")} мс
          </span>
          <span>{reportPreviewPeriodLabel}</span>
        </div>
        <div className="report-preview-note report-preview-note-warning">
          Внимание: в режиме превью отображается не более 50 записей. Выгрузка по кнопке формирует полный Excel.
        </div>
        <div className="report-preview-viewer">
          {isReportPreviewLoading ? (
            <div className="report-preview-empty-state">Формируется Excel-отчет...</div>
          ) : reportPreviewError ? (
            <div className="report-preview-empty-state">{reportPreviewError}</div>
          ) : reportPreviewSheetRows.length === 0 ? (
            <div className="report-preview-empty-state">Нет данных для отображения</div>
          ) : (
            <table className="report-preview-table">
              <tbody>
                {reportPreviewSheetRows.map((row, rowIndex) => (
                  <tr key={`report-preview-row-${rowIndex}`}>
                    <td className="report-preview-row-number-cell">{rowIndex + 1}</td>
                    {Array.isArray(row)
                      ? row.map((cellValue, cellIndex) => (
                          <td
                            key={`report-preview-cell-${rowIndex}-${cellIndex}`}
                            style={
                              rowIndex >= Number(reportPreviewSheetMeta.dataRowStartRelative)
                                ? {
                                    textAlign:
                                      reportPreviewSheetMeta.columnAlignByAbsoluteCol[
                                        Number(reportPreviewSheetMeta.rangeStartCol) + cellIndex
                                      ] ?? "left"
                                  }
                                : undefined
                            }
                          >
                            {formatReportSqlResultCellValue(cellValue)}
                          </td>
                        ))
                      : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default memo(ReportCardPreviewTab);
