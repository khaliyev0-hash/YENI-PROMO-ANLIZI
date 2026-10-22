export const isPromoTypeMatch = (
  itemOrCode: any,
  promoTypeFilter?: string,
  productMap?: Record<string, string>
): boolean => {
  if (!promoTypeFilter || promoTypeFilter === 'ALL') return true;

  let typeVal = '';
  if (itemOrCode && typeof itemOrCode === 'object') {
    typeVal = itemOrCode.promo_type || (itemOrCode.code && productMap ? productMap[itemOrCode.code] : '') || '';
  } else if (typeof itemOrCode === 'string') {
    if (productMap && productMap[itemOrCode]) {
      typeVal = productMap[itemOrCode];
    } else if (
      itemOrCode.toLowerCase() === 'tesir' ||
      itemOrCode.toLowerCase() === 'teshir' ||
      itemOrCode.toLowerCase() === 'adi'
    ) {
      typeVal = itemOrCode;
    }
  }

  const normFilter = promoTypeFilter.trim().toLowerCase();
  const normVal = typeVal.trim().toLowerCase();

  // If item doesn't have an explicit promo_type, treat as 'adi' (standard promo)
  const effectiveVal = normVal || 'adi';

  if (
    normFilter === 'tesir' ||
    normFilter === 'teshir' ||
    normFilter.includes('tesir') ||
    normFilter.includes('teshir')
  ) {
    return (
      effectiveVal.includes('tesir') ||
      effectiveVal.includes('teshir') ||
      effectiveVal.includes('təsir') ||
      effectiveVal.includes('teşhir')
    );
  }

  if (normFilter === 'adi' || normFilter.includes('adi')) {
    return (
      effectiveVal.includes('adi') &&
      !effectiveVal.includes('tesir') &&
      !effectiveVal.includes('teshir')
    );
  }

  return true;
};
