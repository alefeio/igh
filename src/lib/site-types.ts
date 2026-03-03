/** Tipos públicos do site (usados no layout e em componentes client). */

export type MenuItemPublic = {
  id: string;
  label: string;
  href: string;
  order: number;
  isExternal: boolean;
  children: MenuItemPublic[];
};

export type SiteSettingsPublic = {
  siteName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addresses: { line: string; city: string; state: string; zip: string }[];
  businessHours: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;
  seoTitleDefault: string | null;
  seoDescriptionDefault: string | null;
};
