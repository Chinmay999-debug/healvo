const ATTRIBUTION_KEY = "healvo_attribution";

export interface AttributionData {
  source: "meta" | "referral" | "direct" | "unknown";
  medium?: string;
  campaign?: string;
  ad_set?: string;
  ad?: string;
  fbclid?: string;
  landing_page: string;
  first_touch_at: string;
}

export function captureAttribution() {
  if (typeof window === "undefined") return;

  // Do not overwrite if we already have first-touch attribution
  if (localStorage.getItem(ATTRIBUTION_KEY)) return;

  const urlParams = new URLSearchParams(window.location.search);
  
  const fbclid = urlParams.get("fbclid");
  const utm_source = urlParams.get("utm_source");
  const utm_medium = urlParams.get("utm_medium");
  const utm_campaign = urlParams.get("utm_campaign");
  const utm_content = urlParams.get("utm_content");
  const utm_term = urlParams.get("utm_term");
  
  let source: "meta" | "referral" | "direct" | "unknown" = "unknown";
  
  const isMeta = fbclid || 
    (utm_source && (
      utm_source.toLowerCase().includes("meta") || 
      utm_source.toLowerCase().includes("facebook") || 
      utm_source.toLowerCase().includes("ig") || 
      utm_source.toLowerCase().includes("instagram") ||
      utm_source.toLowerCase().includes("fb")
    ));

  if (isMeta) {
    source = "meta";
  } else if (utm_source) {
    source = "referral";
  } else if (document.referrer) {
    if (document.referrer.includes("healvo.in")) {
      source = "direct";
    } else {
      source = "referral";
    }
  } else {
    source = "direct";
  }

  const attribution: AttributionData = {
    source,
    medium: utm_medium || undefined,
    campaign: utm_campaign || undefined,
    ad_set: utm_term || undefined,
    ad: utm_content || undefined,
    fbclid: fbclid || undefined,
    landing_page: window.location.href,
    first_touch_at: new Date().toISOString(),
  };

  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
}

export function getAttribution(): AttributionData | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(ATTRIBUTION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

export function clearAttribution() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ATTRIBUTION_KEY);
}
