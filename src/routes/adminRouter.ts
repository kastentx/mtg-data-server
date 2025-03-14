import express from 'express';
import asyncHandler from 'express-async-handler';
import { 
  checkRemoteFileModified, 
  checkLocalFileModified, 
  downloadCardData,
  initializeCardStore
} from '../services/dataService';

const router = express.Router();

/**
 * Admin dashboard route
 */
router.get('/', async (req, res) => {
    const lastModifiedRemote = await checkRemoteFileModified();
    const lastModifiedLocal = await checkLocalFileModified();

    res.render('admin', {
        title: 'MTG Admin Dashboard',
        layout: 'main',
        lastModifiedRemote,
        lastModifiedLocal
    });
});

/**
 * Get API status
 */
router.get('/status', asyncHandler(async (_req, res) => {
    res.json({ status: 'OK' });
}));

/**
 * Get last modified date
 */
router.get('/last-modified', asyncHandler(async (_req, res) => {
    const lastModifiedRemote = await checkRemoteFileModified();
    const lastModifiedLocal = await checkLocalFileModified();
    res.json({ lastModifiedRemote, lastModifiedLocal });
}));

/**
 * Download latest data
 */
router.post('/download', async (req, res) => {
    try {
        await downloadCardData();
        res.redirect('/admin');
    } catch (error) {
        console.error('Error downloading data:', error);
        res.status(500).send('Error downloading data');
    }
});

/**
 * Load local data into memory
 */
router.post('/load-data', async (req, res) => {
    try {
        await initializeCardStore();
        res.redirect('/admin');
    } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).send('Error loading data');
    }
});

export default router;
