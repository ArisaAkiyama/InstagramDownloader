/**
 * Download Queue Manager
 * Handles parallel downloads with concurrency control
 */

const fs = require('fs');
const path = require('path');

const MAX_CONCURRENT = 5; // Max parallel downloads
const DEFAULT_DOWNLOAD_FOLDER = process.env.DOWNLOAD_PATH || path.join(require('os').homedir(), 'Downloads', 'Instagram');

class DownloadQueue {
    constructor() {
        this.queue = [];
        this.activeDownloads = 0;
        this.results = new Map(); // jobId -> result
        this.jobCounter = 0;
    }

    /**
     * Add multiple items to download queue
     * @param {Array} items - Items to download
     * @param {string} username - Username for folder
     * @param {string} downloadPath - Custom download path (optional)
     * @returns {string} jobId for tracking
     */
    addBatch(items, username, downloadPath = '') {
        const jobId = `job_${++this.jobCounter}_${Date.now()}`;

        // Use custom path if provided, otherwise default
        const baseFolder = downloadPath && downloadPath.trim()
            ? downloadPath.trim()
            : DEFAULT_DOWNLOAD_FOLDER;

        this.results.set(jobId, {
            status: 'processing',
            total: items.length,
            completed: 0,
            failed: 0,
            items: [],
            downloadPath: baseFolder
        });

        for (const item of items) {
            this.queue.push({
                jobId,
                url: item.url,
                filename: item.filename,
                type: item.type,
                username,
                downloadPath: baseFolder
            });
        }

        // Start processing
        this.processQueue();

        return jobId;
    }

    /**
     * Process queue with parallel downloads
     */
    async processQueue() {
        while (this.queue.length > 0 && this.activeDownloads < MAX_CONCURRENT) {
            const item = this.queue.shift();
            if (item) {
                this.activeDownloads++;
                this.downloadItem(item).finally(() => {
                    this.activeDownloads--;
                    this.processQueue(); // Continue processing
                });
            }
        }
    }

    /**
     * Download a single item
     */
    async downloadItem(item) {
        const { jobId, url, filename, type, username, downloadPath } = item;
        const result = this.results.get(jobId);

        try {
            // Create user folder using custom or default path
            const userFolder = path.join(downloadPath, username);
            if (!fs.existsSync(userFolder)) {
                fs.mkdirSync(userFolder, { recursive: true });
                console.log(`📁 Created folder: ${userFolder}`);
            }

            const filePath = path.join(userFolder, filename);

            // Skip if file exists
            if (fs.existsSync(filePath)) {
                result.completed++;
                result.items.push({ filename, status: 'skipped', reason: 'exists' });
                this.checkJobComplete(jobId);
                return;
            }

            // Download file
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.instagram.com/'
                },
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buffer = await response.buffer();
            fs.writeFileSync(filePath, buffer);

            result.completed++;
            result.items.push({ filename, status: 'success', path: filePath });
            console.log(`✅ Downloaded: ${filename}`);

        } catch (error) {
            result.failed++;
            result.items.push({ filename, status: 'failed', error: error.message });
            console.error(`❌ Failed: ${filename} - ${error.message}`);
        }

        this.checkJobComplete(jobId);
    }

    /**
     * Check if job is complete
     */
    checkJobComplete(jobId) {
        const result = this.results.get(jobId);
        if (result && (result.completed + result.failed) >= result.total) {
            result.status = 'complete';
            result.completedAt = new Date().toISOString();

            // Clean up after 5 minutes
            setTimeout(() => {
                this.results.delete(jobId);
            }, 5 * 60 * 1000);
        }
    }

    /**
     * Get job status
     */
    getStatus(jobId) {
        return this.results.get(jobId) || { status: 'not_found' };
    }

    /**
     * Get queue stats
     */
    getStats() {
        return {
            queueLength: this.queue.length,
            activeDownloads: this.activeDownloads,
            maxConcurrent: MAX_CONCURRENT,
            activeJobs: this.results.size
        };
    }
}

// Singleton instance
const downloadQueue = new DownloadQueue();

module.exports = downloadQueue;
