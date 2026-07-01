/**
 * Google Analytics 4 Conversion Tracking Setup
 * EvrythingPDF.com
 *
 * This file contains GA4 event tracking functions to be integrated into app.js
 *
 * Usage:
 * 1. Keep GA4 gtag script in HTML head
 * 2. Copy these functions into app.js
 * 3. Call tracking functions when events occur
 * 4. Test with GA4 real-time dashboard
 */

// ============================================
// GA4 CORE TRACKING FUNCTIONS
// ============================================

/**
 * Track PDF file uploads
 * Call when user selects/drops PDF files
 */
function trackPDFUpload(fileCount, fileSize = null) {
  gtag('event', 'pdf_upload', {
    'event_category': 'engagement',
    'event_label': 'file_uploaded',
    'value': fileCount,
    'file_size_mb': fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : null
  });
  console.log('[GA4] Tracked PDF upload:', fileCount, 'files');
}

/**
 * Track tool start action
 * Call when user clicks "Start" or begins tool operation
 */
function trackToolStart(toolName, toolCategory = 'pdf_tool') {
  gtag('event', 'tool_start', {
    'event_category': 'engagement',
    'event_label': toolName,
    'tool_category': toolCategory
  });
  console.log('[GA4] Tracked tool start:', toolName);
}

/**
 * Track tool completion
 * Call when tool processing succeeds (merge, compress, etc.)
 */
function trackToolCompletion(toolName, processingTime = null) {
  gtag('event', 'tool_complete', {
    'event_category': 'conversion',
    'event_label': toolName,
    'processing_time_ms': processingTime
  });

  console.log('[GA4] Tracked tool completion:', toolName);
  console.log('[GA4] Conversion event tracked for:', toolName);
}

/**
 * Track PDF download
 * Call when user downloads the processed PDF
 */
function trackPDFDownload(filename, fileSize = null) {
  gtag('event', 'pdf_download', {
    'event_category': 'conversion',
    'event_label': filename,
    'file_name': filename,
    'file_size_mb': fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : null
  });

  // Mark as conversion
  gtag('event', 'conversion', {
    'event_category': 'lead_generation'
  });

  console.log('[GA4] Tracked PDF download:', filename);
}

/**
 * Track page scroll depth
 * Call at 25%, 50%, 75%, 100% scroll points
 */
function trackScrollDepth(depth) {
  if ([25, 50, 75, 100].includes(depth)) {
    gtag('event', 'scroll', {
      'event_category': 'engagement',
      'event_label': 'page_scroll',
      'scroll_depth': depth + '%'
    });
    console.log('[GA4] Tracked scroll depth:', depth + '%');
  }
}

/**
 * Track internal link clicks
 * Call when user clicks internal navigation
 */
function trackInternalLinkClick(linkText, linkUrl, linkType = 'navigation') {
  gtag('event', 'click', {
    'event_category': 'engagement',
    'event_label': linkText,
    'link_url': linkUrl,
    'link_type': linkType
  });
  console.log('[GA4] Tracked link click:', linkText);
}

/**
 * Track CTA button clicks
 * Call when user clicks "Get Started", "Try Now", etc.
 */
function trackCTAClick(buttonText, toolName = null) {
  gtag('event', 'cta_click', {
    'event_category': 'engagement',
    'event_label': buttonText,
    'tool_name': toolName
  });
  console.log('[GA4] Tracked CTA click:', buttonText);
}

/**
 * Track tool error
 * Call when tool processing fails
 */
function trackToolError(toolName, errorMessage = null) {
  gtag('event', 'tool_error', {
    'event_category': 'error',
    'event_label': toolName,
    'error_message': errorMessage
  });
  console.log('[GA4] Tracked tool error:', toolName, errorMessage);
}

/**
 * Track form submissions
 * Call when user submits any form
 */
function trackFormSubmission(formName) {
  gtag('event', 'form_submit', {
    'event_category': 'engagement',
    'event_label': formName,
    'form_name': formName
  });
  console.log('[GA4] Tracked form submission:', formName);
}

/**
 * Track video engagement (if applicable)
 * Call when user plays video
 */
