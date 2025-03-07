import express from 'express';
import { checkRemoteFileModified, checkLocalFileModified, downloadCardData, loadCardData } from '../helpers/mtgJsonHelpers';

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

router.post('/download', async (req, res) => {
    try {
        await downloadCardData();
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error downloading data');
    }
});

router.post('/load-keys', async (req, res) => {
    try {
        const data = await loadCardData();
        // console.log('top level keys?', );
        console.log('Top level keys:', Object.keys(data));
        res.redirect('/admin');
    } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).send('Error loading data');
    }
});

export default router;
