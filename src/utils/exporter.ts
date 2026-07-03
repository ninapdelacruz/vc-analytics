/**
 * Helper utility to export data arrays to Excel-friendly CSV formats.
 * Includes a Byte Order Mark (BOM) to correctly display Spanish accents and special characters in Microsoft Excel.
 */
export function exportToCSV(data: any[], fileName: string, headers: string[]) {
  if (!data || !data.length) return;

  const csvRows = [headers.join(';')];
  
  data.forEach(row => {
    const values = Object.values(row).map(val => {
      const str = val === null || val === undefined ? '' : String(val);
      // Escape double quotes and wrap in quotes
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(';'));
  });

  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
