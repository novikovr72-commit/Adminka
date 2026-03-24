import { memo } from "react";
import {
  REPORT_SQL_RESULTS_PREVIEW_LIMIT,
  REPORT_SQL_VIEW_MODES
} from "../reportCardConstants";
import {
  IconCheck,
  IconClose,
  IconCode,
  IconEye,
  IconMinus,
  IconPencil,
  IconPlus
} from "./AppIcons";
import { MemoizedReportSqlResultsContent } from "./ReportSqlResultsContent";

function ReportCardSqlTab({
  isActive,
  reportSqlViewMode,
  isReportSqlEditMode,
  reportSqlZoom,
  isReportSqlResultsLoading,
  isReportSqlResultsLoadingMore,
  reportSqlFontSizePx,
  reportSqlLineHeightPx,
  reportSqlActiveLineTopPx,
  reportSqlGutterRef,
  reportSqlHighlightRef,
  reportSqlEditorRef,
  reportSqlResultsWrapperRef,
  highlightedReportSql,
  reportSqlLineNumbers,
  reportSqlDraft,
  reportSqlCaretInfo,
  reportSqlResultsColumns,
  reportSqlResultsError,
  reportSqlResultsStats,
  sortedReportSqlResultsRows,
  setReportSqlDraft,
  handleOpenReportSqlEditorView,
  handleOpenReportSqlResultsView,
  handleEditOrSaveReportSql,
  handleCancelReportSqlEdit,
  handleDecreaseReportSqlZoom,
  handleIncreaseReportSqlZoom,
  handleReportSqlGutterClick,
  handleReportSqlEditorScroll,
  handleReportSqlResultsScroll,
  handleRefreshReportSqlResults,
  handleReportSqlResultsSortClick,
  updateReportSqlActiveLineFromTarget,
  getReportSqlResultsSortDirectionForField,
  getReportSqlResultsSortOrderForField,
  formatReportSqlResultCellValue
}) {
  return (
    <div
      className={`report-card-tab-content${isActive ? "" : " is-hidden"}`}
      role="tabpanel"
      hidden={!isActive}
    >
      <section className="employee-card-section report-card-sql-section">
        <div className="employee-card-subordination-header report-card-sql-header">
          <h3>SQL-скрипт</h3>
          <div className="report-card-sql-header-actions">
            {!isReportSqlEditMode ? (
              <>
                <button
                  type="button"
                  className={`panel-action-button report-card-sql-view-button${
                    reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR ? " is-active" : ""
                  }`}
                  onClick={handleOpenReportSqlEditorView}
                  disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR}
                >
                  <IconCode aria-hidden />
                  <span>Редактор</span>
                </button>
                <button
                  type="button"
                  className={`panel-action-button report-card-sql-view-button${
                    reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS ? " is-active" : ""
                  }`}
                  onClick={handleOpenReportSqlResultsView}
                  disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS}
                >
                  <IconEye aria-hidden />
                  <span>Результаты запроса</span>
                </button>
              </>
            ) : null}
            {reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR ? (
              isReportSqlEditMode ? (
                <>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleEditOrSaveReportSql}
                    disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                  >
                    <IconCheck aria-hidden />
                    <span>Сохранить</span>
                  </button>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleCancelReportSqlEdit}
                    disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                  >
                    <IconClose aria-hidden />
                    <span>Отменить</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="panel-action-button"
                  onClick={handleEditOrSaveReportSql}
                  disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                >
                  <IconPencil aria-hidden />
                  <span>Изменить скрипт</span>
                </button>
              )
            ) : null}
            <button
              type="button"
              className="panel-action-button report-card-sql-zoom-button"
              onClick={handleDecreaseReportSqlZoom}
              aria-label="Отдалить текст SQL"
              data-tooltip="Отдалить"
              disabled={reportSqlZoom <= 0.7}
            >
              <IconMinus aria-hidden />
            </button>
            <button
              type="button"
              className="panel-action-button report-card-sql-zoom-button"
              onClick={handleIncreaseReportSqlZoom}
              aria-label="Приблизить текст SQL"
              data-tooltip="Приблизить"
              disabled={reportSqlZoom >= 1.6}
            >
              <IconPlus aria-hidden />
            </button>
          </div>
        </div>
        <div className="report-card-sql-layout">
          <div className="report-card-sql-main">
            <div
              className={`report-card-sql-main-view${
                reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR ? "" : " is-hidden"
              }`}
            >
              {isReportSqlEditMode ? (
                <div
                  className="report-card-sql-editor-wrapper is-editing"
                  style={{
                    "--sql-font-size-px": `${reportSqlFontSizePx}px`,
                    "--sql-line-height-px": `${reportSqlLineHeightPx}px`
                  }}
                >
                  <div
                    className="report-card-sql-active-line"
                    style={{ top: `${reportSqlActiveLineTopPx}px` }}
                    aria-hidden="true"
                  />
                  <pre
                    ref={reportSqlGutterRef}
                    className="report-card-sql-gutter"
                    aria-hidden="true"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleReportSqlGutterClick}
                  >
                    {reportSqlLineNumbers}
                  </pre>
                  <pre
                    ref={reportSqlHighlightRef}
                    className="report-card-sql-highlight"
                    aria-hidden="true"
                  >
                    <code
                      className="language-sql"
                      dangerouslySetInnerHTML={{ __html: highlightedReportSql }}
                    />
                  </pre>
                  <textarea
                    ref={reportSqlEditorRef}
                    className="report-card-sql-editor"
                    aria-label="SQL query editor"
                    value={reportSqlDraft}
                    spellCheck={false}
                    onScroll={handleReportSqlEditorScroll}
                    onSelect={(event) => updateReportSqlActiveLineFromTarget(event.target)}
                    onKeyUp={(event) => updateReportSqlActiveLineFromTarget(event.target)}
                    onClick={(event) => updateReportSqlActiveLineFromTarget(event.target)}
                    onChange={(event) => {
                      setReportSqlDraft(event.target.value);
                      updateReportSqlActiveLineFromTarget(event.target);
                    }}
                  />
                </div>
              ) : (
                <pre
                  className="report-card-sql-code"
                  aria-label="SQL query with syntax highlighting"
                  style={{
                    "--sql-font-size-px": `${reportSqlFontSizePx}px`,
                    "--sql-line-height-px": `${reportSqlLineHeightPx}px`
                  }}
                >
                  <code
                    className="language-sql"
                    dangerouslySetInnerHTML={{ __html: highlightedReportSql }}
                  />
                </pre>
              )}
            </div>
            <div
              className={`report-card-sql-main-view${
                reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS ? "" : " is-hidden"
              }`}
            >
              <div
                className="report-sql-results-wrapper"
                ref={reportSqlResultsWrapperRef}
                onScroll={handleReportSqlResultsScroll}
                style={{
                  "--sql-font-size-px": `${reportSqlFontSizePx}px`,
                  "--sql-line-height-px": `${reportSqlLineHeightPx}px`
                }}
              >
                <MemoizedReportSqlResultsContent
                  isLoading={isReportSqlResultsLoading}
                  error={reportSqlResultsError}
                  columns={reportSqlResultsColumns}
                  rows={sortedReportSqlResultsRows}
                  getSortDirectionForField={getReportSqlResultsSortDirectionForField}
                  getSortOrderForField={getReportSqlResultsSortOrderForField}
                  onSortClick={handleReportSqlResultsSortClick}
                  formatCellValue={formatReportSqlResultCellValue}
                />
                {!isReportSqlResultsLoading && isReportSqlResultsLoadingMore && (
                  <div className="report-sql-results-loading-more">Загрузка следующих записей...</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="report-card-sql-actions">
          <div className="report-card-sql-actions-left">
            {reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS ? (
              <button
                type="button"
                className="panel-action-button"
                onClick={handleRefreshReportSqlResults}
                disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
              >
                {isReportSqlResultsLoading || isReportSqlResultsLoadingMore
                  ? "Обновление результатов..."
                  : "Обновить результаты"}
              </button>
            ) : null}
          </div>
          {reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR && (
            <div className="report-card-sql-actions-right">
              <span className="report-card-sql-caret-info">
                Строка: {reportSqlCaretInfo.line}, символ: {reportSqlCaretInfo.column}, позиция:{" "}
                {reportSqlCaretInfo.position}
              </span>
            </div>
          )}
          {reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS && (
            <div className="report-card-sql-actions-right">
              <span>
                Найдено записей: {Number(reportSqlResultsStats.selectedRows).toLocaleString("ru-RU")}, на экран выведены
                первые {REPORT_SQL_RESULTS_PREVIEW_LIMIT} (для проверки корректности запроса)
              </span>
              <span>
                Время выполнения: {reportSqlResultsStats.executionTime} (
                {Number(reportSqlResultsStats.executionMs).toLocaleString("ru-RU")} мс)
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default memo(ReportCardSqlTab);
