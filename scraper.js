/**
 * Instagram Scraper - Post and Reel Support
 * Supports: Posts, Carousels, and Reels
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'cookies.json');
const TIMEOUT = parseInt(process.env.TIMEOUT) || 60000;
const HEADLESS = process.env.HEADLESS !== 'false';

/**
 * Validate Instagram URL (post or reel)
 */
function isValidInstagramUrl(url) {
    return /instagram\.com\/(p|reel|reels|tv)\/[\w-]+/i.test(url);
}

/**
 * Check if URL is a reel URL
 */
function isReelUrl(url) {
    return /instagram\.com\/reel/i.test(url);
}

/**
 * Extract shortcode from post/reel URL
 */
function extractShortcode(url) {
    const match = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([\w-]+)/);
    return match ? match[1] : null;
}

/**
 * Load cookies from file
 */
function loadCookies() {
    try {
        if (fs.existsSync(COOKIES_PATH)) {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
            if (Array.isArray(cookies) && cookies.length > 0) {
                const sessionCookie = cookies.find(c => c.name === 'sessionid');
                if (sessionCookie && !sessionCookie.value.includes('YOUR_')) {
                    return cookies;
                }
            }
        }
    } catch (e) {
        console.error('Cookie error:', e.message);
    }
    return [];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeUrl(url) {
    if (!url) return url;
    return url
        .replace(/\\u0026/g, '&')
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/\\/g, '');
}

/**
 * Main scraper function - handles posts and reels
 */
