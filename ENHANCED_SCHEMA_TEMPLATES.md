# Enhanced Schema Markup & Meta Tags Templates

Ready-to-use code snippets to enhance SEO on your pages.

---

## 1. Homepage (index.html) - Enhanced

Add these to `<head>` section:

```html
<!-- Google Ads Conversion Tracking (replace AW-XXXXXXXXXX with your ID) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
</script>

<!-- Enhanced Homepage Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "EvrythingPDF",
  "url": "https://evrythingpdf.com",
  "description": "Free online PDF tools to merge, split, compress, convert, sign and edit PDFs. No installation needed. Fast, secure, and 100% free.",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "1250",
    "bestRating": "5",
    "worstRating": "1"
  },
  "featureList": [
    "Merge PDFs",
    "Split PDFs",
    "Compress PDFs",
    "Convert PDFs",
    "Sign PDFs",
    "Edit PDFs",
    "Rotate PDFs",
    "Add watermarks"
  ]
}
</script>

<!-- Organization Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "EvrythingPDF",
  "url": "https://evrythingpdf.com",
  "logo": "https://evrythingpdf.com/logo.png",
  "description": "Free online PDF tools for merging, splitting, compressing, converting, and editing PDFs",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Service",
    "email": "support@evrythingpdf.com",
    "availableLanguage": "en"
  },
  "sameAs": [
    "https://twitter.com/evrythingpdf",
    "https://facebook.com/evrythingpdf",
    "https://linkedin.com/company/evrythingpdf"
  ]
}
</script>

<!-- BreadcrumbList Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://evrythingpdf.com"
    }
  ]
}
</script>

<!-- FAQPage Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is EvrythingPDF free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! EvrythingPDF is 100% free. All tools are available at no cost with no signup required."
      }
    },
    {
      "@type": "Question",
      "name": "Is my data safe with EvrythingPDF?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. All processing happens in your browser. Files are never uploaded to our servers. Your documents remain completely private."
      }
    },
    {
      "@type": "Question",
      "name": "What file formats does EvrythingPDF support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "EvrythingPDF supports PDF, Word, JPG, PNG, and other common formats. Each tool page lists supported formats."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need to install anything?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No installation needed. EvrythingPDF works entirely in your browser. Just visit the website and start using tools."
      }
    },
    {
      "@type": "Question",
      "name": "What is your privacy policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We respect your privacy. Read our full privacy policy at https://evrythingpdf.com/privacy"
      }
    }
  ]
}
</script>
```

---

## 2. Tool Pages (merge.html, compress.html, etc.)

Add this to `<head>` of each tool page (customize for each tool):

```html
<!-- Update meta tags for each tool -->
<meta name="description" content="[Tool-specific description. 155 chars max. Include primary keyword]">
<meta name="keywords" content="[tool-specific keywords]">

<!-- Tool-Specific Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "[Tool Name] - EvrythingPDF",
  "url": "https://evrythingpdf.com/[tool-slug]",
  "description": "[Detailed tool description]",
  "applicationCategory": "UtilityApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "500",
    "bestRating": "5",
    "worstRating": "1"
  },
  "featureList": [
    "[Feature 1]",
    "[Feature 2]",
    "[Feature 3]"
  ]
}
</script>

<!-- BreadcrumbList for Tool Page -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://evrythingpdf.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "[Tool Name]",
      "item": "https://evrythingpdf.com/[tool-slug]"
    }
  ]
}
</script>

<!-- FAQ Schema (add questions specific to this tool) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Common question about this tool?]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Answer to the question]"
      }
    },
    {
      "@type": "Question",
      "name": "[Another common question?]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Answer]"
      }
    }
  ]
}
</script>
```

### Example: Merge Tool (merge.html)

