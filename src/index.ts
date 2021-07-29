import express from "express";
import { getPort } from "./utils";
import apiRouter from './api';

const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (req, _, next) => {
	const slowModeHeader = req.header('X-Slow-Mode');
	if (slowModeHeader) {
		const timeoutHeader = parseInt(slowModeHeader);
		const timeout = timeoutHeader ? timeoutHeader : 3000;
		await new Promise((resolve, _) => setTimeout(resolve, timeout));
	}
	next();
});

// Read X-Secret-String header
declare module 'express-serve-static-core' {
	interface Request {
		secret?: string,
	}	
}
app.use(async (req, _, next) => {
	const secret = req.get('X-Secret-String');
	req.secret = secret;
});

app.use('/api', apiRouter);

app.get('/', (_, res) => {
	res.send('Test');
});

const port = getPort({ defaultPort: 3000 });
app.listen(port);
console.log(`Started listening on port ${port}`);
