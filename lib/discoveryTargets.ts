export const businessDiscoveryCategories = [
  "restaurants",
  "tire shops",
  "dentists",
  "spas",
  "salons",
  "real estate agencies",
  "law firms",
  "roofing contractors",
  "plumbers",
  "electricians",
  "HVAC contractors",
  "auto repair shops",
  "cleaning services",
  "landscaping companies",
  "chiropractors",
  "physiotherapy clinics",
  "veterinary clinics",
  "accounting firms",
  "insurance agencies",
  "mortgage brokers",
  "fitness studios",
  "daycare centers",
  "pest control companies",
  "moving companies",
  "home renovation contractors"
];

const regionCities: Record<string, string[]> = {
  Canada: ["Toronto", "Vancouver", "Calgary", "Ottawa", "Montreal", "Edmonton", "Winnipeg", "Mississauga", "Brampton", "Hamilton"],
  USA: ["Austin", "Dallas", "Phoenix", "Miami", "Atlanta", "Chicago", "Houston", "Los Angeles", "New York", "Seattle"],
  UK: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Liverpool", "Bristol", "Sheffield", "Edinburgh", "Cardiff"],
  UAE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Al Ain"],
  Qatar: ["Doha", "Al Rayyan", "Al Wakrah", "Lusail", "Al Khor", "Umm Salal"],
  Pakistan: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta"],
  India: ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Ahmedabad", "Kolkata"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra"],
  Germany: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Dusseldorf"],
  France: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Bordeaux"],
  Singapore: ["Singapore"],
  Saudi: ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar"]
};

function hashValue(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function dayNumber(dateKey?: string) {
  const date = dateKey ? new Date(`${dateKey}T00:00:00Z`) : new Date();
  return Math.floor(date.getTime() / 86400000);
}

export function getCityOptionsForRegion(regionName: string, country?: string) {
  const direct = regionCities[regionName] ?? (country ? regionCities[country] : undefined);
  if (direct?.length) return direct;
  return [country || regionName];
}

export function getDefaultCityForRegion(regionName: string, country?: string) {
  return getCityOptionsForRegion(regionName, country)[0] ?? regionName;
}

export function getDailyAutomationTarget(regionName: string, country?: string, dateKey?: string) {
  const cities = getCityOptionsForRegion(regionName, country);
  const offset = hashValue(regionName);
  const index = dayNumber(dateKey) + offset;
  const category = businessDiscoveryCategories[index % businessDiscoveryCategories.length];
  const city = cities[index % cities.length] || country || regionName;
  return {
    city,
    categories: [category],
    niche: category,
    cityOptions: cities,
    rotationDay: index
  };
}
