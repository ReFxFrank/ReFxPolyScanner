// Server-side aggregation: join markets + books + estimates into view-models.
// Imported only by route handlers (Node runtime).

import { buildMarketView, type MarketView } from "./flags";
import {
  getAllBooks,
  getEstimatesBySlug,
  getMarkets,
  type BookRow,
} from "./store";

export function allMarketViews(): MarketView[] {
  const markets = getMarkets();
  const estimates = getEstimatesBySlug();

  const booksBySlug = new Map<string, BookRow[]>();
  for (const b of getAllBooks()) {
    const list = booksBySlug.get(b.slug) ?? [];
    list.push(b);
    booksBySlug.set(b.slug, list);
  }

  return markets.map((m) =>
    buildMarketView(m, booksBySlug.get(m.slug) ?? [], estimates.get(m.slug))
  );
}
