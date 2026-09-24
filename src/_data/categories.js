const fs = require("fs");
const path = require("path");

// Reads every JSON file in _data/category-entries/ (one file per category,
// managed as a folder collection in the admin dashboard so editors can add,
// edit, and delete sections/subsections without touching code) and exposes
// them as `categories.list`, sorted by parent then order — same shape the
// site's templates already expect.
module.exports = () => {
  const dir = path.join(__dirname, "category-entries");
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch (e) {
    return { list: [] };
  }

  const list = files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .filter((c) => c.slug && c.title);

  list.sort((a, b) => {
    const pa = a.parent || "";
    const pb = b.parent || "";
    if (pa !== pb) return pa.localeCompare(pb);
    return (a.order || 0) - (b.order || 0);
  });

  return { list };
};
