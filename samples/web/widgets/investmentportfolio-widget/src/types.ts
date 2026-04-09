export interface BffData {
  message: string;
  value: number;
}

export interface FeatureLinkExGProperty {
  webUrl: string;
  isWebUrlNewWindow?: boolean;
}

export interface ImageExGProperty {
  url: string;
  altText: string;
}

export interface InvestmentportfolioWidgetProps {
  /**
   * true = standalone (e.g. local dev); widget uses SDK theme and its own ThemeProvider.
   * false or omitted = embedded in host; widget accepts host theme and does not inject ThemeProvider.
   */
  standalone?: boolean;
  label?: string;
  date?: number;
  featureLink?: FeatureLinkExGProperty;
  image?: ImageExGProperty;
}
