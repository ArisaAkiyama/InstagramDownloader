/**
 * Error Recovery & Diagnostics
 * Graceful handling when Instagram structure changes
 */

const fs = require('fs');
const path = require('path');

const DIAGNOSTICS_DIR = path.join(__dirname, 'diagnostics');
const KNOWN_PATTERNS_VERSION = '2025-12-19'; // Update when patterns change

// Known Instagram page structure signatures
const STRUCTURE_SIGNATURES = {
    // Key elements that should exist on a valid post page
    postElements: [
        '"shortcode"',
        '"owner"',
        '"edge_',
        'PolarisPostRootQuery'
    ],
    // Key elements for media extraction
    mediaElements: [
        '"display_url"',
        '"video_url"',
        '"image_versions2"',
        '"video_versions"'
    ],
    // Signs of Instagram structure change
    warningPatterns: [
        'You must log in to continue',
        'Create an account',
        'Install the app'
    ]
};

class ErrorRecovery {
    constructor() {
        this.errorCounts = {};
        this.lastDiagnostic = null;
    }

    /**
     * Analyze page content and detect structure issues
     */
    analyzePage(html, url) {
        const diagnostic = {
            url,
            timestamp: new Date().toISOString(),
            patternsVersion: KNOWN_PATTERNS_VERSION,
            issues: [],
            suggestions: [],
            structureValid: true
        };

        // Check for login wall
        for (const warning of STRUCTURE_SIGNATURES.warningPatterns) {
            if (html.includes(warning)) {
                diagnostic.issues.push(`Login wall detected: "${warning}"`);
                diagnostic.suggestions.push('Consider adding valid cookies.json');
                diagnostic.structureValid = false;
            }
        }

        // Check if post structure elements exist
        const foundPostElements = STRUCTURE_SIGNATURES.postElements.filter(el => html.includes(el));
        if (foundPostElements.length === 0) {
            diagnostic.issues.push('No post structure elements found');
            diagnostic.suggestions.push('Instagram may have changed page structure');
            diagnostic.structureValid = false;
        } else if (foundPostElements.length < 2) {
            diagnostic.issues.push(`Only ${foundPostElements.length} post elements found (expected 2+)`);
            diagnostic.suggestions.push('Page may not have fully loaded');
        }

        // Check for media elements
        const foundMediaElements = STRUCTURE_SIGNATURES.mediaElements.filter(el => html.includes(el));
        if (foundMediaElements.length === 0) {
            diagnostic.issues.push('No media URL patterns found in page');
            diagnostic.suggestions.push('Post may be private or media patterns changed');
        }

        // Check page length (very short page = likely blocked)
        if (html.length < 5000) {
            diagnostic.issues.push(`Page unusually short (${html.length} chars)`);
            diagnostic.suggestions.push('May be blocked or rate limited');
            diagnostic.structureValid = false;
        }

        // Check for specific error pages
        if (html.includes('Page Not Found') || html.includes("isn't available")) {
            diagnostic.issues.push('Post not found or unavailable');
            diagnostic.structureValid = false;
        }

        this.lastDiagnostic = diagnostic;
        return diagnostic;
    }

    /**
     * Save diagnostic info for debugging
     */
    async saveDiagnostic(html, diagnostic) {
        try {
            if (!fs.existsSync(DIAGNOSTICS_DIR)) {
                fs.mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
            }

            const timestamp = Date.now();
            const shortcode = diagnostic.url?.match(/\/(p|reel)\/([^\/]+)/)?.[2] || 'unknown';

            // Save diagnostic JSON
            const diagPath = path.join(DIAGNOSTICS_DIR, `diag_${shortcode}_${timestamp}.json`);
            fs.writeFileSync(diagPath, JSON.stringify(diagnostic, null, 2));

            // Save page HTML for analysis (truncated)
            const htmlPath = path.join(DIAGNOSTICS_DIR, `page_${shortcode}_${timestamp}.html`);
            const truncatedHtml = html.length > 100000 ? html.substring(0, 100000) + '\n<!-- TRUNCATED -->' : html;
            fs.writeFileSync(htmlPath, truncatedHtml);

            console.log(`📋 Diagnostic saved: ${diagPath}`);

            // Clean old diagnostics (keep last 10)
            this.cleanOldDiagnostics();

        } catch (e) {
            console.error('Failed to save diagnostic:', e.message);
        }
    }

    /**
     * Clean old diagnostic files
     */
    cleanOldDiagnostics() {
        try {
            const files = fs.readdirSync(DIAGNOSTICS_DIR)
                .filter(f => f.startsWith('diag_') || f.startsWith('page_'))
                .map(f => ({ name: f, time: fs.statSync(path.join(DIAGNOSTICS_DIR, f)).mtime }))
                .sort((a, b) => b.time - a.time);

            // Keep only last 10 files each type
            const toDelete = files.slice(20);
            for (const file of toDelete) {
                fs.unlinkSync(path.join(DIAGNOSTICS_DIR, file.name));
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    /**
     * Generate helpful error message based on diagnostic
     */
    getErrorMessage(diagnostic) {
        if (!diagnostic.structureValid) {
            if (diagnostic.issues.some(i => i.includes('Login wall'))) {
                return 'Instagram requires login. Please add valid cookies to cookies.json';
            }
            if (diagnostic.issues.some(i => i.includes('Not Found'))) {
                return 'Post not found or has been deleted';
            }
            if (diagnostic.issues.some(i => i.includes('short'))) {
                return 'Instagram may have blocked this request. Try again later';
            }
            return 'Instagram page structure may have changed. Check diagnostics folder for details';
        }

        if (diagnostic.issues.length > 0) {
            return `Extraction issues: ${diagnostic.issues[0]}`;
        }

        return 'Unknown error occurred';
    }

    /**
     * Track error patterns
     */
    trackError(errorType) {
        this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;
    }

    /**
     * Get error stats
     */
    getStats() {
        return {
            patternsVersion: KNOWN_PATTERNS_VERSION,
            errorCounts: this.errorCounts,
            lastDiagnostic: this.lastDiagnostic ? {
                timestamp: this.lastDiagnostic.timestamp,
                structureValid: this.lastDiagnostic.structureValid,
                issueCount: this.lastDiagnostic.issues.length
            } : null
        };
    }
}

// Singleton
const errorRecovery = new ErrorRecovery();

module.exports = errorRecovery;
