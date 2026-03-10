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
  label?: string;
  date?: number;
  featureLink?: FeatureLinkExGProperty;
  image?: ImageExGProperty;
}
