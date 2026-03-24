/** Мост между строкой действий в App и ReferenceBookDataPage (данные справочника). */

let handlers = {
  clearFilters: () => {},
  alignColumns: () => {},
  openAdd: () => {},
  openColumnSettings: () => {},
  exportFile: async () => {
    throw new Error("Экспорт не настроен");
  }
};

export function registerReferenceBookDataHeaderHandlers(next) {
  handlers = {
    clearFilters: typeof next.clearFilters === "function" ? next.clearFilters : () => {},
    alignColumns: typeof next.alignColumns === "function" ? next.alignColumns : () => {},
    openAdd: typeof next.openAdd === "function" ? next.openAdd : () => {},
    openColumnSettings: typeof next.openColumnSettings === "function" ? next.openColumnSettings : () => {},
    exportFile: typeof next.exportFile === "function" ? next.exportFile : handlers.exportFile
  };
}

export function invokeReferenceBookDataClearFilters() {
  handlers.clearFilters();
}

export function invokeReferenceBookDataAlignColumns() {
  handlers.alignColumns();
}

export function invokeReferenceBookDataOpenAdd() {
  handlers.openAdd();
}

export function invokeReferenceBookDataOpenColumnSettings() {
  handlers.openColumnSettings();
}

export async function invokeReferenceBookDataExportFile() {
  return handlers.exportFile();
}
