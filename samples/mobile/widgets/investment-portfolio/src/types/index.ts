export interface PortfolioItem {
  id: string;
  label: string;
  percentage: number;
  color: string;
}

export interface PortfolioAllocationItem {
  totalValue: number;
  allocations: PortfolioItem[];
}
