const defaultAppUrl = "https://web-production-f4713.up.railway.app";
const fields = ["appUrl", "apiKey", "companyName", "category", "email", "phone", "city", "website"];
const fallbackRegions = ["Canada", "USA", "UK", "UAE", "Qatar", "Custom"];

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, type = "") {
  const node = $("status");
  node.textContent = message;
  node.className = type;
}

function normalizeAppUrl(value) {
  return (value || defaultAppUrl).replace(/\/+$/, "");
}

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(value) {
  return chrome.storage.local.set(value);
}

function queryActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);
}

function extractFromPage() {
  const cleanText = (value) => (value || "").replace(/\s+/g, " ").trim();
  const absoluteUrl = (value) => {
    try {
      return new URL(value, location.href).href;
    } catch {
      return "";
    }
  };
  const externalUrlFromAnchor = (anchor) => {
    const href = absoluteUrl(anchor?.getAttribute("href") || "");
    if (!href) return "";
    try {
      const url = new URL(href);
      if (url.hostname.includes("yelp.") && url.pathname.includes("/biz_redir")) {
        return url.searchParams.get("url") || "";
      }
      if (!url.hostname.includes("yelp.")) return url.href;
    } catch {
      return "";
    }
    return "";
  };
  const meta = (name) => document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.content?.trim() || "";
  const text = document.body?.innerText || "";
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/)?.[0] || "";
  const schemaName = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => {
      try {
        const data = JSON.parse(script.textContent || "{}");
        const item = Array.isArray(data) ? data[0] : data["@graph"]?.[0] || data;
        return item?.name || "";
      } catch {
        return "";
      }
    })
    .find(Boolean) || "";
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const heading = document.querySelector("h1")?.textContent?.trim() || "";
  const companyName = meta("og:site_name") || schemaName || heading || document.title.replace(/\s[-|].*$/, "").trim();
  const keywords = meta("keywords").split(",").map((item) => item.trim()).filter(Boolean);
  if (location.hostname.includes("yelp.") && location.pathname.includes("/biz/")) {
    const anchors = [...document.querySelectorAll("a[href]")];
    const website = anchors.map(externalUrlFromAnchor).find(Boolean) || canonical;
    const ratingText = cleanText(document.querySelector('[aria-label*="star rating"]')?.getAttribute("aria-label") || "");
    const reviewText = cleanText(text.match(/\b\d[\d,]*\s+reviews?\b/i)?.[0] || "");
    const categories = anchors
      .filter((anchor) => /\/search\?cflt=|\/c\//.test(anchor.getAttribute("href") || ""))
      .map((anchor) => cleanText(anchor.textContent))
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, 3);
    const addressMatch = cleanText(text.match(/\d{1,6}\s+.+?,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?/i)?.[0] || "");
    const cityMatch = addressMatch.match(/,\s*([^,]+?),?\s+[A-Z]{2}\s+\d{5}/i) || addressMatch.match(/\b([A-Za-z][A-Za-z .'-]+),?\s+[A-Z]{2}\s+\d{5}/);
    const pagePhone = text.match(/\(\d{3}\)\s*\d{3}[-\s]\d{4}/)?.[0] || phone;
    return {
      companyName,
      pageTitle: document.title,
      description: [
        "Imported from Yelp profile.",
        ratingText || null,
        reviewText || null,
        addressMatch ? `Address: ${addressMatch}` : null,
        `Yelp URL: ${canonical}`
      ].filter(Boolean).join(" "),
      website,
      email,
      phone: pagePhone,
      category: categories.join(", ") || keywords[0] || "Yelp lead",
      city: cityMatch?.[1]?.trim() || ""
    };
  }
  return {
    companyName,
    pageTitle: document.title,
    description: meta("description") || meta("og:description"),
    website: canonical,
    email,
    phone,
    category: keywords[0] || meta("og:type") || "Website lead"
  };
}

async function runExtraction() {
  const tab = await queryActiveTab();
  if (!tab?.id || !/^https?:/i.test(tab.url || "")) throw new Error("Open a normal website tab first.");
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractFromPage
  });
  return result?.result || {};
}

