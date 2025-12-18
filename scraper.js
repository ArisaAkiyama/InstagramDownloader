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
            // Method 1: From article header link (most visible/reliable)
            const headerLink = document.querySelector('article header a[href^="/"]');
            if (headerLink) {
                const href = headerLink.getAttribute('href');
                if (href && href.match(/^\/[a-zA-Z0-9_.]+\/?$/)) {
                    const name = href.replace(/\//g, '');
                    if (name && name.length > 1) return name;
                }
            }

            // Method 2: From page title
            const title = document.title;
            const titleMatch = title.match(/@([a-zA-Z0-9_.]+)/);
            if (titleMatch && titleMatch[1]) return titleMatch[1];

            // Method 3: From og:title meta
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) {
                const content = ogTitle.getAttribute('content');
                const match = content?.match(/@([a-zA-Z0-9_.]+)/);
                if (match && match[1]) return match[1];
            }

            // Method 4: From HTML - owner object specifically
            const html = document.documentElement.innerHTML;
            const ownerMatch = html.match(/"owner"\s*:\s*\{\s*"id"\s*:\s*"[^"]+"\s*,\s*"username"\s*:\s*"([^"]+)"/);
            if (ownerMatch && ownerMatch[1]) return ownerMatch[1];

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

/**
 * Check if URL is a story URL
 */
function isStoryUrl(url) {
    return /instagram\.com\/stories\/[^\/]+\/\d+/i.test(url);
}

/**
 * Extract username and story ID from story URL
 */
function extractStoryInfo(url) {
    const match = url.match(/instagram\.com\/stories\/([^\/]+)\/(\d+)/);
    if (match) {
        return { username: match[1], storyId: match[2] };
    }
    return null;
}

/**
 * Scrape Instagram Story using Puppeteer with Network Interception
 */
async function scrapeInstagramStory(url) {
    if (!isStoryUrl(url)) {
        return { success: false, error: 'Invalid story URL', code: 'INVALID_URL' };
    }

    const storyInfo = extractStoryInfo(url);
    if (!storyInfo) {
        return { success: false, error: 'Could not parse story URL', code: 'INVALID_URL' };
    }

    console.log('Processing story:', storyInfo.username, storyInfo.storyId);

    let browser = null;
    const capturedMedia = [];

    try {
        browser = await puppeteer.launch({
            headless: HEADLESS ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Load cookies - REQUIRED for stories
        const cookies = loadCookies();
        if (cookies.length > 0) {
            await page.setCookie(...cookies);
            console.log('Cookies loaded for story access');
        } else {
            console.log('Warning: No cookies - stories may not load');
        }

        // Set up network interception to capture media URLs
        await page.setRequestInterception(true);

        page.on('request', request => {
            request.continue();
        });

        page.on('response', async response => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';

            // ===== VIDEO DETECTION =====
            // Instagram story videos come from fbcdn.net with .mp4 extension OR video content-type
            const isVideo = (
                url.includes('.mp4') ||
                contentType.includes('video/mp4') ||
                contentType.includes('video/')
            );
            const isFromCDN = (
                url.includes('fbcdn.net') ||
                url.includes('cdninstagram') ||
                url.includes('instagram.com')
            );

            if (isVideo && isFromCDN && url.length > 100) {
                console.log('🎬 Video URL detected:', url.substring(0, 150));
                if (!capturedMedia.some(m => m.url === url)) {
                    capturedMedia.push({ type: 'video', url });
                    console.log('✅ Captured VIDEO!');
                }
            }

            // ===== IMAGE DETECTION =====
            // Real story images from scontent domain with /v/t51 or /v/t39 path
            if (contentType.includes('image/')) {
                // Allowed domains for real content
                const isFromScontent = url.includes('scontent');
                const isFromFbcdn = url.includes('fbcdn.net') && url.includes('/v/');

                // Story content path pattern
                const hasStoryPath =
                    url.includes('/v/t51') ||
                    url.includes('/v/t39') ||
                    url.includes('/v/t1.');

                // Block patterns - static resources, logos, thumbnails
                const isBlocked =
                    url.includes('rsrc.php') ||
                    url.includes('/rsrc') ||
                    url.includes('static.') ||
                    url.includes('44x44') ||
                    url.includes('150x150') ||
                    url.includes('profile_pic') ||
                    url.includes('s150x') ||
                    url.includes('s320x') ||
                    url.length < 150;

                if ((isFromScontent || isFromFbcdn) && hasStoryPath && !isBlocked) {
                    if (!capturedMedia.some(m => m.url === url)) {
                        capturedMedia.push({ type: 'image', url });
                        console.log('✅ Captured IMAGE:', url.substring(0, 120) + '...');
                    }
                }
            }
        });

        // Navigate to story
        console.log('Loading story:', url);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUT
        });

        await delay(3000);

        // Note: We skip login check here because network interception may have
        // already captured media even if the page shows a login prompt

        // Also try to extract from page source
        const extractedMedia = await page.evaluate(() => {
            const html = document.documentElement.innerHTML;
            const results = [];
            const seenUrls = new Set();

            const decode = (url) => {
                if (!url) return url;
                return url.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\/g, '');
            };

            const add = (type, url) => {
                url = decode(url);
                if (url && !seenUrls.has(url) && !url.includes('profile_pic')) {
                    seenUrls.add(url);
                    results.push({ type, url });
                }
            };

            // Video patterns
            const videoPatterns = [
                /"video_url"\s*:\s*"(https?:[^"]+)"/g,
                /"playback_url"\s*:\s*"(https?:[^"]+)"/g
            ];

            for (const pattern of videoPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    if (match[1]) add('video', match[1]);
                }
            }

            // Image patterns
            const imagePatterns = [
                /"display_url"\s*:\s*"(https?:[^"]+)"/g
            ];

            for (const pattern of imagePatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const url = match[1];
                    if (url && !url.includes('150x150') && !url.includes('320x320')) {
                        add('image', url);
                    }
                }
            }

            return results;
        });

        // Merge captured media
        for (const m of extractedMedia) {
            if (!capturedMedia.some(existing => existing.url === m.url)) {
                capturedMedia.push(m);
            }
        }

        await browser.close();

        if (capturedMedia.length === 0) {
            return {
                success: false,
                error: 'No media found. Story may require login or has expired.',
                code: 'NO_MEDIA'
            };
        }

        // Filter out thumbnails and small images
        const filteredMedia = capturedMedia.filter(m => {
            const url = m.url.toLowerCase();
            return !url.includes('150x150') &&
                !url.includes('44x44') &&
                !url.includes('s150x') &&
                !url.includes('s320x') &&
                !url.includes('_s.jpg') &&
                !url.includes('profile');
        });

        // Prioritize video over image
        const videos = filteredMedia.filter(m => m.type === 'video');
        let images = filteredMedia.filter(m => m.type === 'image');

        // Sort images by likely quality (larger dimension indicators first)
        images.sort((a, b) => {
            const aHas1080 = a.url.includes('1080') ? 1 : 0;
            const bHas1080 = b.url.includes('1080') ? 1 : 0;
            return bHas1080 - aHas1080;
        });

        console.log(`Found ${videos.length} videos, ${images.length} images after filtering`);

        // Return the best media (prefer video, then largest image)
        const finalMedia = videos.length > 0 ? [videos[0]] : (images.length > 0 ? [images[0]] : []);

        if (finalMedia.length === 0) {
            return {
                success: false,
                error: 'No usable media found.',
                code: 'NO_MEDIA'
            };
        }

        console.log(`Story scraped successfully: ${finalMedia[0].type}`);

        return {
            success: true,
            media: finalMedia,
            username: storyInfo.username,
            storyId: storyInfo.storyId,
            count: finalMedia.length
        };

    } catch (error) {
        console.error('Story error:', error.message);
        if (browser) await browser.close();
        return { success: false, error: error.message, code: 'ERROR' };
    }
}

module.exports = { scrapeInstagramPost, isValidInstagramUrl };

