export interface PresentationOptions {
  locale?: string;        // "pt-BR", "en-US"
  timezone?: string;      // "America/Sao_Paulo"
  dateStyle?: "short" | "medium" | "long";
  includeTime?: boolean;
  currencyCode?: string;  // "BRL", "USD"
}