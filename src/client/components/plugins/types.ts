export type MarketplacePlugin = {
  id: string;
  name: string;
  description: string;
  author: string;
  iconUrl: string;
  category: string;
  installed: boolean;
};

export type MarketplaceSection = {
  id: string;
  title: string;
  pluginIds: string[];
};

export type MarketplaceCatalog = {
  discover: string[];
  sections: MarketplaceSection[];
  plugins: Record<string, MarketplacePlugin>;
};

export type CustomMarketplace = {
  id: string;
  name: string;
  url: string;
};
