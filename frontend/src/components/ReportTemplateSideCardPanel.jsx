import ReportCardMainTab from "./ReportCardMainTab";
import ReportCardPreviewTab from "./ReportCardPreviewTab";
import ReportCardSqlTab from "./ReportCardSqlTab";
import ReportCardTemplateTab from "./ReportCardTemplateTab";
import ReportTemplateCardShell from "./ReportTemplateCardShell";
import { REPORT_CARD_TABS } from "../reportCardConstants";

/**
 * Боковая карточка шаблона отчёта (оболочка + вкладки). Пропсы сгруппированы, чтобы не протаскивать плоский список из App.
 */
export default function ReportTemplateSideCardPanel({ shell, mainTab, sqlTab, templateTab, previewTab }) {
  const {
    isReportCardVisible,
    isCreatingReportCard,
    reportMainSettingsDraft,
    selectedReport,
    handleCloseReportCardPanel,
    activeReportCardTab,
    selectReportCardTab,
    isReportPreviewTabAvailable
  } = shell;

  return (
    <ReportTemplateCardShell
      isReportCardVisible={isReportCardVisible}
      isCreatingReportCard={isCreatingReportCard}
      reportMainSettingsDraft={reportMainSettingsDraft}
      selectedReport={selectedReport}
      handleCloseReportCardPanel={handleCloseReportCardPanel}
      activeReportCardTab={activeReportCardTab}
      selectReportCardTab={selectReportCardTab}
      isReportPreviewTabAvailable={isReportPreviewTabAvailable}
    >
      <ReportCardMainTab isActive={activeReportCardTab === REPORT_CARD_TABS.MAIN} {...mainTab} />
      <ReportCardSqlTab isActive={activeReportCardTab === REPORT_CARD_TABS.SQL} {...sqlTab} />
      <ReportCardTemplateTab isActive={activeReportCardTab === REPORT_CARD_TABS.TEMPLATE} {...templateTab} />
      <ReportCardPreviewTab isActive={activeReportCardTab === REPORT_CARD_TABS.PREVIEW} {...previewTab} />
    </ReportTemplateCardShell>
  );
}
