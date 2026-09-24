#!/usr/bin/env node
/**
 * Import every post, page, and category from a live WordPress site into
 * this Eleventy project, using WordPress's built-in REST API (no plugin
 * or export step needed on the WordPress side — it's on by default).
 *
 * Usage:
 *   npm install
 *   node scripts/import-from-wordpress.js
 *
 * Configure the source site below, or pass it as an argument:
 *   node scripts/import-from-wordpress.js https://globalinvestmentreviews.com
 *
 * What it does:
 *   1. Reads /wp-json/wp/v2/categories — rebuilds src/_data/category-entries/*.json
 *      (safe to re-run: it will not delete categories you've since edited by hand
 *      unless the same slug comes back from WordPress with new content)
 *   2. Reads /wp-json/wp/v2/pages — writes src/pages/<slug>.md
 *   3. Reads /wp-json/wp/v2/posts — writes src/posts/<slug>.md, mapping each
 *      post's WordPress category to this project's nested category slug
 *
 * Images are kept as links to their original hosted URLs (WordPress uploads /
 * your CDN) rather than downloaded, so the site keeps working immediately.
 * You can swap them for local copies later if you want full independence
 * from the old host.
 */

const fs = require("fs");
const path = require("path");

const SOURCE = (process.argv[2] || "https://globalinvestmentreviews.com").replace(/\/$/, "");
const ROOT = path.join(__dirname, "..");
const CATEGORY_DIR = path.join(ROOT, "src/_data/category-entries");
const POSTS_DIR = path.join(ROOT, "src/posts");
const PAGES_DIR = path.join(ROOT, "src/pages");

let Turndown;
try {
  Turndown = require("turndown");
} catch (e) {
  console.error(
    "\nMissing dependency 'turndown'. Run `npm install` first (it's listed in package.json).\n"
  );
  process.exit(1);
}

