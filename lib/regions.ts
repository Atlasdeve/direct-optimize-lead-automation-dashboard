import type { RegionConfig } from "@/lib/types";

export const regions: RegionConfig[] = [
  { name: "Canada", country: "Canada", timezone: "America/Toronto", morningCron: "0 9 * * *" },
  { name: "USA", country: "United States", timezone: "America/New_York", morningCron: "30 9 * * *" },
  { name: "UK", country: "United Kingdom", timezone: "Europe/London", morningCron: "0 9 * * *" },
  { name: "UAE", country: "United Arab Emirates", timezone: "Asia/Dubai", morningCron: "0 9 * * *" },
  { name: "Qatar", country: "Qatar", timezone: "Asia/Qatar", morningCron: "30 9 * * *" },
  { name: "Custom", country: "Custom", timezone: "UTC", morningCron: "0 10 * * *" }
];

export function getRegion(name: string) {
  return regions.find((region) => region.name === name) ?? regions[0];
}

export function getLocalTime(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date());
}
