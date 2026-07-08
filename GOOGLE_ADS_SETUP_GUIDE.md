# Google Ads Setup Guide for EvrythingPDF

## Quick Start Checklist

### Step 1: Create Google Ads Account
- [ ] Go to https://ads.google.com
- [ ] Sign in with your Google account
- [ ] Create a new campaign
- [ ] Select "Search" or "Display" as campaign type
- [ ] Add billing information

### Step 2: Get Your Google Ads Conversion ID
1. In Google Ads, go to **Tools & Settings** > **Conversions**
2. Click **Create conversion action**
3. Select **Website** as conversion source
4. Fill in conversion details:
   - **Conversion name:** `PDF_Tool_Usage`
   - **Conversion category:** Lead
   - **Conversion value:** Don't use (it's free)
5. Choose **Installation code** → **Google tag**
6. **Copy your conversion ID** (format: AW-XXXXXXXXXX)
7. **Save and copy the conversion tracking ID** (format: AW-XXXXXXXXXX/XXXXXXXXXXX)

### Step 3: Link Google Analytics 4 to Google Ads
1. In Google Analytics 4, go to **Admin** > **Google Ads Links**
2. Click **Link Google Ads accounts**
3. Select your Google Ads account
4. Enable:
   - ✅ Auto-tagging
   - ✅ Conversion import from GA4

### Step 4: Implement Conversion Tracking
Replace `AW-XXXXXXXXXX` with your actual Google Ads Conversion ID in:
- `index.html`
- `app.js` (for event tracking)

### Step 5: Create Conversion Actions in Google Ads
Create multiple conversion actions:

**Conversion 1: Tool Usage**
- Name: `PDF_Tool_Usage`
- Category: Lead
- Counting: Every conversion
- Attribution: Last click

**Conversion 2: PDF Download**
- Name: `PDF_Download`
- Category: Lead
- Counting: Every conversion
- Attribution: Last click

**Conversion 3: Blog Engagement**
- Name: `Blog_View`
- Category: Engagement
- Counting: Every conversion
- Attribution: Last click

---

## Conversion Tag Installation

### For Website Global Tag (gtag.js)
If using the same Google tag for both GA4 and Google Ads:

```html
<!-- Google tag (gtag.js) for both GA4 and Google Ads -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-K2TCJVQ6KR"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  
  // GA4 configuration
  gtag('config', 'G-K2TCJVQ6KR');
  
  // Google Ads configuration (add your conversion ID)
  gtag('config', 'AW-XXXXXXXXXX');
</script>
```

### Track Conversions in JavaScript

```javascript
// Track PDF Tool Usage
function trackPDFToolUsage(toolName) {
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXXX/XXXXXXXXXXX',
    'value': 1.0,
    'currency': 'USD',
    'transaction_id': Date.now().toString()
  });
  
  // Also send to GA4
  gtag('event', 'tool_complete', {
    'tool_name': toolName,
    'event_category': 'conversion',
    'event_label': 'tool_usage'
  });
}

// Track PDF Download
function trackPDFDownload(filename) {
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXXX/YYYYYYYYYYYY',
    'value': 1.0,
    'currency': 'USD'
  });
  
  // Also send to GA4
  gtag('event', 'pdf_download', {
    'file_name': filename,
    'event_category': 'conversion'
  });
}
```

---

## Google Ads Remarketing Setup

### Add Remarketing Tag
```html
<!-- Google Ads Remarketing Conversion Tracking Code -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
</script>

<!-- Event snippet for Page view conversion page -->
<script>
  gtag('event', 'page_view', {
    'send_to': 'AW-XXXXXXXXXX'
  });
</script>
```

### Create Remarketing Audiences
In Google Ads:
1. Go to **Tools & Settings** > **Audiences**
2. Click **Audience sources** > **Google Analytics**
3. Select GA4 property
4. Choose audiences to import:
   - Users who completed conversions
   - Users who visited specific pages
   - Users based on engagement metrics

### Create Remarketing Campaign
1. Create new campaign
2. Select **Display** as campaign type
3. Choose **Remarketing** as campaign subtype
4. Select your remarketing audience
5. Set budget and bidding strategy

---

## Google Ads Campaign Strategy

### Campaign 1: Brand Awareness
**Goal:** Drive traffic to tool pages
- **Type:** Search Campaigns
- **Keywords:** "free pdf merger", "online pdf tools", "pdf splitter free"
- **Audience:** Desktop/Mobile users
- **Budget:** $500-1000/month

### Campaign 2: Tool Conversions
**Goal:** Get users to complete tool actions
- **Type:** Display + Remarketing
- **Targeting:** Previous site visitors
- **Audience:** Users who uploaded PDFs
- **Budget:** $300-500/month

### Campaign 3: Blog Traffic
**Goal:** Increase blog readership
- **Type:** Search Campaigns
- **Keywords:** "how to merge pdf free", "pdf compression guide"
- **Audience:** Interest-based
- **Budget:** $200-300/month

---

## Tracking Template for app.js

Add these functions to your JavaScript:

