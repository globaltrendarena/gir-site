# Cloudflare Worker — GIR Admin Login Proxy

এই Worker-টার একটাই কাজ: `/admin` ড্যাশবোর্ডে "Login with GitHub" চাপলে GitHub-এর সাথে OAuth হ্যান্ডশেক করে একটা access token ফিরিয়ে দেওয়া, যাতে Decap CMS আপনার হয়ে GitHub রিপোতে commit করতে পারে। এটা সম্পূর্ণ ফ্রি টিয়ারে চলে (দিনে ১ লক্ষ রিকোয়েস্ট পর্যন্ত ফ্রি)।

## এক নজরে ডিপ্লয়মেন্ট

### ১) Cloudflare একাউন্ট বানান
[dash.cloudflare.com](https://dash.cloudflare.com) এ ফ্রি সাইনআপ করুন।

### ২) Wrangler ইনস্টল ও লগইন করুন
```bash
npm install -g wrangler
wrangler login
```
এটা ব্রাউজার খুলে আপনাকে Cloudflare একাউন্টের সাথে অথরাইজ করতে বলবে।

### ৩) Worker ডিপ্লয় করুন
```bash
cd cloudflare-worker
wrangler deploy
```
সফল হলে একটা URL দেখাবে, যেমন:
```
https://gir-cms-auth.your-subdomain.workers.dev
```
এই URL-টা কপি করে রাখুন — এটা লাগবে `src/admin/config.yml`-এর `base_url`-এ, এবং GitHub OAuth App-এর callback URL বানাতে।

### ৪) GitHub OAuth ক্রেডেনশিয়াল সেট করুন
প্রধান README-এর "ধাপ ৩"-এ যেভাবে GitHub OAuth App বানিয়েছেন, সেখান থেকে Client ID আর Client Secret নিয়ে:

```bash
wrangler secret put GITHUB_CLIENT_ID
# পেস্ট করুন যখন জিজ্ঞেস করবে

wrangler secret put GITHUB_CLIENT_SECRET
# পেস্ট করুন যখন জিজ্ঞেস করবে
```

### ৫) টেস্ট করুন
ব্রাউজারে খুলুন: `https://gir-cms-auth.your-subdomain.workers.dev/`
"GIR CMS auth worker is running." লেখা দেখলে ঠিক আছে।

এরপর সাইটের `/admin/`-এ গিয়ে "Login with GitHub" চাপুন — GitHub-এ রিডাইরেক্ট হবে, অথরাইজ করলে popup বন্ধ হয়ে অ্যাডমিন প্যানেল খুলে যাবে।

## সমস্যা হলে

- **"redirect_uri mismatch"** এরর → GitHub OAuth App-এর callback URL আর Worker-এর `/callback` URL হুবহু মিলছে কিনা চেক করুন (https, ট্রেইলিং স্ল্যাশ সব মিলিয়ে)
- **Popup খুলেই বন্ধ হয়ে যায়, লগইন হয় না** → ব্রাউজারের popup blocker বন্ধ করুন, আর `wrangler secret put` দিয়ে দুটো secret ঠিকমতো সেট হয়েছে কিনা `wrangler secret list` দিয়ে চেক করুন
- **কোড পরিবর্তন করার পর আবার ডিপ্লয় করতে** → `wrangler deploy` আবার রান করলেই হবে