function trackVideoPlay(videoTitle) {
  gtag('event', 'video_start', {
    'event_category': 'engagement',
    'event_label': videoTitle,
    'video_title': videoTitle
  });
  console.log('[GA4] Tracked video play:', videoTitle);
}

/**
 * Track search actions
 * Call when user performs search
 */
function trackSearch(searchTerm) {
  gtag('event', 'search', {
    'event_category': 'engagement',
    'event_label': 'site_search',
    'search_term': searchTerm
  });
  console.log('[GA4] Tracked search:', searchTerm);
}

// ============================================
// TOOL-SPECIFIC TRACKING
// ============================================

/**
 * Merge PDF Tool tracking
 */
function trackMergePDF() {
  const startTime = Date.now();

  // Track start
  trackToolStart('Merge PDF', 'pdf_merge');

  // Return function to call on completion
  return function onMergeComplete() {
    const processingTime = Date.now() - startTime;
    trackToolCompletion('Merge PDF', processingTime);
  };
}

/**
 * Split PDF Tool tracking
 */
function trackSplitPDF() {
  const startTime = Date.now();
  trackToolStart('Split PDF', 'pdf_split');

  return function onSplitComplete() {
    const processingTime = Date.now() - startTime;
    trackToolCompletion('Split PDF', processingTime);
  };
}

/**
 * Compress PDF Tool tracking
 */
function trackCompressPDF() {
  const startTime = Date.now();
  trackToolStart('Compress PDF', 'pdf_compress');

  return function onCompressComplete() {
    const processingTime = Date.now() - startTime;
    trackToolCompletion('Compress PDF', processingTime);
  };
}

/**
 * Convert PDF Tool tracking
 */
function trackConvertPDF(fromFormat, toFormat) {
  const toolName = `Convert ${fromFormat.toUpperCase()} to ${toFormat.toUpperCase()}`;
  const startTime = Date.now();

  gtag('event', 'tool_start', {
    'event_category': 'engagement',
    'event_label': toolName,
    'from_format': fromFormat,
    'to_format': toFormat
  });

  return function onConvertComplete() {
    const processingTime = Date.now() - startTime;
    trackToolCompletion(toolName, processingTime);
  };
}

/**
 * Sign PDF Tool tracking
 */
function trackSignPDF() {
  const startTime = Date.now();
  trackToolStart('Sign PDF', 'pdf_sign');

  return function onSignComplete() {
    const processingTime = Date.now() - startTime;
    trackToolCompletion('Sign PDF', processingTime);
  };
}

// ============================================
// AUTO-TRACKING SETUP FUNCTIONS
// ============================================

/**
 * Setup scroll depth tracking
 * Call this once on page load
 */
function setupScrollDepthTracking() {
  let scrolledDepths = new Set();

  function checkScrollDepth() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const scrollPercent = Math.round((scrolled / scrollHeight) * 100);

    [25, 50, 75, 100].forEach(depth => {
      if (scrollPercent >= depth && !scrolledDepths.has(depth)) {
        trackScrollDepth(depth);
        scrolledDepths.add(depth);
      }
    });
  }

  window.addEventListener('scroll', checkScrollDepth, { passive: true });
  console.log('[GA4] Scroll depth tracking enabled');
}

/**
 * Setup automatic link click tracking
 * Call this once on page load
 */
function setupLinkClickTracking() {
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');

    if (link && link.href) {
      const isInternal = link.href.includes(window.location.hostname);
      const isNotDownload = !link.href.endsWith('.pdf') && !link.href.endsWith('.zip');

      if (isInternal && isNotDownload) {
        trackInternalLinkClick(
          link.textContent.trim(),
          link.href,
          link.className.includes('cta') ? 'cta' : 'navigation'
        );
      }
    }
  }, false);

  console.log('[GA4] Link click tracking enabled');
}

/**
 * Setup button click tracking
 * Call this once on page load
 */
