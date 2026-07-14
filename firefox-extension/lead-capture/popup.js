const defaultAppUrl = "https://web-production-f4713.up.railway.app";
const fields = ["appUrl", "apiKey", "companyName", "category", "email", "phone", "city", "website"];

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

function extractFromPage() {
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

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function runExtraction() {
  const tab = await getActiveTab();
  if (!tab?.id || !/^https?:/i.test(tab.url || "")) throw new Error("Open a normal website tab first.");
  const [data] = await browser.tabs.executeScript(tab.id, { code: `(${extractFromPage.toString()})()` });
  return data;
}

async function loadSettings() {
  const stored = await browser.storage.local.get(["appUrl", "apiKey", "region"]);
  $("appUrl").value = stored.appUrl || defaultAppUrl;
  $("apiKey").value = stored.apiKey || "";
  return stored;
}

async function saveSettings() {
  await browser.storage.local.set({
    appUrl: normalizeAppUrl($("appUrl").value),
    apiKey: $("apiKey").value.trim(),
    region: $("region").value
  });
  setStatus("Settings saved.", "success");
}

async function loadRegions(appUrl, preferredRegion) {
  const response = await fetch(`${appUrl}/api/regions`);
  if (!response.ok) throw new Error("Could not load countries from dashboard.");
  const data = await response.json();
  const regions = Array.isArray(data.regions) ? data.regions : [];
  const select = $("region");
  select.innerHTML = "";
  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.name;
    option.textContent = region.name;
    select.appendChild(option);
  });
  if (preferredRegion && regions.some((region) => region.name === preferredRegion)) select.value = preferredRegion;
}

async function prefill() {
  try {
    const settings = await loadSettings();
    const appUrl = normalizeAppUrl(settings.appUrl);
    await loadRegions(appUrl, settings.region);
    const extracted = await runExtraction();
    $("companyName").value = extracted.companyName || "";
    $("category").value = extracted.category || "Website lead";
    $("email").value = extracted.email || "";
    $("phone").value = extracted.phone || "";
    $("website").value = extracted.website || "";
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
      website: $("website").value.trim()
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
    await browser.storage.local.set({ appUrl, apiKey, region: payload.region });
    setStatus(data.created ? `Lead created: ${data.lead.company_name}` : `Lead already exists: ${data.lead.company_name}`, "success");
  } catch (error) {
    setStatus(error.message || "Lead could not be created.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("saveSettings").addEventListener("click", saveSettings);
  $("capture").addEventListener("click", createLead);
  fields.forEach((field) => $(field)?.addEventListener("change", () => setStatus("")));
  void prefill();
});
