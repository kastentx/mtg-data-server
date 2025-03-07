import express from 'express';
import cors from 'cors';
import { engine } from 'express-handlebars';
import path from 'path';
import adminRouter from './routes/admin';
import apiV1Router from './routes/api-v1';

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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
