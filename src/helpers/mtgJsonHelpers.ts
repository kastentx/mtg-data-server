import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.json.zip';
const DATA_DIR = 'data';
const DATA_FILE = 'AllPrintings.json.zip';
const DATA_PATH = path.join(DATA_DIR, DATA_FILE);

interface timestamp {
    lastModified: string;
}

export async function checkRemoteFileModified() {
    const response = await fetch(REMOTE_DATA_URL, { method: 'HEAD' });
    const lastModified = response.headers.get('last-modified');
    if (!lastModified) {
        return null;
    }
    return new Date(lastModified);
}

export async function checkLocalFileModified() {
    try {
        const stats = await fs.stat(DATA_PATH);
        return new Date(stats.mtime);
    } catch {
        return null;
    }
}

export async function downloadCardData() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const response = await fetch(REMOTE_DATA_URL);
    const data = await response.arrayBuffer();
    await fs.writeFile(DATA_PATH, Buffer.from(data));
}

