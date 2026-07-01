# Cloudflare & GitHub Pages Setup for EvrythingPDF

## Overview
This guide covers SEO, analytics, and Google Ads setup for a site hosted on GitHub Pages with Cloudflare as CDN/DNS.

---

## Part 1: Cloudflare Configuration for SEO

### 1.1 Connect Domain to Cloudflare

1. **Change nameservers** at your domain registrar to Cloudflare's:
   - `nash.ns.cloudflare.com`
   - `petra.ns.cloudflare.com`

2. In Cloudflare dashboard:
   - Add site
   - Scan DNS records (will auto-import)
   - Verify nameserver change (can take 24-48 hours)

### 1.2 Cloudflare Caching Rules

Create cache rules in **Caching > Cache Rules**:

**Rule 1: HTML Files (1 hour)**
```
Path matches: /*.html
Cache TTL: 1 hour (3600 seconds)
Caching Level: Standard
```

**Rule 2: CSS & JS (24 hours)**
```
Path matches: /style.css OR /app.js
Cache TTL: 24 hours (86400 seconds)
Caching Level: Cache Everything
```

**Rule 3: Sitemap & Robots (24 hours)**
```
Path matches: /sitemap.xml OR /robots.txt
Cache TTL: 24 hours
Caching Level: Cache Everything
```

**Rule 4: Blog Posts (1 week)**
```
Path matches: /blog/*
Cache TTL: 7 days (604800 seconds)
Caching Level: Standard
```

### 1.3 Security Headers in Cloudflare

Go to **Rules > Transform Rules > Modify Response Header**

Create rules to add security headers:

**Rule 1: HSTS Header**
```
Condition: All incoming requests
Add header: Strict-Transport-Security
Value: max-age=31536000; includeSubDomains; preload
```

**Rule 2: X-Frame-Options**
```
Add header: X-Frame-Options
Value: SAMEORIGIN
```

**Rule 3: X-Content-Type-Options**
```
Add header: X-Content-Type-Options
Value: nosniff
```

**Rule 4: Referrer-Policy**
```
Add header: Referrer-Policy
Value: strict-origin-when-cross-origin
```

**Rule 5: Permissions-Policy**
```
Add header: Permissions-Policy
Value: accelerometer=(), camera=(), microphone=()
```

### 1.4 Performance Optimization in Cloudflare

**Go to Speed > Optimization:**

Enable:
- ✅ Rocket Loader (async JS)
- ✅ Minify CSS
- ✅ Minify HTML
- ✅ Minify JavaScript
- ✅ Auto-minify
- ✅ Brotli compression

**Go to Network:**
- ✅ Enable HTTP/2 Edge Coalescing
- ✅ Enable HTTP/3 (QUIC)
- ✅ Enable IPv6 Compatibility
- ✅ Enable 0-RTT Connection Resumption

### 1.5 URL Rewrites (Page Rules Alternative)

**In Rules > Transform Rules > Rewrite URLs:**

**Rule 1: Clean URLs (without .html)**
```
URL Rewrite:
- Source: (\.html)$
- Target: Leave blank or rewrite to /[path]
```

Actually, for GitHub Pages, clean URLs are handled by the `404.html` redirect method.

---

## Part 2: GitHub Pages Configuration

### 2.1 Repository Setup

Ensure your `evrythingpdf` repo has:
```
.gitignore        # Exclude node_modules, .DS_Store, etc.
README.md         # Project description
index.html        # Homepage
[other pages].html
blog/
  index.html
  [articles].html
_config.yml       # Jekyll config (optional)
.github/          # (optional) for workflows
```

### 2.2 Enable GitHub Pages

1. Go to **Settings > Pages**
2. Select **Source**: Deploy from a branch
3. Select **Branch**: `main` (or your default branch)
4. Select **Folder**: `/ (root)`
5. Custom domain: `evrythingpdf.com`
6. ✅ Enforce HTTPS

### 2.3 GitHub Pages CNAME File

Create `/CNAME` file in repo root:
```
evrythingpdf.com
```

This tells GitHub Pages to serve at evrythingpdf.com

### 2.4 Custom 404 Page (Optional)

Create `/404.html` for better error pages:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Page Not Found</title>
  <script>
    // Redirect to home
    window.location.href = '/';
  </script>
</head>
<body>
  <p>Page not found. Redirecting...</p>