async function loadSettings() {
  const stored = await storageGet(["appUrl", "apiKey", "region"]);
  $("appUrl").value = stored.appUrl || defaultAppUrl;
  $("apiKey").value = stored.apiKey || "";
  return stored;
}

async function saveSettings() {
  await storageSet({
    appUrl: normalizeAppUrl($("appUrl").value),
    apiKey: $("apiKey").value.trim(),
    region: $("region").value
  });
  setStatus("Settings saved.", "success");
}

async function loadRegions(appUrl, preferredRegion) {
  let regions = [];
  try {
    const response = await fetch(`${appUrl}/api/extension/regions`);
    if (!response.ok) throw new Error("Could not load countries from dashboard.");
    const data = await response.json();
    regions = Array.isArray(data.regions) ? data.regions : [];
  } catch {
    regions = fallbackRegions.map((name) => ({ name }));
    setStatus("Using default countries. Check Dashboard URL if your custom countries are missing.");
  }
  const select = $("region");
  select.innerHTML = "";
  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.name;
    option.textContent = region.name;
    select.appendChild(option);
  });
  if (preferredRegion && regions.some((region) => region.name === preferredRegion)) select.value = preferredRegion;
  if (!select.value && regions[0]?.name) select.value = regions[0].name;
}

function fillExtractedFields(extracted) {
  $("companyName").value = extracted.companyName || "";
  $("category").value = extracted.category || "Website lead";
  $("email").value = extracted.email || "";
  $("phone").value = extracted.phone || "";
  $("city").value = extracted.city || "";
  $("website").value = extracted.website || "";
  $("companyName").dataset.pageTitle = extracted.pageTitle || "";
  $("companyName").dataset.description = extracted.description || "";
}

async function initializePopup() {
  try {
    const settings = await loadSettings();
    const appUrl = normalizeAppUrl(settings.appUrl);
    await loadRegions(appUrl, settings.region);
    setStatus("Ready. Click Extract current page when you want to read the open website.");
  } catch (error) {
    setStatus(error.message || "Could not load extension settings.", "error");
  }
}

async function extractCurrentPage() {
  try {
    const extracted = await runExtraction();
    fillExtractedFields(extracted);
    setStatus("Page data extracted. Review and create the lead.");
  } catch (error) {
    setStatus(error.message || "Could not extract this page.", "error");
  }
}

async function createLead() {
  try {
    const appUrl = normalizeAppUrl($("appUrl").value);
    const apiKey = $("apiKey").value.trim();
    if (!apiKey) throw new Error("Add your capture API key first.");
    const payload = {
      region: $("region").value,
      companyName: $("companyName").value.trim(),
      category: $("category").value.trim() || "Website lead",
      email: $("email").value.trim() || null,
      phone: $("phone").value.trim() || null,
      city: $("city").value.trim() || null,
      website: $("website").value.trim(),
      pageTitle: $("companyName").dataset.pageTitle || null,
      description: $("companyName").dataset.description || null
    };
    const response = await fetch(`${appUrl}/api/extension/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Lead could not be created.");
    await storageSet({ appUrl, apiKey, region: payload.region });
    const gmbMessage = data.gmbMatched ? " Google Business Profile found." : data.created ? " No confident Google Business Profile match found." : "";
    setStatus(data.created ? `Lead created: ${data.lead.company_name}.${gmbMessage}` : `Lead already exists: ${data.lead.company_name}`, "success");
  } catch (error) {
    setStatus(error.message || "Lead could not be created.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("saveSettings").addEventListener("click", saveSettings);
  $("extract").addEventListener("click", extractCurrentPage);
  $("capture").addEventListener("click", createLead);
  fields.forEach((field) => $(field)?.addEventListener("change", () => setStatus("")));
  void initializePopup();
});
