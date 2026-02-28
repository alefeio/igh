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
  contactEmail: string | null;
  contactPhone: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialYoutube: string | null;
  socialLinkedin: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
};