async function scrapeInstagramPost(url) {
    if (!isValidInstagramUrl(url)) {
        return { success: false, error: 'Invalid URL. Please enter a valid Instagram post or reel URL.', code: 'INVALID_URL' };
    }

    const shortcode = extractShortcode(url);
    if (!shortcode) {
        return { success: false, error: 'Shortcode not found', code: 'INVALID_URL' };
    }

    const isReel = isReelUrl(url);
    console.log('Processing shortcode:', shortcode, isReel ? '(REEL)' : '(POST)');

    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: HEADLESS ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--no-first-run',
                '--window-size=1280,720',
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: { width: 1280, height: 720 }
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        // Load cookies if available
        const cookies = loadCookies();
        if (cookies.length > 0) {
            await page.setCookie(...cookies);
            console.log('Cookies loaded');
        } else {
            console.log('No valid cookies');
        }

        // Navigate to post
        const postUrl = isReel
            ? `https://www.instagram.com/reel/${shortcode}/`
            : `https://www.instagram.com/p/${shortcode}/`;

        console.log('Loading:', postUrl);

        await page.goto(postUrl, {
            waitUntil: 'domcontentloaded', // Faster than networkidle2
            timeout: TIMEOUT
        });

        await delay(1000); // Reduced from 3000ms

        // Check for errors
        const pageContent = await page.content();

        if (pageContent.includes('Page Not Found') ||
            pageContent.includes("Sorry, this page isn't available")) {
            await browser.close();
            return { success: false, error: 'Post not found', code: 'NOT_FOUND' };
        }

        // Extract username from page - get POST OWNER, not commenters
        const username = await page.evaluate(() => {
            const html = document.documentElement.innerHTML;

            // Method 1: From owner.username in JSON (most reliable)
            const ownerPatterns = [
                /"owner"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/,
                /"user"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/,
                /"author"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/
            ];

            for (const pattern of ownerPatterns) {
                const match = html.match(pattern);
                if (match && match[1] && match[1].length > 1) {
                    return match[1];
                }
            }

            // Method 2: From article header link
            const headerLink = document.querySelector('article header a[href^="/"]');
            if (headerLink) {
                const href = headerLink.getAttribute('href');
                if (href && href.match(/^\/[a-zA-Z0-9_.]+\/?$/)) {
                    const name = href.replace(/\//g, '');
                    if (name && name.length > 1) return name;
                }
            }

            // Method 3: From first username link in article
            const usernameLinks = document.querySelectorAll('article a[href^="/"]');
            for (const link of usernameLinks) {
                const href = link.getAttribute('href');
                if (href && href.match(/^\/[a-zA-Z0-9_.]+\/?$/) && !href.includes('/p/') && !href.includes('/reel/')) {
                    const name = href.replace(/\//g, '');
                    if (name && name.length > 1 && !['explore', 'reels', 'stories'].includes(name)) {
                        return name;
                    }
                }
            }

            // Method 4: From page title (@username pattern)
            const title = document.title;
            const titleMatch = title.match(/@([a-zA-Z0-9_.]+)/);
            if (titleMatch && titleMatch[1]) return titleMatch[1];

            // Method 5: From og:title or twitter:title meta
            const metaTags = document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]');
            for (const meta of metaTags) {
                const content = meta.getAttribute('content');
                const match = content?.match(/@([a-zA-Z0-9_.]+)/);
                if (match && match[1]) return match[1];
            }

            // Method 6: Search for username pattern in visible text
            const usernamePattern = /"username"\s*:\s*"([a-zA-Z0-9_.]+)"/g;
            const matches = [...html.matchAll(usernamePattern)];
            if (matches.length > 0) {
                // Return the first username found (usually the post owner)
                return matches[0][1];
            }

            return 'unknown';
        });

        console.log('Username:', username);

        // Extract from page source
        console.log('Extracting from page source...');

        const extractedMedia = await page.evaluate((isReel) => {
            const html = document.documentElement.innerHTML;
            const results = [];
            const seenUrls = new Set();

            const addMedia = (type, url) => {
                if (url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    results.push({ type, url });
                }
            };

            const decode = (url) => {
                if (!url) return url;
                return url
                    .replace(/\\u0026/g, '&')
                    .replace(/\\\//g, '/')
                    .replace(/\\/g, '');
            };

            // First, extract video thumbnail (specific patterns for video covers)
            let videoThumbnail = null;

            // Look for thumbnail_src which is video cover
            const thumbSrcMatch = html.match(/"thumbnail_src"\s*:\s*"(https?:[^"]+)"/);
            if (thumbSrcMatch && thumbSrcMatch[1]) {
                videoThumbnail = decode(thumbSrcMatch[1]);
            }

            // Also try poster_url for videos
            if (!videoThumbnail) {
                const posterMatch = html.match(/"poster"\s*:\s*"(https?:[^"]+)"/);
                if (posterMatch && posterMatch[1]) {
                    videoThumbnail = decode(posterMatch[1]);
                }
            }

            // Try image from video media object
            if (!videoThumbnail) {
                // Look for display_url right before or after video_url
                const videoSection = html.match(/"video_url"[^}]{0,500}"display_url"\s*:\s*"(https?:[^"]+)"/);
                if (videoSection && videoSection[1]) {
                    videoThumbnail = decode(videoSection[1]);
                }
            }

            // Fallback to first large image
            if (!videoThumbnail) {
                const displayMatch = html.match(/"display_url"\s*:\s*"(https?:[^"]+)"/);
                if (displayMatch && displayMatch[1]) {
                    videoThumbnail = decode(displayMatch[1]);
                }
            }

            // Video patterns (for reels)
            const videoUrlPatterns = [
                /"video_url"\s*:\s*"(https?:[^"]+)"/g,
                /"playback_url"\s*:\s*"(https?:[^"]+)"/g,
                /"video_versions"\s*:\s*\[\s*\{\s*[^}]*"url"\s*:\s*"(https?:[^"]+)"/g,
                /"src"\s*:\s*"(https?:[^"]+\.mp4[^"]*)"/g,
                /"baseURL"\s*:\s*"(https?:[^"]+\.mp4[^"]*)"/g
            ];

            for (const pattern of videoUrlPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const url = decode(match[1]);
                    if (url && (url.includes('.mp4') || url.includes('video'))) {
                        // Add video with thumbnail
                        if (!seenUrls.has(url)) {
                            seenUrls.add(url);
                            results.push({ type: 'video', url, thumbnail: videoThumbnail });
                        }
                    }
                }
            }

            // Image patterns
            const imagePatterns = [
                /"display_url"\s*:\s*"(https?:[^"]+)"/g,
                /"display_src"\s*:\s*"(https?:[^"]+)"/g,
                /"candidates"\s*:\s*\[\s*\{\s*"url"\s*:\s*"(https?:[^"]+)"/g
            ];

            for (const pattern of imagePatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const url = decode(match[1]);
                    if (url &&
                        !url.includes('s150x150') &&
                        !url.includes('s320x320') &&
                        !url.includes('s640x640') &&
                        (url.includes('scontent') || url.includes('cdninstagram') || url.includes('fbcdn'))) {
                        addMedia('image', url);
                    }
                }
            }

            // For Reels, prioritize video
            if (isReel && results.some(r => r.type === 'video')) {
                return results.filter(r => r.type === 'video');
            }

            return results;
        }, isReel);

        if (extractedMedia.length > 0) {
            console.log(`Found ${extractedMedia.length} media from page source`);

            let finalMedia = extractedMedia;
            if (isReel) {
                const videos = extractedMedia.filter(m => m.type === 'video');
                if (videos.length > 0) {
                    finalMedia = videos;
                }
            }

            await browser.close();
            return { success: true, media: finalMedia, count: finalMedia.length, username };
        }

        // Carousel navigation for image posts
        if (!isReel) {
            console.log('Navigating carousel...');

            const carouselMedia = [];
            const seenUrls = new Set();
            let slideCount = 0;
            const maxSlides = 20;

            const extractCurrentView = async () => {
                return await page.evaluate(() => {
                    const results = [];
                    const article = document.querySelector('article');
                    if (!article) return results;

                    const images = article.querySelectorAll('img[srcset]');
                    for (const img of images) {
                        const srcset = img.srcset;
                        if (!srcset) continue;

                        const sources = srcset.split(',').map(s => {
                            const parts = s.trim().split(' ');
                            return { url: parts[0], width: parseInt(parts[1]) || 0 };
                        });

                        const best = sources.reduce((a, b) => a.width > b.width ? a : b, { width: 0 });

                        if (best.url && !best.url.includes('s150x150') && !best.url.includes('44x44')) {
                            const rect = img.getBoundingClientRect();
                            if (rect.width > 150) {
                                results.push({ type: 'image', url: best.url });
                            }
                        }
                    }

                    const videos = article.querySelectorAll('video');
                    for (const video of videos) {
                        const src = video.src || video.querySelector('source')?.src;
                        if (src && !src.startsWith('blob:')) {
                            results.push({ type: 'video', url: src });
                        }
                    }

                    return results;
                });
            };

            let currentMedia = await extractCurrentView();
            for (const m of currentMedia) {
                if (!seenUrls.has(m.url)) {
                    seenUrls.add(m.url);
                    carouselMedia.push(m);
                }
            }

            while (slideCount < maxSlides) {
                const hasNext = await page.evaluate(() => {
                    const btn = document.querySelector('button[aria-label="Next"], button[aria-label="Berikutnya"]');
                    if (btn && getComputedStyle(btn).display !== 'none') {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (!hasNext) break;

                slideCount++;
                await delay(400); // Reduced from 800ms

                currentMedia = await extractCurrentView();
                for (const m of currentMedia) {
                    if (!seenUrls.has(m.url)) {
                        seenUrls.add(m.url);
                        carouselMedia.push(m);
                    }
                }
            }

            if (carouselMedia.length > 0) {
                console.log(`Found ${carouselMedia.length} media from carousel`);
                await browser.close();
                return { success: true, media: carouselMedia, count: carouselMedia.length, username };
            }
        }

        await browser.close();

        return {
            success: false,
            error: 'Could not find media. The post may be private or unavailable.',
            code: 'NO_MEDIA'
        };

    } catch (error) {
        console.error('Error:', error.message);
        if (browser) await browser.close();
        return { success: false, error: error.message, code: 'ERROR' };
    }
}

module.exports = {
    scrapeInstagramPost,
    isValidInstagramUrl
};
