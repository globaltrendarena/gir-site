const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // Static passthroughs
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.addPassthroughCopy({ "src/_data/site.json": "site-data.json" });

  // Filters
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toFormat("d LLLL yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toISO();
  });

  eleventyConfig.addFilter("limit", (arr, limit) => (arr || []).slice(0, limit));

  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  eleventyConfig.addFilter("excerpt", (content) => {
    if (!content) return "";
    const text = String(content).replace(/(<([^>]+)>)/gi, "");
    return text.length > 160 ? text.slice(0, 157).trim() + "…" : text;
  });

  eleventyConfig.addFilter("findCategory", (categories, slug) => {
    return (categories || []).find((c) => c.slug === slug);
  });

  eleventyConfig.addFilter("childrenOf", (categories, parentSlug) => {
    return (categories || []).filter((c) => c.parent === parentSlug);
  });

  eleventyConfig.addFilter("topLevel", (categories) => {
    return (categories || []).filter((c) => !c.parent);
  });

  eleventyConfig.addFilter("postsInCategory", (posts, slug) => {
    return (posts || []).filter(
      (p) => p.data.category === slug || p.data.subcategory === slug
    );
  });

  // Matches posts filed directly under `slug`, or under any of its descendant categories.
  eleventyConfig.addFilter("postsUnderCategory", (posts, slug) => {
    return (posts || [])
      .filter(
        (p) => p.data.category === slug || (p.data.category || "").startsWith(slug + "/")
      )
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addFilter("categoryTitle", (categories, slug) => {
    const c = (categories || []).find((c) => c.slug === slug);
    return c ? c.title : slug;
  });

  eleventyConfig.addFilter("categoryChain", (categories, slug) => {
    const list = categories || [];
    const chain = [];
    let current = list.find((c) => c.slug === slug);
    while (current) {
      chain.unshift(current);
      current = current.parent ? list.find((c) => c.slug === current.parent) : null;
    }
    return chain;
  });

  eleventyConfig.addFilter("categoryUrl", (categories, slug) => {
    const c = (categories || []).find((c) => c.slug === slug);
    return c ? `/${c.slug}/` : "/";
  });

  // Collections
  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date);
  });

  eleventyConfig.setServerOptions({ port: 8080 });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
};
