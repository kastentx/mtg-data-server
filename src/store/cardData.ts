import { AllPrintingsFile } from "../types";

class CardDataStore {
    private static instance: CardDataStore;
    private data: AllPrintingsFile | undefined;
    private symbols: Record<string, string> | undefined;
    private constructor() {}

    static getInstance(): CardDataStore {
        if (!CardDataStore.instance) {
            CardDataStore.instance = new CardDataStore();
        }
        return CardDataStore.instance;
    }

    setData(data: AllPrintingsFile) {
        this.data = data;
    }

    getData(): AllPrintingsFile | undefined {
        return this.data;
    }

    setSymbols(symbols: Record<string, string>) {
        if (!this.data) {
            return;
        }
        this.symbols = symbols;
    }

    getSymbols(): Record<string, string> | undefined {
        return this.symbols;
    }
}

export default CardDataStore;
