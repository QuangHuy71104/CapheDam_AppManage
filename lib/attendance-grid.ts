export type AttendanceGridField = 'morning' | 'afternoon';

export type PastedAttendanceCell = {
  dayOffset: number;
  field: AttendanceGridField;
  value: string;
};

/**
 * Maps a tab/newline-separated spreadsheet selection to the two attendance
 * columns. The first pasted cell is anchored at the focused attendance cell,
 * just like pasting into Google Sheets.
 */
export const parseAttendanceGrid = (
  value: string,
  startField: AttendanceGridField,
): PastedAttendanceCell[] => {
  const startColumn = startField === 'morning' ? 0 : 1;
  const rows = value.replace(/\r/g, '').split('\n');
  const result: PastedAttendanceCell[] = [];

  rows.forEach((row, rowIndex) => {
    // A final newline is commonly included when copying a range. It should
    // not clear an additional day in the attendance sheet.
    if (rowIndex === rows.length - 1 && row === '') {
      return;
    }

    row.split('\t').forEach((cell, columnIndex) => {
      const absoluteColumn = startColumn + columnIndex;
      result.push({
        dayOffset: rowIndex + Math.floor(absoluteColumn / 2),
        field: absoluteColumn % 2 === 0 ? 'morning' : 'afternoon',
        value: cell.trim(),
      });
    });
  });

  return result;
};
