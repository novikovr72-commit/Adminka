import { memo } from "react";
import ReportSettingsDataTable from "./ReportSettingsDataTable";
import ReportTemplateSideCardPanel from "./ReportTemplateSideCardPanel";

/**
 * Экран «Настройка отчётов»: список (таблица) + боковая карточка шаблона.
 */
function ReportSettingsPage({
  isSideCardVisible,
  tableWrapperRef,
  dataTableProps,
  sideCardGroups
}) {
  return (
    <div
      className={`list-content-layout${isSideCardVisible ? " split-view" : ""} report-settings-layout`}
    >
      <div className="list-content-main">
        <ReportSettingsDataTable tableWrapperRef={tableWrapperRef} {...dataTableProps} />
      </div>
      <ReportTemplateSideCardPanel
        shell={sideCardGroups.shell}
        mainTab={sideCardGroups.mainTab}
        sqlTab={sideCardGroups.sqlTab}
        templateTab={sideCardGroups.templateTab}
        previewTab={sideCardGroups.previewTab}
      />
    </div>
  );
}

export default memo(ReportSettingsPage);