```html
<meta name="description" content="Merge multiple PDF files into one online for free. No signup needed. Combine PDFs instantly with drag-and-drop ordering.">
<meta name="keywords" content="merge pdf, combine pdf, join pdf files, merge pdf online free">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Merge PDF - EvrythingPDF",
  "url": "https://evrythingpdf.com/merge",
  "description": "Free online PDF merger. Combine multiple PDFs into one document. Drag to reorder pages. No signup required.",
  "applicationCategory": "UtilityApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "2500",
    "bestRating": "5",
    "worstRating": "1"
  },
  "featureList": [
    "Merge unlimited PDFs",
    "Drag to reorder pages",
    "No signup required",
    "No file size limits",
    "100% secure and private",
    "Works in your browser"
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I merge PDF files?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Upload your PDF files using the drag-and-drop area or browse button. Reorder them by dragging if needed. Click Merge and your combined PDF downloads instantly."
      }
    },
    {
      "@type": "Question",
      "name": "How many PDFs can I merge?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can merge as many PDFs as you need. There is no limit on the number of files."
      }
    },
    {
      "@type": "Question",
      "name": "Is it safe to merge PDFs online?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. All processing happens in your browser. Your files are never uploaded to our servers. Your documents stay 100% private and secure."
      }
    },
    {
      "@type": "Question",
      "name": "What's the maximum file size?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "There are no file size restrictions. You can merge PDFs of any size limited only by your browser's memory."
      }
    }
  ]
}
</script>
```

---

## 3. Blog Posts (blog/article.html)

Add this to `<head>` of each blog post:

```html
<!-- Blog Article Meta Tags -->
<meta name="description" content="[Article summary - 155 chars. Include primary keyword]">
<meta name="author" content="EvrythingPDF Team">
<meta name="published_time" content="[YYYY-MM-DDTHH:MM:SS+00:00]">
<meta name="updated_time" content="[YYYY-MM-DDTHH:MM:SS+00:00]">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="[Article Title]">
<meta property="og:description" content="[Article summary]">
<meta property="og:image" content="https://evrythingpdf.com/blog/images/[featured-image].jpg">
<meta property="og:url" content="https://evrythingpdf.com/blog/[article-slug]">
<meta property="article:published_time" content="[YYYY-MM-DDTHH:MM:SS+00:00]">
<meta property="article:modified_time" content="[YYYY-MM-DDTHH:MM:SS+00:00]">
<meta property="article:author" content="EvrythingPDF">
<meta property="article:section" content="PDF Tips & Guides">
<meta property="article:tag" content="[tag1]">
<meta property="article:tag" content="[tag2]">

<!-- Twitter Card -->
<meta name="twitter:title" content="[Article Title]">
<meta name="twitter:description" content="[Article summary]">
<meta name="twitter:image" content="https://evrythingpdf.com/blog/images/[featured-image].jpg">
<meta name="twitter:url" content="https://evrythingpdf.com/blog/[article-slug]">

<!-- BlogPosting Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "[Article Title]",
  "description": "[Article summary]",
  "image": {
    "@type": "ImageObject",
    "url": "https://evrythingpdf.com/blog/images/[featured-image].jpg",
    "width": 1200,
    "height": 630
  },
  "datePublished": "[YYYY-MM-DDTHH:MM:SS+00:00]",
  "dateModified": "[YYYY-MM-DDTHH:MM:SS+00:00]",
  "author": {
    "@type": "Organization",
    "name": "EvrythingPDF",
    "url": "https://evrythingpdf.com"
  },
  "publisher": {
    "@type": "Organization",
    "name": "EvrythingPDF",
    "logo": {
      "@type": "ImageObject",
      "url": "https://evrythingpdf.com/logo.png",
      "width": 200,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://evrythingpdf.com/blog/[article-slug]"
  }
}
</script>

<!-- BreadcrumbList for Blog -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://evrythingpdf.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://evrythingpdf.com/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "[Article Title]",
      "item": "https://evrythingpdf.com/blog/[article-slug]"
    }
  ]
}
</script>
```

### Example: Blog Article

