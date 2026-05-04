function getCurrentWeekRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function currentWeekDateFilter(field = 'date') {
  const { start, end } = getCurrentWeekRange();
  return { [field]: { $gte: start, $lt: end } };
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekLabel(range = getCurrentWeekRange()) {
  const startLabel = range.start.toLocaleDateString('ar-SA');
  const endInclusive = new Date(range.end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const endLabel = endInclusive.toLocaleDateString('ar-SA');
  return `من الأحد ${startLabel} إلى السبت ${endLabel}`;
}

module.exports = {
  getCurrentWeekRange,
  currentWeekDateFilter,
  formatDateInput,
  formatWeekLabel
};
