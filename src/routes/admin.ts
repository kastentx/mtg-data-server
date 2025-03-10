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
        console.log('Downloading data...');
        await downloadCardData();
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error downloading data');
    }
});

router.post('/load', async (req, res) => {
    try {
        const data = await loadCardData();
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Error loading data');
    }
});

export default router;