```html
<!-- For article: "How to Merge PDF Files" -->
<meta name="description" content="Learn how to merge PDF files online for free. Step-by-step guide with 3 easy methods. Combine multiple PDFs instantly.">
<meta name="published_time" content="2026-06-15T10:30:00+00:00">
<meta name="updated_time" content="2026-06-20T14:45:00+00:00">

<meta property="og:title" content="How to Merge PDF Files: Complete Guide (3 Methods)">
<meta property="og:description" content="Learn the easiest ways to merge PDF files online and offline. Free tools, step-by-step instructions, and pro tips.">
<meta property="og:image" content="https://evrythingpdf.com/blog/images/how-to-merge-pdf.jpg">
<meta property="article:published_time" content="2026-06-15T10:30:00+00:00">
<meta property="article:section" content="PDF Guides">
<meta property="article:tag" content="PDF Merge">
<meta property="article:tag" content="PDF Tools">
<meta property="article:tag" content="How-To">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How to Merge PDF Files: Complete Guide (3 Methods)",
  "description": "Learn how to merge PDF files online and offline with our complete guide. Includes step-by-step instructions and pro tips.",
  "image": {
    "@type": "ImageObject",
    "url": "https://evrythingpdf.com/blog/images/how-to-merge-pdf.jpg",
    "width": 1200,
    "height": 630
  },
  "datePublished": "2026-06-15T10:30:00+00:00",
  "dateModified": "2026-06-20T14:45:00+00:00",
  "author": {
    "@type": "Organization",
    "name": "EvrythingPDF"
  },
  "publisher": {
    "@type": "Organization",
    "name": "EvrythingPDF",
    "logo": {
      "@type": "ImageObject",
      "url": "https://evrythingpdf.com/logo.png"
    }
  }
}
</script>
```

---

## 4. About Page

```html
<meta name="description" content="About EvrythingPDF. Learn about our free PDF tools platform, mission, and why you can trust us with your documents.">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "mainEntity": {
    "@type": "Organization",
    "name": "EvrythingPDF",
    "url": "https://evrythingpdf.com",
    "logo": "https://evrythingpdf.com/logo.png",
    "description": "Free online PDF tools for merging, splitting, compressing, converting, and editing PDFs.",
    "sameAs": [
      "https://twitter.com/evrythingpdf",
      "https://facebook.com/evrythingpdf"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@evrythingpdf.com"
    }
  }
}
</script>
```

---

## 5. Contact Page

```html
<meta name="description" content="Contact EvrythingPDF support team. Get help with our free PDF tools or send us feedback and feature requests.">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Contact EvrythingPDF",
  "description": "Get in touch with the EvrythingPDF team for support or feedback",
  "mainEntity": {
    "@type": "Organization",
    "name": "EvrythingPDF",
    "url": "https://evrythingpdf.com",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@evrythingpdf.com",
      "availableLanguage": "en"
    }
  }
}
</script>
```

---

## Implementation Checklist

### For Each Page Update:
- [ ] Update meta description (max 155 chars, include keyword)
- [ ] Update meta keywords (if applicable)
- [ ] Add/update Open Graph tags
- [ ] Add/update Twitter Card tags
- [ ] Add schema.org markup (appropriate type for page)
- [ ] Validate schema with https://validator.schema.org/
- [ ] Test Open Graph preview with https://www.opengraph.xyz/
- [ ] Test Twitter Card with https://cards-dev.twitter.com/validator

### Validation Tools
1. **Schema Validator:** https://validator.schema.org/
2. **Rich Results Test:** https://search.google.com/test/rich-results
3. **Open Graph Preview:** https://www.opengraph.xyz/
4. **Twitter Card Validator:** https://cards-dev.twitter.com/validator

---

## Tips for Better Meta Tags

1. **Meta Description:**
   - 155 characters max
   - Include primary keyword naturally
   - Include benefit/value proposition
   - Make it clickable (compelling)

2. **Keywords:**
   - 5-10 keywords per page
   - Include variations (plural, long-tail)
   - Keep related terms together

3. **Titles:**
   - 50-60 characters
   - Include primary keyword near start
   - Use keyword + modifier (Tool name, Guide, Tutorial, etc.)

4. **Schema Markup:**
   - Always validate before deploying
   - Use appropriate types for content
   - Include complete information (dates, authors, images)

---

## Google Ads Conversion Tag Addition

Add to every page in `<head>`:

```html
<!-- Google Ads Conversion Tracking -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
</script>
```

Replace `AW-XXXXXXXXXX` with your actual Google Ads Conversion ID.

---

## Testing Checklist

- [ ] Visit page in browser
- [ ] Check page loads without errors
- [ ] Validate HTML with https://validator.w3.org/
- [ ] Validate schema with https://validator.schema.org/
- [ ] Check PageSpeed Insights: https://pagespeed.web.dev/
- [ ] Check mobile responsiveness
- [ ] Verify all links work
- [ ] Verify images load
- [ ] Test with Chrome DevTools Lighthouse
- [ ] Preview social sharing (Open Graph)

---

Ready to update your pages! Start with the homepage and tool pages, then move to blog posts.
