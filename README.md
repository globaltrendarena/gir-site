# Global Investment Reviews — Website (Static + Git-based Admin)

এই প্রজেক্টটা আপনার জন্য বানানো — একটা সম্পূর্ণ ফুল-ফাংশনাল ওয়েবসাইট যেটা:

- **GitHub রিপোতে থাকে** এবং **GitHub Pages**-এ সম্পূর্ণ ফ্রি হোস্ট হয়
- একটা **Admin ড্যাশবোর্ড** (`/admin`) আছে যেখান থেকে ব্রাউজার থেকেই নতুন পোস্ট লেখা, ক্যাটাগরি ম্যানেজ করা, হেডার-ফুটার এডিট করা, নতুন পেজ যোগ করা যায় — কোনো ডাটাবেজ ছাড়াই (সবকিছু গিট রিপোতে ফাইল হিসেবে সেভ হয়)
- **৩০+ ক্যাটাগরি/সাবক্যাটাগরি** সহ পুরো নেভিগেশন স্ট্রাকচার রেডি করা আছে
- প্রতিটা পোস্ট/পেজ commit হওয়ার সাথে সাথে সাইট **অটোমেটিক রিবিল্ড ও লাইভ** হয়ে যায় (GitHub Actions দিয়ে)

এই README-টা ধাপে ধাপে ফলো করলে ৩০-৪৫ মিনিটে সাইট লাইভ হয়ে যাবে।

---

## যেভাবে কাজ করে (সংক্ষেপে)

```
আপনি /admin-এ লগইন করেন (GitHub একাউন্ট দিয়ে)
        │
        ▼
   Decap CMS (admin প্যানেল)
        │  "Save"/"Publish" চাপলে
        ▼
   সরাসরি আপনার GitHub রিপোতে commit হয়
        │
        ▼
GitHub Actions সাইট রিবিল্ড করে (Eleventy)
        │
        ▼
   GitHub Pages-এ অটো ডিপ্লয় → সাইট লাইভ
```

Admin লগইনের জন্য GitHub OAuth লাগে, আর GitHub Pages একা OAuth হ্যান্ডেল করতে পারে না — তাই একটা ছোট, ফ্রি **Cloudflare Worker** ব্যবহার করা হয়েছে শুধু লগইনটা সামলানোর জন্য (`/cloudflare-worker` ফোল্ডারে)।

---

## ধাপ ১ — GitHub রিপো বানান

1. GitHub-এ লগইন করুন, নতুন একটা **public** repository বানান (যেমন `gir-website`)
2. এই পুরো ফোল্ডারের সব ফাইল সেই রিপোতে push করুন:

```bash
cd gir-site
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/gir-website.git
git push -u origin main
```

---

## ধাপ ২ — GitHub Pages চালু করুন

1. রিপোর **Settings → Pages**-এ যান
2. "Build and deployment" → Source: **GitHub Actions** সিলেক্ট করুন

(এই রিপোতে আগে থেকেই `.github/workflows/deploy.yml` দেওয়া আছে, যেটা push হলেই সাইট বিল্ড করে Pages-এ পাবলিশ করে দেবে।)

3. Push করার পর **Actions** ট্যাবে গিয়ে বিল্ড শেষ হওয়া পর্যন্ত অপেক্ষা করুন (১-২ মিনিট)। শেষ হলে সাইট লাইভ হবে এই ঠিকানায়:
   `https://YOUR-USERNAME.github.io/gir-website/`

> নিজের ডোমেইন (globalinvestmentreviews.com) ব্যবহার করতে চাইলে Settings → Pages → Custom domain-এ গিয়ে ডোমেইন বসান, আর আপনার ডোমেইন প্রোভাইডারে একটা CNAME/A রেকর্ড GitHub-এর দেওয়া ঠিকানায় পয়েন্ট করুন।

---

## ধাপ ৩ — GitHub OAuth App বানান (Admin লগইনের জন্য)

1. GitHub-এ যান: **Settings → Developer settings → OAuth Apps → New OAuth App**
2. পূরণ করুন:
   - **Homepage URL**: `https://YOUR-USERNAME.github.io/gir-website/`
   - **Authorization callback URL**: `https://YOUR-WORKER-SUBDOMAIN.workers.dev/callback` (ধাপ ৪-এর পর এই URL পাবেন, আপাতত একটা placeholder দিয়ে রাখুন, পরে এডিট করে নেবেন)
3. তৈরি হয়ে গেলে **Client ID** এবং একটা নতুন **Client Secret** কপি করে রাখুন

---

## ধাপ ৪ — Cloudflare Worker ডিপ্লয় করুন (লগইন প্রক্সি)

