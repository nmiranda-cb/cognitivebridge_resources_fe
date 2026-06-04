export interface SignatureValues {
  fullName: string;
  headline: string;
  linkedin: string;
  logoUrl: string;
  phone: string;
  tagline: string;
  website: string;
}

export const defaultLogoUrl =
  "https://cognitivebridge.cl/brand/logo/cognitivebridge-logo-horizontal-primary.png";

export const signatureLogoWidth = 168;

export const defaultSignatureValues: SignatureValues = {
  fullName: "Nicolás Patricio Miranda Contreras",
  headline: "CTO | CognitiveBridge",
  linkedin: "https://www.linkedin.com/in/npmirandac/",
  logoUrl: defaultLogoUrl,
  phone: "+56 9 6761 5909",
  tagline:
    "Tu partner tecnológico en AI, software y estrategia para acelerar empresas.",
  website: "https://cognitivebridge.cl",
};

const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&"'<>]/g,
    (character) => htmlEscapeMap[character] ?? character,
  );
}

function normalizeUrl(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  return `https://${normalizedValue}`;
}

function normalizePhoneHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");

  return digits ? `tel:${digits}` : "";
}

function getWebsiteLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "");
  }
}

function optionalLink(label: string, href: string) {
  if (!label || !href) {
    return "";
  }

  return `<a href="${escapeHtml(href)}" target="_blank" style="color: #1b6a8f; text-decoration: none;">${escapeHtml(label)}</a>`;
}

export function getSignatureLogoUrl(values: SignatureValues) {
  return normalizeUrl(values.logoUrl) || defaultLogoUrl;
}

export function buildSignatureHtml(values: SignatureValues) {
  const websiteUrl = normalizeUrl(values.website);
  const linkedinUrl = normalizeUrl(values.linkedin);
  const logoUrl = getSignatureLogoUrl(values);
  const phoneHref = normalizePhoneHref(values.phone);
  const contactLinks = [
    optionalLink(getWebsiteLabel(websiteUrl), websiteUrl),
    values.phone
      ? `<a href="${escapeHtml(phoneHref)}" style="color: #1b6a8f; text-decoration: none;">${escapeHtml(values.phone)}</a>`
      : "",
    optionalLink("LinkedIn", linkedinUrl),
  ].filter(Boolean);

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family: Arial, Helvetica, sans-serif; color: #172033; line-height: 1.35;">
  <tr>
    <td style="padding: 0 18px 0 0; vertical-align: middle;">
      <a href="${escapeHtml(websiteUrl || "https://cognitivebridge.cl")}" target="_blank" style="text-decoration: none;">
        <img src="${escapeHtml(logoUrl)}" alt="CognitiveBridge" width="${signatureLogoWidth}" style="display: block; width: ${signatureLogoWidth}px; max-width: ${signatureLogoWidth}px; height: auto; border: 0;" />
      </a>
    </td>
    <td style="width: 1px; background: #d7dde8;"></td>
    <td style="padding: 0 0 0 18px; vertical-align: middle;">
      <div style="font-size: 15px; font-weight: 700; color: #172033; margin: 0 0 2px 0;">${escapeHtml(values.fullName)}</div>
      <div style="font-size: 13px; color: #33516b; margin: 0 0 8px 0;">${escapeHtml(values.headline)}</div>
      <div style="font-size: 12.5px; color: #4c5f73; margin: 0 0 8px 0;">${escapeHtml(values.tagline)}</div>
      <div style="font-size: 12.5px; color: #4c5f73; margin: 0;">${contactLinks.join('<span style="color: #9aa7b5;"> | </span>')}</div>
    </td>
  </tr>
</table>`;
}
