import { AllPrintingsFile } from "../types";

class CardDataStore {
    private static instance: CardDataStore;
    private data: AllPrintingsFile | undefined;

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
}

export default CardDataStore;
