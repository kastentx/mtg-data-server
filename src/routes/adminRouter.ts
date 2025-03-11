import express from 'express';
import asyncHandler from 'express-async-handler';
import { checkRemoteFileModified, checkLocalFileModified, downloadCardData } from '../helpers/mtgJsonHelpers';

const router = express.Router();

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

router.get('/status', asyncHandler(async (_req, res) => {
    const status = 'OK';
    res.json(status);
}));

router.get('/last-modified', asyncHandler(async (_req, res, next) => {
    try {
        const lastModified = await checkRemoteFileModified();
        res.json({ lastModified });
    } catch (error) {
        next(error);
    }
}));

router.post('/download', async (req, res) => {
    try {
        console.log('Downloading data...');
        await downloadCardData();
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error downloading data');
    }
});

// router.post('/load', async (req, res) => {
//     try {
//         const data = await loadCardData();
//         res.redirect('/admin');
//     } catch (error) {
//         res.status(500).send('Error loading data');
//     }
// });

export default router;