বিস্তারিত নির্দেশনা `cloudflare-worker/README.md`-তে আছে। সংক্ষেপে:

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

ডিপ্লয় হওয়ার পর একটা URL পাবেন, যেমন: `https://gir-cms-auth.YOUR-SUBDOMAIN.workers.dev`

এখন ধাপ ৩-এ ফিরে গিয়ে GitHub OAuth App-এর **callback URL** ঠিক করে দিন:
`https://gir-cms-auth.YOUR-SUBDOMAIN.workers.dev/callback`

---

## ধাপ ৫ — Admin কনফিগ ঠিক করুন

`src/admin/config.yml` ফাইলটা খুলুন, উপরের দিকে এই তিনটা লাইন বদলে দিন:

```yaml
backend:
  name: github
  repo: YOUR-USERNAME/gir-website          # আপনার আসল রিপো নাম
  branch: main
  base_url: https://gir-cms-auth.YOUR-SUBDOMAIN.workers.dev   # ধাপ ৪-এর Worker URL

site_url: https://YOUR-USERNAME.github.io/gir-website
display_url: https://YOUR-USERNAME.github.io/gir-website
```

পরিবর্তন করে commit ও push করুন। সাইট অটো রিবিল্ড হয়ে যাবে।

---

## ধাপ ৬ — Admin ড্যাশবোর্ড ব্যবহার করুন

সাইট লাইভ হয়ে গেলে যান: `https://YOUR-USERNAME.github.io/gir-website/admin/`

- **"Login with GitHub"** চাপুন
- Popup-এ GitHub authorize করুন
- এখন আপনি পারবেন:
  - **Posts** → নতুন আর্টিকেল লিখুন, ক্যাটাগরি সিলেক্ট করুন, ছবি আপলোড করুন
  - **Pages** → About, Contact ইত্যাদি পেজ এডিট বা নতুন পেজ যোগ করুন
  - **Site Settings → Header, Footer & Branding** → সাইটের নাম, ট্যাগলাইন, ফুটারের টেক্সট, সোশ্যাল লিংক এডিট করুন
  - **Categories** → এখান থেকে নতুন ক্যাটাগরি/সাবক্যাটাগরি **যোগ, এডিট বা ডিলিট** করুন — সম্পূর্ণ ড্যাশবোর্ড থেকেই, কোনো কোড এডিট ছাড়াই। প্রতিটা ক্যাটাগরির তিনটা ফিল্ড: Title (নাম), Slug (URL, সাবক্যাটাগরির জন্য parent-এর slug আগে বসিয়ে, যেমন `finance/stock`), আর Parent (সাবক্যাটাগরি হলে প্যারেন্টের slug, টপ-লেভেল হলে খালি রাখুন)। Save করলেই নতুন ক্যাটাগরিটা সাথে সাথে **Posts** ফর্মের ক্যাটাগরি সিলেক্টরেও চলে আসবে — এখানে আর কোনো ডেভেলপার-স্টেপ লাগে না।

"Save" চাপলেই সরাসরি রিপোতে commit হয়ে যায়, আর ১-২ মিনিটের মধ্যে সাইটে লাইভ হয়ে যায়।

---

## হোমপেজ

আগের ওয়ার্ডপ্রেস সাইটে ডেডিকেটেড হোমপেজ ছিল না — শুধু লেটেস্ট পোস্টের একটা ফিড দেখাত। এই সাইটে এখন **Investopedia-style ম্যাগাজিন হোমপেজ** আছে:

- উপরে একটা **"Trending"** স্ট্রিপ (সাম্প্রতিক কয়েকটা হেডলাইন)
- একটা বড় **ফিচার্ড স্টোরি** (সর্বশেষ পোস্ট) + পাশে ৪টা সেকেন্ডারি স্টোরি, ছবি সহ
- প্রতিটা মূল সেকশনের (Insights, Finance, Banking...) জন্য আলাদা ব্লক — লেটেস্ট কয়েকটা আর্টিকেল কার্ড আকারে, "See all →" লিংক সহ
- একটা নিউজলেটার সাইন-আপ ব্লক
- সবচেয়ে নিচে পুরো সেকশন ইনডেক্স

পোস্টে ছবি (Cover image) যোগ করলে সেটা কার্ডে দেখাবে; না দিলে একটা স্টাইলড প্লেসহোল্ডার দেখাবে।

---

## আপনার বর্তমান সাইট (globalinvestmentreviews.com) থেকে সব পোস্ট ও পেজ ইম্পোর্ট করা

