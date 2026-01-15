/**
 * Table of Contents Plugin for Eleventy
 * Uses HTML transform to extract headings after IdAttributePlugin has added IDs
 */

/**
 * Extract headings from HTML content
 * @param {string} content - HTML content to parse
 * @param {object} options - Options for extraction
 * @returns {Array} Array of heading objects with id, text, and level
 */
function extractHeadings(content, options = {}) {
	const { levels = [2, 3, 4] } = options;
	const headings = [];

	if (!content) return headings;

	// Create regex pattern for specified heading levels
	const levelPattern = levels.join("|");
	const headingRegex = new RegExp(
		`<h(${levelPattern})([^>]*)>([\\s\\S]*?)<\\/h\\1>`,
		"gi"
	);

	let match;

	while ((match = headingRegex.exec(content)) !== null) {
		const level = parseInt(match[1], 10);
		const attributes = match[2];
		const innerHtml = match[3];

		// Extract id from attributes - headings should already have IDs from IdAttributePlugin
		const idMatch = attributes.match(/id=["']([^"']+)["']/);
		const id = idMatch ? idMatch[1] : null;

		// Only include headings that have an ID
		if (!id) continue;

		// Clean the text content (remove HTML tags and anchor symbols)
		const text = innerHtml
			.replace(/<[^>]*>/g, "")
			.replace(/^#\s*/, "")
			.trim();

		headings.push({
			id,
			text,
			level,
		});
	}

	return headings;
}

/**
 * Generate TOC HTML markup
 * @param {Array} headings - Array of heading objects
 * @param {object} options - Options for rendering
 * @returns {string} HTML string for TOC
 */
function generateTocHtml(headings, options = {}) {
	const { title = "On this page", listId = "toc-list" } = options;

	if (!headings || headings.length === 0) {
		return "";
	}

	let html = `<aside class="toc-sidebar">
    <nav class="toc-nav" aria-label="Table of Contents">
        <h2 class="toc-title">${title}</h2>
        <ul class="toc-list" id="${listId}">`;

	for (const heading of headings) {
		html += `
            <li>
                <a href="#${heading.id}" class="toc-link" data-level="${heading.level}">${heading.text}</a>
            </li>`;
	}

	html += `
        </ul>
    </nav>
</aside>`;

	return html;
}

/**
 * TOC scroll-spy JavaScript code
 */
const tocScrollSpyScript = `
// Table of Contents Scroll Spy
(function() {
    const tocList = document.getElementById('toc-list');
    const postContent = document.querySelector('.post-content');
    
    if (!tocList || !postContent) return;
    
    const headings = postContent.querySelectorAll('h2, h3, h4');
    
    if (headings.length === 0) {
        const tocSidebar = document.querySelector('.toc-sidebar');
        if (tocSidebar) tocSidebar.style.display = 'none';
        return;
    }
    
    // Add click handlers for smooth scrolling
    tocList.querySelectorAll('.toc-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').slice(1);
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                history.pushState(null, null, '#' + targetId);
            }
        });
    });
    
    // Scroll spy with IntersectionObserver
    const tocLinks = tocList.querySelectorAll('.toc-link');
    
    const observerOptions = {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0
    };
    
    let activeLink = null;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.id;
            const link = tocList.querySelector(\`a[href="#\${id}"]\`);
            
            if (entry.isIntersecting && link) {
                if (activeLink) {
                    activeLink.classList.remove('active');
                }
                link.classList.add('active');
                activeLink = link;
            }
        });
    }, observerOptions);
    
    headings.forEach(heading => observer.observe(heading));
})();
`;

/**
 * Eleventy TOC Plugin
 * Uses HTML transform to inject TOC after headings have IDs from IdAttributePlugin
 * @param {object} eleventyConfig - Eleventy configuration object
 * @param {object} pluginOptions - Plugin options
 */
export default function tocPlugin(eleventyConfig, pluginOptions = {}) {
	const options = {
		levels: [2, 3, 4],
		title: "On this page",
		listId: "toc-list",
		minHeadings: 2, // Minimum headings required to show TOC
		...pluginOptions,
	};

	// Add HTML transform to inject TOC after content has heading IDs
	eleventyConfig.addTransform("toc-inject", function (content) {
		// Only process HTML files
		if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) {
			return content;
		}

		// Only process pages with post-content (blog posts)
		if (!content.includes('class="post-content"')) {
			return content;
		}

		// Look for the TOC placeholder comment
		if (!content.includes("<!-- TOC_PLACEHOLDER -->")) {
			return content;
		}

		// Extract headings from the post-content section
		const postContentMatch = content.match(
			/<article class="post-content">([\s\S]*?)<\/article>/
		);
		if (!postContentMatch) {
			return content.replace("<!-- TOC_PLACEHOLDER -->", "");
		}

		const postContent = postContentMatch[1];
		const headings = extractHeadings(postContent, { levels: options.levels });

		// Only show TOC if there are enough headings
		if (headings.length < options.minHeadings) {
			return content.replace("<!-- TOC_PLACEHOLDER -->", "");
		}

		// Generate TOC HTML
		const tocHtml = generateTocHtml(headings, {
			title: options.title,
			listId: options.listId,
		});

		// Generate the scroll-spy script
		const tocScriptHtml = `<script>${tocScrollSpyScript}</script>`;

		// Replace placeholder with TOC and add script before closing body
		content = content.replace("<!-- TOC_PLACEHOLDER -->", tocHtml);
		content = content.replace("</body>", `${tocScriptHtml}\n</body>`);

		return content;
	});

	// Keep filter for programmatic access if needed
	eleventyConfig.addFilter("tableOfContents", function (content) {
		return extractHeadings(content, { levels: options.levels });
	});
}
