/**
 * HTML Sanitization for Plugin Content
 *
 * Uses DOMPurify to prevent XSS attacks from malicious plugin content.
 *
 * SECURITY NOTES:
 * - All plugin-generated HTML must be sanitized before insertion
 * - Inline event handlers (onclick, etc.) are stripped
 * - JavaScript URLs are blocked
 * - Only safe HTML tags and attributes are allowed
 */

import DOMPurify from "dompurify";

/**
 * Configure DOMPurify with strict settings for plugin content
 */
const purifyConfig = {
  // Allow common safe tags
  ALLOWED_TAGS: [
    // Structure
    "div",
    "span",
    "p",
    "br",
    "hr",
    // Text formatting
    "b",
    "i",
    "u",
    "s",
    "strong",
    "em",
    "mark",
    "small",
    "sub",
    "sup",
    "code",
    "pre",
    "kbd",
    // Lists
    "ul",
    "ol",
    "li",
    // Tables
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    // Links (href will be validated)
    "a",
    // Headers
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Media (controlled)
    "img",
    // Forms (display only, no submission)
    "label",
    "input",
    "button",
    "select",
    "option",
    "textarea",
    // SVG basics
    "svg",
    "path",
    "circle",
    "rect",
    "line",
    "polyline",
    "polygon",
    "g",
  ],

  // Allow common safe attributes
  ALLOWED_ATTR: [
    // Global
    "id",
    "class",
    "style",
    "title",
    "aria-label",
    "aria-hidden",
    "role",
    "data-*",
    // Links
    "href",
    "target",
    "rel",
    // Images
    "src",
    "alt",
    "width",
    "height",
    // Forms
    "type",
    "name",
    "value",
    "placeholder",
    "disabled",
    "readonly",
    "checked",
    "selected",
    // Tables
    "colspan",
    "rowspan",
    // SVG
    "viewBox",
    "fill",
    "stroke",
    "stroke-width",
    "d",
    "cx",
    "cy",
    "r",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "points",
    "transform",
  ],

  // Block dangerous URI schemes
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

  // Forbid certain protocols
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "onchange",
    "onsubmit",
    "onkeydown",
    "onkeyup",
    "onkeypress",
  ],

  // Additional security
  ADD_ATTR: ["target"], // Allow target for links
  ADD_TAGS: [], // No additional tags

  // Return DOM nodes instead of string for better security
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,

  // Sanitize href and src attributes
  SANITIZE_DOM: true,
};

/**
 * Sanitize HTML content from plugins
 *
 * @param dirty - Untrusted HTML string from plugin
 * @returns Sanitized HTML string safe for innerHTML
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, purifyConfig);
}

/**
 * Sanitize a DOM element's content in place
 * Use this after a plugin has manipulated the DOM
 *
 * @param element - DOM element to sanitize
 */
export function sanitizeElement(element: HTMLElement): void {
  // Get the current HTML
  const dirty = element.innerHTML;

  // Sanitize and replace
  element.innerHTML = DOMPurify.sanitize(dirty, purifyConfig);
}

/**
 * Create a MutationObserver that sanitizes any changes to an element
 * This provides real-time protection against DOM manipulation
 *
 * @param element - Element to observe
 * @returns Cleanup function to disconnect the observer
 */
export function observeAndSanitize(element: HTMLElement): () => void {
  const observer = new MutationObserver((mutations) => {
    // Temporarily disconnect to avoid infinite loop
    observer.disconnect();

    // Check if any mutation added potentially dangerous content
    let needsSanitization = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            // Check for dangerous patterns
            if (
              el.querySelector("script, iframe, object, embed") ||
              el.innerHTML.includes("javascript:") ||
              el.innerHTML.includes("on") // Potential event handlers
            ) {
              needsSanitization = true;
              break;
            }
          }
        }
      } else if (mutation.type === "attributes") {
        const attrName = mutation.attributeName?.toLowerCase() || "";
        if (
          attrName.startsWith("on") ||
          attrName === "href" ||
          attrName === "src"
        ) {
          needsSanitization = true;
        }
      }
    }

    if (needsSanitization) {
      sanitizeElement(element);
    }

    // Reconnect observer
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "href",
        "src",
        "onclick",
        "onerror",
        "onload",
        "onmouseover",
      ],
    });
  });

  // Start observing
  observer.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "href",
      "src",
      "onclick",
      "onerror",
      "onload",
      "onmouseover",
    ],
  });

  // Return cleanup function
  return () => observer.disconnect();
}

