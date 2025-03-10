import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import CardDataStore from '../store/cardData';
import { json } from 'stream/consumers';

const REMOTE_DATA_URL = 'https://mtgjson.com/api/v5/AllPrintings.json.zip';
const REMOTE_SYMBOLS_URL = 'https://api.scryfall.com/symbology';
const DATA_DIR = 'data';
const DATA_FILE = 'AllPrintings.json';
const DATA_PATH = path.join(DATA_DIR, DATA_FILE);
const SYMBOLS_FILE = 'symbols.json';
const SYMBOLS_PATH = path.join(DATA_DIR, SYMBOLS_FILE);

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

export async function downloadSymbolData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const response = await fetch(REMOTE_SYMBOLS_URL);
        const data = await response.json() as Record<string, any>;
        const symbols = data.data;
        // write only the symbols array to json file
        await fs.writeFile(SYMBOLS_PATH, JSON.stringify(symbols, null, 2));
    } catch (error) {
        console.error('Failed to download symbol data:', error);
        throw error;
    }
}

export async function downloadCardData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const response = await fetch(REMOTE_DATA_URL);
        const data = await response.arrayBuffer();
        
        // Create temporary zip file
        const tempZipPath = path.join(DATA_DIR, 'temp.zip');
        await fs.writeFile(tempZipPath, Buffer.from(data));
        
        // Extract JSON and save it
        const zip = new AdmZip(tempZipPath);
        const jsonContent = zip.readAsText('AllPrintings.json');
        await fs.writeFile(DATA_PATH, jsonContent);
        
        // Clean up temp zip file
        await fs.unlink(tempZipPath);
    } catch (error) {
        console.error('Failed to download card data:', error);
        throw error;
    }
}

export async function loadCardData() {
    try {
        const jsonContent = await fs.readFile(DATA_PATH, 'utf-8');
        CardDataStore.getInstance().setData(JSON.parse(jsonContent));
    } catch (error) {
        console.error('Failed to load card data:', error);
        throw error;
    }
}

export async function loadSymbolData() {
    try {
        // load the value from the toplevel key 'data' in the JSON file
        const jsonContent = await fs.readFile(SYMBOLS_PATH, 'utf-8');
        // const symbols = JSON.parse(jsonContent).data;
        CardDataStore.getInstance().setSymbols(JSON.parse(jsonContent));
    } catch (error) {
        console.error('Failed to load symbol data:', error);
        throw error;
    }
}