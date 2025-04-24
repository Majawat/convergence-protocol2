/**
 * @fileoverview Handles finding defined terms in text nodes and attaching Bootstrap Popovers.
 */
import { getDefinitions } from "./state.js"; // Import state getter

// Store initialized popover instances to prevent duplicates
const initializedPopovers = new WeakSet();

/**
 * Initializes the definition popover system on the page.
 * Finds elements with '.allow-definitions' and processes them.
 */
export function initializeDefinitionsSystem() {
  console.log("Initializing definitions system...");
  const definitions = getDefinitions(); // Get definitions from state/sessionStorage
  if (!definitions || Object.keys(definitions).length === 0) {
    console.warn("Definitions not available or empty. Skipping popover initialization.");
    return;
  }

  // Sort terms by length descending to match longest terms first
  const sortedTerms = Object.keys(definitions)
    .filter((term) => term && term.length >= 3) // Basic filter for meaningful terms
    .sort((a, b) => b.length - a.length);

  if (sortedTerms.length === 0) {
    console.log("No terms found to process for popovers.");
    return;
  }

  const elementsToProcess = document.querySelectorAll(".allow-definitions");
  console.log(`Found ${elementsToProcess.length} elements to process for definitions.`);

  elementsToProcess.forEach((element) => {
    if (element.dataset.definitionsProcessed === "true") {
      // console.debug("Skipping already processed element:", element);
      return; // Skip already processed elements
    }
    processElementForPopovers(element, definitions, sortedTerms);
    element.dataset.definitionsProcessed = "true"; // Mark as processed
  });

  // Initialize Bootstrap Popovers on the newly added spans
  initializeBootstrapPopovers();
  console.log("Definitions system initialization complete.");
}

/**
 * Traverses the DOM within an element to find and wrap terms in text nodes.
 * @param {HTMLElement} element - The parent element to process.
 * @param {object} definitions - The definitions object.
 * @param {string[]} sortedTerms - Terms sorted by length descending.
 */
function processElementForPopovers(element, definitions, sortedTerms) {
  // Use TreeWalker to efficiently find all text nodes within the element
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT, // Only interested in text nodes
    {
      acceptNode: function (node) {
        // Skip nodes inside existing definition spans or script/style tags
        if (node.parentElement.closest(".definition, script, style, a")) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip nodes that are only whitespace
        if (!/\S/.test(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  const nodesToProcess = [];
  // Collect all relevant text nodes first to avoid issues with modifying the DOM during traversal
  while ((node = walker.nextNode())) {
    nodesToProcess.push(node);
  }

  // Process collected text nodes
  nodesToProcess.forEach((textNode) => {
    wrapTermsInTextNode(textNode, definitions, sortedTerms);
  });
}

/**
 * Finds defined terms within a text node and wraps them with popover spans.
 * Modifies the DOM by replacing the text node with new text/span nodes.
 * @param {Text} textNode - The text node to process.
 * @param {object} definitions - The definitions object.
 * @param {string[]} sortedTerms - Terms sorted by length descending.
 */
function wrapTermsInTextNode(textNode, definitions, sortedTerms) {
  let currentText = textNode.nodeValue;
  const parent = textNode.parentNode;
  if (!parent) return; // Should not happen, but safety check

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  // Iterate through the text to find matches
  while (lastIndex < currentText.length) {
    let foundMatch = false;
    let bestMatch = null; // { term, index, length }

    // Check for matches starting from lastIndex
    const remainingText = currentText.substring(lastIndex);

    // Find the *first* occurrence of *any* term in the remaining text
    for (const term of sortedTerms) {
      // Case-insensitive search, but preserve original case for wrapping
      const termIndexInRemaining = remainingText.toLowerCase().indexOf(term.toLowerCase());

      if (termIndexInRemaining !== -1) {
        const actualIndex = lastIndex + termIndexInRemaining;
        const termLength = term.length;

        // Word boundary check
        const beforeChar = actualIndex > 0 ? currentText[actualIndex - 1] : " ";
        const afterChar =
          actualIndex + termLength < currentText.length
            ? currentText[actualIndex + termLength]
            : " ";
        const isWordBoundaryBefore = !/\w/.test(beforeChar); // Check if char before is NOT a word character
        const isWordBoundaryAfter = !/\w/.test(afterChar); // Check if char after is NOT a word character

        if (isWordBoundaryBefore && isWordBoundaryAfter) {
          // Found a potential match. Is it the earliest one?
          if (!bestMatch || actualIndex < bestMatch.index) {
            bestMatch = { term, index: actualIndex, length: termLength };
          }
        }
      }
    }

    // If we found a match starting at or after lastIndex
    if (bestMatch) {
      // Add text before the match
      if (bestMatch.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(currentText.substring(lastIndex, bestMatch.index))
        );
      }

      // Create and add the popover span
      const definition = definitions[bestMatch.term];
      const span = document.createElement("span");
      span.className = "definition"; // Class for styling
      span.textContent = currentText.substring(bestMatch.index, bestMatch.index + bestMatch.length); // Use original casing

      // Set Bootstrap Popover attributes
      span.dataset.bsToggle = "popover";
      span.dataset.bsTrigger = "hover focus"; // Show on hover/focus (good for desktop/keyboard) - consider 'click' for mobile focus
      span.dataset.bsHtml = "true"; // Allow HTML in content
      span.dataset.bsPlacement = "top";
      span.dataset.bsTitle = escapeHtml(bestMatch.term); // Popover title
      // Create simple HTML content for the popover body
      span.dataset.bsContent = `<p class="mb-0">${escapeHtml(definition.description)}</p>`; // Popover body

      fragment.appendChild(span);

      // Update lastIndex to continue searching after the current match
      lastIndex = bestMatch.index + bestMatch.length;
      foundMatch = true;
    }

    // If no match was found in the remaining text, add the rest and break
    if (!foundMatch) {
      if (lastIndex < currentText.length) {
        fragment.appendChild(document.createTextNode(currentText.substring(lastIndex)));
      }
      break;
    }
  }

  // Replace the original text node with the fragment containing text and spans
  if (fragment.childNodes.length > 0) {
    parent.replaceChild(fragment, textNode);
  }
}

/**
 * Initializes Bootstrap Popovers on elements with the correct attribute.
 * Prevents re-initializing on the same element.
 */
function initializeBootstrapPopovers() {
  // console.debug("Initializing Bootstrap Popovers...");
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
  let initializedCount = 0;

  popoverTriggerList.forEach((popoverTriggerEl) => {
    // Check if already initialized using our WeakSet
    if (!initializedPopovers.has(popoverTriggerEl)) {
      try {
        new bootstrap.Popover(popoverTriggerEl, {
          sanitize: false, // Allow the HTML we carefully constructed
        });
        initializedPopovers.add(popoverTriggerEl); // Mark as initialized
        initializedCount++;
      } catch (e) {
        console.error("Error initializing Bootstrap popover:", e, popoverTriggerEl);
      }
    }
  });

  if (initializedCount > 0) {
    console.log(`Initialized ${initializedCount} new Bootstrap popovers.`);
  }
}

/**
 * Basic HTML escaping function.
 * @param {string} unsafe - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