function setupButtonClickTracking() {
  document.addEventListener('click', function(e) {
    const button = e.target.closest('button');

    if (button) {
      const buttonText = button.textContent.trim();
      const isCTA = button.className.includes('btn-primary') ||
                    button.className.includes('cta');

      if (isCTA) {
        // Get associated tool name if in a tool context
        const toolContext = button.closest('[data-tool]');
        const toolName = toolContext ? toolContext.getAttribute('data-tool') : null;

        trackCTAClick(buttonText, toolName);
      }
    }
  }, false);

  console.log('[GA4] Button click tracking enabled');
}

/**
 * Setup form submission tracking
 * Call this once on page load
 */
function setupFormSubmissionTracking() {
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const formName = form.name || form.id || 'unnamed_form';
    trackFormSubmission(formName);
  }, false);

  console.log('[GA4] Form submission tracking enabled');
}

/**
 * Initialize all automatic tracking
 * Call this once when page loads (best in <script> tag near </body>)
 */
function initializeGA4Tracking() {
  // Setup scroll depth
  if (document.body.scrollHeight > window.innerHeight) {
    setupScrollDepthTracking();
  }

  // Setup link tracking
  setupLinkClickTracking();

  // Setup button tracking
  setupButtonClickTracking();

  // Setup form tracking
  setupFormSubmissionTracking();

  console.log('[GA4] All automatic tracking initialized');
}

// ============================================
// CONVERSION GOALS
// ============================================

/**
 * Mark a major milestone as conversion
 * Use for significant user actions
 */
function trackConversion(conversionName, conversionValue = 1) {
  gtag('event', 'conversion', {
    'event_category': 'conversion',
    'event_label': conversionName,
    'value': conversionValue
  });
  console.log('[GA4] Conversion tracked:', conversionName);
}

/**
 * Track user registration (if applicable)
 */
function trackUserSignup() {
  trackConversion('User Signup');
}

/**
 * Track premium feature purchase (if applicable)
 */
function trackPremiumPurchase(productName, price) {
  gtag('event', 'purchase', {
    'event_category': 'ecommerce',
    'event_label': productName,
    'value': price,
    'currency': 'USD'
  });
  console.log('[GA4] Premium purchase tracked:', productName, price);
}

// ============================================
// CUSTOM EVENTS FOR SPECIFIC SCENARIOS
// ============================================

/**
 * Track file drag and drop
 */
function trackDragDrop() {
  gtag('event', 'engagement', {
    'event_category': 'engagement',
    'event_label': 'drag_drop_used'
  });
}

/**
 * Track tool sharing (if applicable)
 */
function trackShare(toolName, shareMethod = 'social') {
  gtag('event', 'share', {
    'event_category': 'engagement',
    'event_label': toolName,
    'share_method': shareMethod
  });
  console.log('[GA4] Share tracked:', toolName, shareMethod);
}

/**
 * Track content feedback (if applicable)
 */
function trackFeedback(feedbackType, feedbackContent = null) {
  gtag('event', 'feedback', {
    'event_category': 'engagement',
    'event_label': feedbackType,
    'feedback_content': feedbackContent
  });
  console.log('[GA4] Feedback tracked:', feedbackType);
}

// ============================================
// DEBUGGING & TESTING
// ============================================

/**
 * Enable GA4 debug mode (shows detailed logging)
 */
function enableGA4DebugMode() {
  gtag('config', 'G-K2TCJVQ6KR', {
    'debug_mode': true
  });
  console.log('[GA4] Debug mode enabled - check Chrome DevTools');
}

/**
 * Get user ID (if set)
 */
function getGA4UserID() {
  return gtag('get', 'G-K2TCJVQ6KR', 'user_id') || 'Not set';
}

/**
 * Test conversion event
 */
function testConversionEvent() {
  console.log('[GA4 TEST] Firing test conversion event...');
  trackToolCompletion('Test Tool', 5000);
  setTimeout(() => {
    console.log('[GA4 TEST] Check GA4 Real-time Report > Events');
  }, 1000);
}

// ============================================
// EXPORT FOR TESTING
// ============================================

// Uncomment for testing in browser console:
// window.GA4 = {
//   trackPDFUpload,
//   trackToolCompletion,
//   trackPDFDownload,
//   initializeGA4Tracking,
//   testConversionEvent
// };

console.log('[GA4] Conversion tracking module loaded');