</body>
</html>
```

### 2.5 _config.yml Configuration

Create `_config.yml` in repo root:
```yaml
# GitHub Pages / Jekyll config
title: EvrythingPDF
description: Free online PDF tools - merge, split, compress, convert, sign and edit PDFs
url: https://evrythingpdf.com
baseurl: ""

# Build settings
markdown: kramdown
theme: jekyll-default

# SEO
title_separator: "–"
timezone: UTC

# Build exclusions
exclude:
  - README.md
  - CNAME
  - .gitignore
  - node_modules
  - Gemfile
  - Gemfile.lock

# Collections
collections:
  blog:
    output: true
    permalink: /blog/:title
```

---

## Part 3: DNS Setup with Cloudflare

### 3.1 Point Domain to GitHub Pages

In Cloudflare **DNS > Records**, add:

**GitHub Pages IP addresses** (as of 2026):
```
Type: A
Name: @ (or evrythingpdf.com)
IPv4: 185.199.108.153
Proxy status: Proxied (orange cloud)
TTL: Auto

Type: A
Name: @ (or evrythingpdf.com)
IPv4: 185.199.109.153
Proxy status: Proxied

Type: A
Name: @ (or evrythingpdf.com)
IPv4: 185.199.110.153
Proxy status: Proxied

Type: A
Name: @ (or evrythingpdf.com)
IPv4: 185.199.111.153
Proxy status: Proxied
```

**IPv6 (AAAA records):**
```
Type: AAAA
Name: @
IPv6: 2606:50c0:8000::153
Proxy status: Proxied

Type: AAAA
Name: @
IPv6: 2606:50c0:8001::153
Proxy status: Proxied

Type: AAAA
Name: @
IPv6: 2606:50c0:8002::153
Proxy status: Proxied

Type: AAAA
Name: @
IPv6: 2606:50c0:8003::153
Proxy status: Proxied
```

**www subdomain (optional):**
```
Type: CNAME
Name: www
Content: evrythingpdf.com
Proxy status: Proxied
TTL: Auto
```

### 3.2 Verify DNS Setup

```bash
# Check A records
nslookup evrythingpdf.com

# Check CNAME
nslookup www.evrythingpdf.com

# Check with dig
dig evrythingpdf.com +short
```

---

## Part 4: Redirect HTTP to HTTPS (Cloudflare)

In **Rules > Page Rules** (or Transform Rules):

**Rule 1: Always HTTPS**
```
URL: http://evrythingpdf.com/*
Setting: Always Use HTTPS
```

**Rule 2: Redirect www to non-www**
```
URL: https://www.evrythingpdf.com/*
Forward URL: 301 (Permanent redirect)
Redirect to: https://evrythingpdf.com$2
```

---

## Part 5: GitHub Actions for CI/CD (Optional)

### 5.1 Automated Tests & Linting

Create `.github/workflows/build.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Validate HTML
      run: |
        npm install -g html-validate
        html-validate '*.html' 'blog/*.html'
    
    - name: Check Links
      run: |
        npm install -g broken-link-checker
        blc https://evrythingpdf.com -r
    
    - name: Check SEO
      run: |
        npm install -g pa11y
        pa11y https://evrythingpdf.com
```

### 5.2 Deploy on Push

GitHub Pages auto-deploys when you push to main branch.

---

## Part 6: Update Sitemap

Ensure `/sitemap.xml` includes all pages (already configured).

Submit in Google Search Console:
1. Go to https://search.google.com/search-console
2. Select property: evrythingpdf.com
3. Go to **Sitemaps** (left menu)
4. Add sitemap: `https://evrythingpdf.com/sitemap.xml`

---

## Part 7: Cloudflare Web Analytics (Alternative to GA)

### 7.1 Enable Cloudflare Web Analytics

In Cloudflare:
1. **Analytics & Logs > Web Analytics**
2. Enable Web Analytics
3. Get JavaScript snippet
4. Add to all pages (before other scripts)

```html
<!-- Cloudflare Web Analytics -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
        data-cf-beacon='{"token": "YOUR_TOKEN_HERE"}'></script>
```