```javascript
// Initialize GA4 and Google Ads
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-K2TCJVQ6KR');
gtag('config', 'AW-XXXXXXXXXX');

// Track file upload
function trackFileUpload(fileCount) {
  gtag('event', 'file_upload', {
    'event_category': 'engagement',
    'event_label': 'pdf_upload',
    'value': fileCount
  });
}

// Track tool start
function trackToolStart(toolName) {
  gtag('event', 'tool_start', {
    'event_category': 'engagement',
    'event_label': toolName
  });
}

// Track tool completion
function trackToolCompletion(toolName) {
  // GA4 event
  gtag('event', 'tool_complete', {
    'event_category': 'conversion',
    'event_label': toolName
  });
  
  // Google Ads conversion
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXXX/XXXXXXXXXXX'
  });
}

// Track file download
function trackFileDownload(filename) {
  // GA4 event
  gtag('event', 'file_download', {
    'event_category': 'conversion',
    'event_label': filename
  });
  
  // Google Ads conversion
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXXX/YYYYYYYYYYYY'
  });
}

// Track blog engagement
function trackBlogEngagement(articleTitle) {
  gtag('event', 'blog_engagement', {
    'event_category': 'engagement',
    'event_label': articleTitle
  });
}

// Track scroll depth
function trackScrollDepth(depth) {
  gtag('event', 'scroll_depth', {
    'event_category': 'engagement',
    'event_label': depth + '%'
  });
}
```

---

## Conversion Tracking Implementation Checklist

### For Merge Tool (merge.html)
- [ ] Track file uploads
- [ ] Track successful merge completion
- [ ] Track PDF download
- [ ] Track user reordering actions

### For Other Tools
- [ ] Track file uploads
- [ ] Track tool action completion
- [ ] Track download/result generation
- [ ] Track share/copy actions

### For Blog
- [ ] Track page views
- [ ] Track scroll depth (25%, 50%, 75%, 100%)
- [ ] Track internal link clicks
- [ ] Track CTA clicks (to tools)

---

## Testing Your Setup

### Verify Google Ads Tag
1. Go to any page on evrythingpdf.com
2. Open Chrome DevTools (F12)
3. Go to **Network** tab
4. Search for "google" or "doubleclick"
5. Should see requests to `googletagmanager.com` and `doubleclick.net`

### Verify Conversion Tracking
1. In Google Ads, go to **Tools & Settings** > **Conversions**
2. Click on your conversion action
3. Under **Conversion tracking status**, it should show "Tag installed"
4. Check if conversions are being recorded (may take 24 hours)

### Use Tag Assistant
1. Install **Google Tag Assistant** Chrome extension
2. Visit your website
3. Should show:
   - ✅ GA4 tag (G-K2TCJVQ6KR)
   - ✅ Google Ads tag (AW-XXXXXXXXXX)

### Real-time Reporting
1. In Google Analytics 4, go to **Reports** > **Realtime**
2. Complete a tool action on your site
3. Should see event appear in real-time dashboard

---

## Budget Recommendations

### Monthly Budget Allocation
- **Total Budget:** $1000-2000/month
- **Brand Keywords:** 40% ($400-800)
- **Remarketing:** 30% ($300-600)
- **Blog/Content:** 20% ($200-400)
- **Testing:** 10% ($100-200)

### Expected ROAS (Return on Ad Spend)
With AdSense and proper optimization:
- **Month 1-3:** 1.5:1 to 2:1 ROAS
- **Month 4-6:** 2:1 to 3:1 ROAS
- **Month 6+:** 3:1 to 5:1 ROAS

---

## Key Performance Indicators (KPIs)

Track these metrics:
- **Click-through Rate (CTR):** Target 2-4% for search
- **Cost Per Click (CPC):** Monitor for efficiency
- **Conversion Rate:** Target 3-5% for free tools
- **Cost Per Conversion:** Should decrease over time
- **Return on Ad Spend (ROAS):** Aim for 3:1
- **Quality Score:** Keep above 7/10
- **Impressions:** Should grow 10-20% monthly

---

## Common Issues & Solutions

### Problem: No conversions showing
- **Solution:** 
  1. Verify tag is installed correctly
  2. Check conversion tracking is enabled
  3. Wait 24-48 hours for data to populate
  4. Use real-time reporting to debug

### Problem: Low conversion rate
- **Solution:**
  1. Improve landing page quality
  2. Optimize form fields
  3. Test different ad copy
  4. A/B test landing pages

### Problem: High cost per conversion
- **Solution:**
  1. Improve Quality Score
  2. Refine keyword targeting
  3. Adjust bid strategy
  4. Exclude low-performing keywords

---

## Next Steps

1. ✅ Create Google Ads account
2. ✅ Set up conversion tracking codes
3. ✅ Link Google Analytics to Google Ads
4. ✅ Create remarketing audiences
5. ✅ Launch initial search campaign
6. ✅ Monitor and optimize daily
7. ✅ Create remarketing campaigns (week 2)
8. ✅ Test different ad copy and landing pages
9. ✅ Scale budget based on ROAS

---

## Support

- Google Ads Help: https://support.google.com/google-ads
- Conversion Tracking Guide: https://support.google.com/google-ads/answer/1722054
- GA4 Integration: https://support.google.com/google-ads/answer/10746051