const turndown = new Turndown({ headingStyle: "atx", codeBlockStyle: "fenced" });
// Table Of Contents blocks and "share" widgets some WP themes inject aren't
// useful in a markdown file — drop common ones.
turndown.remove(["script", "style", "nav"]);

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripHtml(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function yamlString(value) {
  // Safe-ish YAML double-quoted scalar for our frontmatter.
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function fetchAllPages(endpoint) {
  const results = [];
  let page = 1;
  while (true) {
    const url = `${SOURCE}/wp-json/wp/v2/${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}&_embed=1`;
    const res = await fetch(url);
    if (res.status === 400 && page > 1) break; // WP returns 400 past the last page
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    results.push(...batch);
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
    if (page >= totalPages) break;
    page += 1;
  }
  return results;
}

async function importCategories() {
  console.log(`\nFetching categories from ${SOURCE} ...`);
  const wpCategories = await fetchAllPages("categories");
  console.log(`  found ${wpCategories.length} categories`);

  const byId = new Map(wpCategories.map((c) => [c.id, c]));

  function fullSlug(cat) {
    const parts = [cat.slug];
    let current = cat;
    while (current.parent && byId.has(current.parent)) {
      current = byId.get(current.parent);
      parts.unshift(current.slug);
    }
    return parts.join("/");
  }

  fs.mkdirSync(CATEGORY_DIR, { recursive: true });

  const slugMap = new Map(); // wpId -> our full slug
  let order = 1;
  for (const cat of wpCategories) {
    if (cat.count === 0 && cat.slug === "uncategorized") continue;
    const slug = fullSlug(cat);
    const parentSlug = cat.parent && byId.has(cat.parent) ? fullSlug(byId.get(cat.parent)) : null;
    slugMap.set(cat.id, slug);

    const entry = {
      slug,
      title: decodeEntities(cat.name),
      parent: parentSlug,
      order: order++,
    };
    const filename = slug.replace(/\//g, "--") + ".json";
    fs.writeFileSync(path.join(CATEGORY_DIR, filename), JSON.stringify(entry, null, 2));
  }

  console.log(`  wrote ${slugMap.size} category files to src/_data/category-entries/`);
  return slugMap;
}

function pickCategorySlug(post, slugMap) {
  // A post may carry several WordPress category IDs (e.g. a parent and its
  // child). Prefer the most specific one — the one that isn't a parent of
  // any of the others assigned to this post.
  const ids = (post.categories || []).filter((id) => slugMap.has(id));
  if (ids.length === 0) return null;
  const slugs = ids.map((id) => slugMap.get(id));
  slugs.sort((a, b) => b.split("/").length - a.split("/").length);
  return slugs[0];
}

function featuredImage(post) {
  const media = post._embedded && post._embedded["wp:featuredmedia"] && post._embedded["wp:featuredmedia"][0];
  if (!media || !media.source_url) return { url: null, alt: "" };
  return {
    url: media.source_url,
    alt: decodeEntities(media.alt_text || ""),
  };
}

function authorName(post) {
  const author = post._embedded && post._embedded.author && post._embedded.author[0];
  return author ? decodeEntities(author.name) : "";
}

async function importPosts(slugMap) {
  console.log(`\nFetching posts from ${SOURCE} ...`);
  const wpPosts = await fetchAllPages("posts");
  console.log(`  found ${wpPosts.length} posts`);

  fs.mkdirSync(POSTS_DIR, { recursive: true });

  let written = 0;
  for (const post of wpPosts) {
    const title = decodeEntities(post.title && post.title.rendered);
    const description = stripHtml(post.excerpt && post.excerpt.rendered).slice(0, 300);
    const date = (post.date || "").slice(0, 10);
    const category = pickCategorySlug(post, slugMap) || "insights";
    const author = authorName(post);
    const { url: image, alt: imageAlt } = featuredImage(post);
    const bodyMd = turndown.turndown(post.content && post.content.rendered ? post.content.rendered : "");

    const frontmatter = [
      "---",
      `layout: layouts/post.njk`,
      `title: ${yamlString(title)}`,
      `description: ${yamlString(description)}`,
      `date: ${date}`,
      `category: ${category}`,
      author ? `author: ${yamlString(author)}` : null,
      image ? `image: ${yamlString(image)}` : null,
      imageAlt ? `imageAlt: ${yamlString(imageAlt)}` : null,
      `tags: post`,
      "---",
    ]
      .filter(Boolean)
      .join("\n");

    const fileContent = `${frontmatter}\n${bodyMd}\n`;
    fs.writeFileSync(path.join(POSTS_DIR, `${post.slug}.md`), fileContent);
    written += 1;
  }
  console.log(`  wrote ${written} files to src/posts/`);
}

async function importPages() {
  console.log(`\nFetching pages from ${SOURCE} ...`);
  const wpPages = await fetchAllPages("pages");
  console.log(`  found ${wpPages.length} pages`);

  fs.mkdirSync(PAGES_DIR, { recursive: true });

  let written = 0;
  for (const pg of wpPages) {
    const title = decodeEntities(pg.title && pg.title.rendered);
    const description = stripHtml(pg.excerpt && pg.excerpt.rendered).slice(0, 300);
    const bodyMd = turndown.turndown(pg.content && pg.content.rendered ? pg.content.rendered : "");
    const permalink = `/${pg.slug}/`;

    const frontmatter = [
      "---",
      `layout: layouts/page.njk`,
      `title: ${yamlString(title)}`,
      `description: ${yamlString(description)}`,
      `permalink: ${yamlString(permalink)}`,
      "---",
    ].join("\n");

    const fileContent = `${frontmatter}\n${bodyMd}\n`;
    fs.writeFileSync(path.join(PAGES_DIR, `${pg.slug}.md`), fileContent);
    written += 1;
  }
  console.log(`  wrote ${written} files to src/pages/`);
}

(async () => {
  try {
    console.log(`Importing content from: ${SOURCE}`);
    const slugMap = await importCategories();
    await importPosts(slugMap);
    await importPages();
    console.log(
      "\nDone. Run `npm run serve` to preview, review the new files, then commit and push.\n" +
        "Tip: a handful of posts may need their `category:` line adjusted by hand if\n" +
        "WordPress had them filed under more than one section.\n"
    );
  } catch (err) {
    console.error("\nImport failed:", err.message);
    console.error(
      "If this is a network/DNS error, make sure you're running this from your own\n" +
        "machine (not a sandboxed environment) with normal internet access, and that\n" +
        "the site's REST API is reachable at " + SOURCE + "/wp-json/wp/v2/posts\n"
    );
    process.exit(1);
  }
})();
