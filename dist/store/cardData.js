"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../database/db");
/**
 * Singleton class to store and access MTG card data
 */
class CardDataStore {
    constructor() {
        this.metadata = null;
        this.availableSets = [];
        this.availableCards = [];
        this.symbols = [];
    }
    static getInstance() {
        if (!CardDataStore.instance) {
            CardDataStore.instance = new CardDataStore();
        }
        return CardDataStore.instance;
    }
    setMetadata(meta) {
        this.metadata = meta;
    }
    getMetadata() {
        return this.metadata;
    }
    setAvailableSets(sets) {
        this.availableSets = sets;
    }
    setAvailableCards(cards) {
        this.availableCards = cards;
    }
    setSymbols(symbols) {
        this.symbols = symbols;
    }
    getSymbols() {
        return this.symbols;
    }
    getAvailableSets(exclude_online_only = true) {
        if (exclude_online_only) {
            return this.availableSets.filter((set) => !set.isOnlineOnly);
        }
        return this.availableSets;
    }
    getSetbyCode(code) {
        return this.availableSets.find((set) => set.code === code);
    }
    getCardsBySetCode(code) {
        return this.availableCards.filter((card) => card.setCode === code);
    }
    /**
     * Gets a card by UUID using SQLite database
     */
    async getCardsByUuid(uuids) {
        return await (0, db_1.getCardsByUuid)(uuids);
    }
    /**
     * Searches for cards by name using SQLite database
     */
    async searchCards(name, limit = 20) {
        return await (0, db_1.searchCardsByName)(name, limit);
    }
}
exports.default = CardDataStore;