`scripts/import-from-wordpress.js` — এই স্ক্রিপ্টটা ওয়ার্ডপ্রেসের নিজস্ব REST API ব্যবহার করে আপনার **সব পোস্ট, সব পেজ, আর সব ক্যাটাগরি** স্বয়ংক্রিয়ভাবে টেনে এনে এই প্রজেক্টের ফরম্যাটে সেভ করে দেয় — কোনো প্লাগইন বা ম্যানুয়াল এক্সপোর্ট ছাড়াই (ওয়ার্ডপ্রেসে এই API ডিফল্টভাবে চালু থাকে)।

```bash
npm install
node scripts/import-from-wordpress.js https://globalinvestmentreviews.com
```

এটা করবে:
1. আপনার সাইটের সব ক্যাটাগরি এনে `src/_data/category-entries/`-এ ফাইল হিসেবে সেভ করবে
2. সব পোস্ট এনে `src/posts/`-এ মার্কডাউন ফাইল হিসেবে সেভ করবে (টাইটেল, বডি, তারিখ, লেখক, কভার ছবি, আর সঠিক ক্যাটাগরি সহ)
3. সব পেজ (About, Contact ইত্যাদি) এনে `src/pages/`-এ সেভ করবে

**খেয়াল রাখুন:**
- ছবিগুলো আপনার পুরনো হোস্ট/CDN-এর URL হিসেবেই থাকবে (ডাউনলোড হবে না) — সাইট সাথে সাথে কাজ করবে, চাইলে পরে লোকালি সেভ করে নিতে পারবেন
- একটা পোস্ট যদি ওয়ার্ডপ্রেসে একাধিক ক্যাটাগরিতে থাকে, স্ক্রিপ্ট সবচেয়ে স্পেসিফিক (গভীরতম) ক্যাটাগরিটা বেছে নেয় — দরকার হলে হাতে ঠিক করে নিন
- স্ক্রিপ্টটা নিরাপদে বারবার চালানো যায় (re-run করলে নতুন/আপডেট হওয়া পোস্ট আবার টেনে আনবে)
- এটা আপনার নিজের কম্পিউটার থেকে চালাতে হবে (এই চ্যাটের স্যান্ডবক্স থেকে আপনার সাইটে নেটওয়ার্ক অ্যাক্সেস নেই)

চালানোর পর `npm run serve` দিয়ে লোকালি চেক করুন, তারপর commit ও push করে দিন।

> এই জিপে ইতিমধ্যে আপনার সাইট থেকে সত্যিকারের একটা পোস্ট ("Private Credit Default Risks: Institutional Analysis 2025") ইম্পোর্ট করে দেওয়া আছে, উদাহরণ হিসেবে — বাকি সবগুলোর জন্য উপরের স্ক্রিপ্টটা চালান।

---

## লোকালি রান করা (ডেভেলপমেন্টের জন্য)

```bash
npm install
npm run serve
```

`http://localhost:8080` এ সাইট দেখতে পারবেন।

---

## ফোল্ডার স্ট্রাকচার

```
src/
  _data/
    site.json         ← হেডার/ফুটার/ব্র্যান্ডিং ডাটা (CMS দিয়ে এডিটেবল)
    categories.json    ← পুরো ক্যাটাগরি ট্রি (CMS দিয়ে এডিটেবল)
  _includes/
    layouts/           ← base, post, page লেআউট
    partials/          ← header, footer
  posts/                ← প্রতিটা আর্টিকেল একটা .md ফাইল
  pages/                ← About, Contact ইত্যাদি স্ট্যাটিক পেজ
  assets/               ← CSS, JS, ছবি
  admin/                ← Decap CMS (config.yml + index.html)
  categories.njk        ← ক্যাটাগরি পেজ অটো-জেনারেট করার টেমপ্লেট
  index.njk             ← হোমপেজ

cloudflare-worker/       ← Admin লগইনের জন্য OAuth প্রক্সি
scripts/                 ← import-from-wordpress.js (পুরনো সাইট থেকে কনটেন্ট আনার স্ক্রিপ্ট)
.github/workflows/       ← অটো বিল্ড + ডিপ্লয়
```

## শর্টকোড / ডাটাবেজ নিয়ে একটা নোট

এই সাইটটা কনটেন্ট রাখে গিট রিপোতে মার্কডাউন/JSON ফাইল হিসেবে — এটাই এখানকার "ডাটাবেজ"। ভবিষ্যতে যদি সত্যিকারের ডাটাবেজ দরকার হয় (যেমন ইউজার লগইন, কমেন্ট সিস্টেম, লাইভ মার্কেট ডাটা), তাহলে একটা সার্ভারলেস ব্যাকএন্ড (Cloudflare D1/Workers, বা Supabase) যোগ করা যাবে — সেটা এই স্ট্যাটিক সাইটের সাথে ভালোভাবেই কম্প্যাটিবল, প্রয়োজন হলে জানাবেন।
