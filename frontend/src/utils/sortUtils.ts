/**
 * Generic sort helper for arrays of objects
 */
export function sortData<T>(
  data: T[],
  field: string,
  sortAsc: boolean,
  customExtractors?: Record<string, (item: T) => any>
): T[] {
  if (!field) return data;

  return [...data].sort((a: any, b: any) => {
    let valA = customExtractors && customExtractors[field] ? customExtractors[field](a) : a[field];
    let valB = customExtractors && customExtractors[field] ? customExtractors[field](b) : b[field];

    if (valA === null || valA === undefined) valA = sortAsc ? Infinity : -Infinity;
    if (valB === null || valB === undefined) valB = sortAsc ? Infinity : -Infinity;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    const numA = Number(valA);
    const numB = Number(valB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return sortAsc ? numA - numB : numB - numA;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });
}
