export const settingsNav = [
  { name: 'General' },
  { name: 'Notifications' },
  { name: 'Account' },
  { name: 'Privacy' },
  { name: 'Billing' },
  { name: 'Capabilities' },
  { name: 'Connectors' },
  { name: 'Clauxen Code' },
] as const;

export type SettingsTab = (typeof settingsNav)[number]['name'];

export const fontThemes = [
  { name: 'Default', serif: true },
  { name: 'Sans', serif: false },
  { name: 'System', serif: false },
  { name: 'Dyslexic friendly', dyslexic: true },
];

export const accentColors = [
  { name: 'Blue', value: '#1b67b2' },
  { name: 'Forest', value: '#42634f' },
  { name: 'Amber', value: '#c88326' },
  { name: 'Rose', value: '#b85f75' },
];

export const voiceOptions = ['Ember', 'Lumen', 'Cedar', 'Sol'];

export const notificationDeliveryOptions = ['Off', 'Push', 'Email', 'Push, Email'];
