import type { Company } from '@/hooks/useCompany';

export interface CompanyDocumentData {
  name: string;
  legalName: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  receiptFooter: string | null;
}

const cleanValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function getCompanyDocumentData(company?: Partial<Company> | null): CompanyDocumentData {
  return {
    name: cleanValue(company?.name) || 'Caixa da FER',
    legalName: cleanValue(company?.legal_name),
    cnpj: cleanValue(company?.cnpj),
    email: cleanValue(company?.email),
    phone: cleanValue(company?.phone),
    address: cleanValue(company?.address),
    logoUrl: cleanValue(company?.logo_url),
    receiptFooter: cleanValue(company?.receipt_footer),
  };
}

export function getCompanyLegalLine(company: CompanyDocumentData): string | null {
  if (!company.legalName || company.legalName === company.name) return null;
  return company.legalName;
}

export function getCompanyContactLine(company: CompanyDocumentData): string | null {
  const parts = [
    company.phone ? `Tel: ${company.phone}` : null,
    company.email,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' • ') : null;
}

export function getCompanyHeaderLines(company: CompanyDocumentData): string[] {
  const lines = [
    company.cnpj ? `CNPJ: ${company.cnpj}` : null,
    getCompanyContactLine(company),
    company.address,
  ].filter(Boolean);

  return lines as string[];
}

export function getCompanyFooterLines(company: CompanyDocumentData): string[] {
  const lines = [company.receiptFooter, getCompanyContactLine(company)].filter(Boolean) as string[];
  const uniqueLines = Array.from(new Set(lines));
  return uniqueLines.length > 0 ? uniqueLines : [company.name];
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}