Benefits:
- ✅ No privacy issues (Cloudflare doesn't track individuals)
- ✅ Real-time metrics
- ✅ No cookie consent needed
- ✅ Free for all Cloudflare users

---

## Part 8: SEO Checklist for Cloudflare + GitHub Pages

- [ ] Domain connected to Cloudflare
- [ ] GitHub Pages enabled with custom domain
- [ ] CNAME file in repo root
- [ ] DNS records pointing to GitHub Pages IPs
- [ ] HTTPS enforced (Cloudflare: Always HTTPS)
- [ ] Security headers configured (HSTS, X-Frame-Options, etc.)
- [ ] Caching rules set up
- [ ] Sitemap.xml created and submitted to GSC
- [ ] robots.txt configured
- [ ] GA4 tracking installed
- [ ] Google Ads conversion tags installed
- [ ] Schema.org markup on all pages
- [ ] Meta tags on all pages
- [ ] Canonical tags configured
- [ ] Open Graph tags on pages
- [ ] Core Web Vitals optimized
- [ ] Mobile responsive design verified
- [ ] Site indexation verified in GSC
- [ ] Search Console connected to GA4
- [ ] Cloudflare performance optimizations enabled

---

## Part 9: Monitoring & Debugging

### 9.1 Check Caching Status

```bash
# Check cache headers
curl -I https://evrythingpdf.com

# Should show:
# CF-Cache-Status: HIT (or MISS on first request)
# Cache-Control: public, max-age=3600
```

### 9.2 Check Security Headers

```bash
curl -I https://evrythingpdf.com | grep -i "Strict-Transport-Security\|X-Frame-Options"
```

### 9.3 Monitor Cloudflare Analytics

In Cloudflare dashboard:
1. **Analytics > Dashboard**
2. Check:
   - Requests per day
   - Bandwidth saved
   - Cache hit rate
   - Threats blocked
   - Performance metrics

### 9.4 Check PageSpeed Insights

https://pagespeed.web.dev/?url=https://evrythingpdf.com

Monitor monthly:
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

---

## Part 10: Monthly Maintenance

### Week 1: Analytics Review
- [ ] Check GA4 conversion metrics
- [ ] Review Google Ads performance
- [ ] Check organic search traffic trends

### Week 2: Technical SEO
- [ ] Check Search Console for errors
- [ ] Verify indexation status
- [ ] Check Core Web Vitals
- [ ] Monitor Cloudflare analytics

### Week 3: Content & Links
- [ ] Publish new blog post
- [ ] Update internal links
- [ ] Outreach for backlinks
- [ ] Check competitor rankings

### Week 4: Performance
- [ ] PageSpeed Insights test
- [ ] Check cache hit rate
- [ ] Review security logs
- [ ] Update any outdated content

---

## Troubleshooting

### Issue: Site not showing at custom domain
**Solution:**
- Check CNAME file exists in repo root
- Verify DNS records in Cloudflare pointing to GitHub IPs
- Wait 24-48 hours for DNS propagation
- Check "Enforce HTTPS" is enabled in GitHub Pages settings

### Issue: HTTPS not working
**Solution:**
- Enable "Always Use HTTPS" in Cloudflare
- Check GitHub Pages settings have HTTPS enforced
- Clear browser cache

### Issue: Slow page load
**Solution:**
- Enable caching rules in Cloudflare
- Check Cloudflare Rocket Loader is enabled
- Optimize images (WebP format)
- Minify CSS/JS (Cloudflare does this auto)

### Issue: Changes not reflecting
**Solution:**
- Clear Cloudflare cache (Caching > Purge Cache > Purge All)
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Wait for GitHub Pages deployment (usually <1 min)

---

## Quick Commands for GitHub

```bash
# Clone repo
git clone https://github.com/yourusername/evrythingpdf.git
cd evrythingpdf

# Make changes
git add .
git commit -m "Update SEO and analytics"

# Push to GitHub (auto-deploys via GitHub Pages)
git push origin main

# Check deployment status
# Go to https://github.com/yourusername/evrythingpdf/deployments
```

---

## Next Steps

1. ✅ Set up Cloudflare DNS
2. ✅ Enable GitHub Pages
3. ✅ Add CNAME file
4. ✅ Configure security headers in Cloudflare
5. ✅ Enable caching rules
6. ✅ Submit sitemap to Search Console
7. ✅ Install GA4 conversion tracking
8. ✅ Install Google Ads tags
9. ✅ Monitor with Cloudflare Analytics
10. ✅ Monthly SEO maintenance routine
