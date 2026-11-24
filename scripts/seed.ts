import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { products } from "../db/schema";

// Sample products for an empty store: `floo run --service web -- npm run seed`.
// Never run on deploy. Images are in public/products/.
const SAMPLES = [
  { slug: "canvas-tote", name: "Canvas tote", priceCents: 2400, stock: 40, description: "Heavy natural canvas with a long strap. Holds a week of groceries or a laptop and a lunch." },
  { slug: "enamel-mug", name: "Enamel mug", priceCents: 1800, stock: 60, description: "A 12 oz steel mug with a speckled enamel finish, for the stove, the campfire, or the desk." },
  { slug: "linen-notebook", name: "Linen notebook", priceCents: 1600, stock: 80, description: "A5, 160 dot-grid pages, linen cover, lies flat." },
  { slug: "wool-socks", name: "Wool socks", priceCents: 1400, stock: 3, description: "Merino blend, cushioned sole. Three pairs left." },
  { slug: "ceramic-planter", name: "Ceramic planter", priceCents: 3200, stock: 25, description: "Glazed stoneware with a drainage hole and saucer, 6 inches across." },
  { slug: "cotton-cap", name: "Cotton cap", priceCents: 2200, stock: 0, description: "Six-panel washed cotton with a brass buckle. Back soon." },
].map((sample) => ({ ...sample, image: `/products/${sample.slug}.svg` }));

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Missing DATABASE_URL. Run through floo run --service web -- npm run seed.");
const client = postgres(url, { max: 1 });
try {
  const db = drizzle(client);
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    console.log("The store already has products; seed only fills an empty store.");
  } else {
    await db.insert(products).values(SAMPLES);
    console.log(`Added ${SAMPLES.length} sample products.`);
  }
} finally {
  await client.end();
}
