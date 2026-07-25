export const adultLeadCategories = [
  { id: "adult_products", label: "Adult products", query: '"adult store" OR "sex toy shop" OR "adult products"', placesQuery: "adult store sex toy shop" },
  { id: "sexual_wellness", label: "Sexual wellness", query: '"sexual wellness clinic" OR "intimate wellness" OR "sexual health retailer"', placesQuery: "sexual wellness clinic" },
  { id: "dating_platforms", label: "Dating platforms", query: '"dating app" OR "dating site" OR "matchmaking service"', placesQuery: "dating matchmaking service" },
  { id: "adult_entertainment", label: "Adult entertainment", query: '"adult entertainment venue" OR "gentlemen club" OR "nightclub"', placesQuery: "adult entertainment nightclub" },
  { id: "casino", label: "Casino and gaming", query: '"casino" OR "gaming venue"', placesQuery: "casino gaming venue" },
  { id: "betting", label: "Betting businesses", query: '"sportsbook" OR "betting company" OR "betting shop"', placesQuery: "sportsbook betting shop" },
  { id: "cannabis", label: "Cannabis retailers", query: '"cannabis dispensary" OR "marijuana dispensary" OR "cannabis shop"', placesQuery: "cannabis marijuana dispensary" }
] as const;

export type AdultLeadCategoryId = (typeof adultLeadCategories)[number]["id"];

export function adultLeadCategory(categoryId: string) {
  return adultLeadCategories.find((category) => category.id === categoryId) ?? null;
}
