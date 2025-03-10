import express from 'express';
import cors from 'cors';
import { engine } from 'express-handlebars';
import path from 'path';
import adminRouter from './routes/admin';
import apiV1Router from './routes/api-v1';
import { checkLocalFileModified, downloadCardData, loadCardData } from './helpers/mtgJsonHelpers';

const app = express();
const port = process.env.PORT || 3000;

app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'MTG Data Server is running' });
});

app.use('/admin', adminRouter);
app.use('/api/v1', apiV1Router);

async function initializeData() {
  try {
    const localDataExists = await checkLocalFileModified();
    if (!localDataExists) {
      console.log('No local data found. Downloading...');
      await downloadCardData();
    }
    console.log('Loading card data...');
    await loadCardData();
    console.log('Card data loaded successfully');
  } catch (error) {
    console.error('Failed to initialize data:', error);
    process.exit(1);
  }
}

initializeData().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
});
