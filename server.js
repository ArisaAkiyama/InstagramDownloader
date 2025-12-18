/**
 * Express Server for Instagram Downloader API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { scrapeInstagramPost, isValidInstagramUrl } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

/**
 * API Endpoint: Download Instagram Media (Posts/Reels)
 * POST /api/download
 * Body: { url: "https://www.instagram.com/p/xxxxx/" }
 */
app.post('/api/download', async (req, res) => {
    try {
        const { url } = req.body;

        // Validate request
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL diperlukan',
                code: 'MISSING_URL'
            });
        }

        // Quick URL validation before scraping
        if (!isValidInstagramUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'URL tidak valid. Masukkan URL postingan Instagram yang benar.',
                code: 'INVALID_URL'
            });
        }

        console.log('Processing request for:', url);

        // Call scraper
        const result = await scrapeInstagramPost(url);

        if (result.success) {
            console.log(`Successfully extracted ${result.count} media items`);
            return res.json(result);
        } else {
            console.log('Scraping failed:', result.error);
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan server. Silakan coba lagi.',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * API Endpoint: Proxy download for CORS bypass
 * GET /api/proxy?url=...
 */
app.get('/api/proxy', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL diperlukan' });
        }

        // Fetch the media
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.instagram.com/'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch media' });
        }

        // Forward the content
        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment');

        response.body.pipe(res);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Proxy error' });
    }
});

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

/**
 * API Endpoint: Save media to local folder (organized by username)
 * POST /api/save
 * Body: { url, filename, type, username }
 * 
 * NOTE: File disimpan ke folder "Downloads/Instagram/username".
 * Untuk mengubah lokasi, edit variabel DOWNLOAD_FOLDER di bawah.
 */
const DOWNLOAD_FOLDER = process.env.DOWNLOAD_PATH || path.join(require('os').homedir(), 'Downloads', 'Instagram');

app.post('/api/save', async (req, res) => {
    try {
        const { url, filename, type, username } = req.body;

        if (!url || !filename) {
            return res.status(400).json({
                success: false,
                error: 'URL dan filename diperlukan'
            });
        }

        // Pastikan folder ada
        const fs = require('fs');

        // Buat subfolder berdasarkan username
        const safeUsername = (username || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const userFolder = path.join(DOWNLOAD_FOLDER, safeUsername);

        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
            console.log(`📁 Created folder: ${safeUsername}`);
        }

        // Download file
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.instagram.com/'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download');
        }

        const buffer = await response.arrayBuffer();
        const filePath = path.join(userFolder, filename);

        fs.writeFileSync(filePath, Buffer.from(buffer));

        console.log(`✅ Saved: ${safeUsername}/${filename}`);

        res.json({
            success: true,
            filename,
            username: safeUsername,
            path: filePath,
            size: buffer.byteLength
        });

    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal menyimpan file: ' + error.message
        });
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint tidak ditemukan'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Instagram Downloader Server Started!              ║
║═══════════════════════════════════════════════════════════║
║  🌐 URL: http://localhost:${PORT}                           ║
║  📡 API: http://localhost:${PORT}/api/download               ║
║  💚 Health: http://localhost:${PORT}/api/health              ║
╚═══════════════════════════════════════════════════════════╝
`);
});

module.exports = app;
