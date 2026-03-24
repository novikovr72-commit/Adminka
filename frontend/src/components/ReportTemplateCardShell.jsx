import { REPORT_CARD_TABS } from "../reportCardConstants";
import { IconCode, IconEye, IconSettings, IconSliders } from "./AppIcons";

/**
 * Шапка, кнопка закрытия и таббар карточки отчёта; содержимое вкладок — через children.
 */
export default function ReportTemplateCardShell({
  isReportCardVisible,
  isCreatingReportCard,
  reportMainSettingsDraft,
  selectedReport,
  handleCloseReportCardPanel,
  activeReportCardTab,
  selectReportCardTab,
  isReportPreviewTabAvailable,
  children
}) {
  return (
    <aside
      className={`employee-card-panel report-card-panel report-template-card-panel${
        isReportCardVisible ? " open" : ""
      }`}
    >
      <div className="employee-card-panel-header">
        <h2>Карточка отчета</h2>
        <div className="employee-card-full-name employee-card-full-name-header">
          {isCreatingReportCard
            ? String(reportMainSettingsDraft.name ?? "").trim() || "Новый отчет"
            : String(selectedReport?.name ?? "").trim() || "-"}
        </div>
        <button
          type="button"
          className="employee-card-close-button"
          onClick={handleCloseReportCardPanel}
          aria-label="Закрыть карточку отчета"
          data-tooltip="Закрыть"
        >
          ×
        </button>
      </div>
      <div className="employee-card-panel-body">
        <div className="report-card-tabs" role="tablist" aria-label="Вкладки карточки отчета">
          <button
            type="button"
            role="tab"
            aria-selected={activeReportCardTab === REPORT_CARD_TABS.MAIN}
            className={`report-card-tab${activeReportCardTab === REPORT_CARD_TABS.MAIN ? " active" : ""}`}
            onClick={() => selectReportCardTab(REPORT_CARD_TABS.MAIN)}
          >
            <IconSliders aria-hidden />
            <span>Основные настройки</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReportCardTab === REPORT_CARD_TABS.SQL}
            className={`report-card-tab${activeReportCardTab === REPORT_CARD_TABS.SQL ? " active" : ""}`}
            onClick={() => selectReportCardTab(REPORT_CARD_TABS.SQL)}
            disabled={isCreatingReportCard}
          >
            <IconCode aria-hidden />
            <span>SQL-скрипт</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReportCardTab === REPORT_CARD_TABS.TEMPLATE}
            className={`report-card-tab${activeReportCardTab === REPORT_CARD_TABS.TEMPLATE ? " active" : ""}`}
            onClick={() => selectReportCardTab(REPORT_CARD_TABS.TEMPLATE)}
            disabled={isCreatingReportCard}
          >
            <IconSettings aria-hidden />
            <span>Настройка шаблона</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeReportCardTab === REPORT_CARD_TABS.PREVIEW}
            className={`report-card-tab${activeReportCardTab === REPORT_CARD_TABS.PREVIEW ? " active" : ""}`}
            onClick={() => selectReportCardTab(REPORT_CARD_TABS.PREVIEW)}
            disabled={isCreatingReportCard || !isReportPreviewTabAvailable}
          >
            <IconEye aria-hidden />
            <span>Просмотр отчета</span>
          </button>
        </div>
        {children}
      </div>
    </aside>
  );
}
