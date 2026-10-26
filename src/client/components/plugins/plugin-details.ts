import pluginDetailsDataset from "./plugin-details-dataset.json";

export type PluginDetails = {
  id: string;
  name: string;
  author: string;
  shortDescription: string;
  overview: string;
  iconUrl?: string | null;
  capabilities: string;
  developer: string;
  category: string;
  version: string;
  websiteUrl: string;
  privacyUrl: string;
  termsUrl: string;
  prompts: string[];
  apps: Array<{ name: string; description: string }>;
  skills: Array<{ name: string; description: string }>;
};

const DETAILS = pluginDetailsDataset as unknown as Record<string, PluginDetails>;

export function pluginDetails(pluginId: string): PluginDetails | null {
  return DETAILS[pluginId] ?? null;
}
