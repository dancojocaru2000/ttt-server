import express from 'express';
import { nanoid } from 'nanoid';
import { loadDatabase, useDatabase } from './db';
import { Game } from './types/game';
import { User } from './types/user';

const router = express.Router();
export default router;

const NICK_REGEX = /^[A-Za-z][A-Za-z0-9-_]*$/;
const CODE_VALIDITY_MS = 15 * 1000;

const ramStore = {
	codes: {},
} as { codes: { [code: string]: { userId: string, intervalHandle: ReturnType<typeof setInterval> } | undefined } };

router.get('/meta/nickRegex', async (_, res) => {
	res.json({
		status: "ok",
		regex: NICK_REGEX.source,
	});
});

router.get('/games', async (_, res) => {
	await useDatabase(async db => {
		res.json({
			status: "ok",
			games: db.games
		});
	});
});

router.post('/games', async (_, res) => res.redirect('./game', 301));

router.post('/game', async (req, res) => {
	const newGame = req.body as Game;
	await useDatabase(async db => db.games.push(newGame));
	res.json({
		status: "ok",
	});
});

router.get('/game/:gameId', async (req, res) => {
	const gameId = req.params.gameId;
	const game = await useDatabase(async db => {
		return db.games.find(game => game.id === gameId);
	});
	if (!game) {
		res.status(404).json({
			status: "error",
			message: `Game with ID ${gameId} not found`,
		});
	}
	else {
		res.json({
			status: "ok",
			game,
		});
	}
});

router.patch('/game/:gameId', async (req, res) => {
	const gameId = req.params.gameId;
	const updatedGame = req.body as Game;
	if (gameId !== updatedGame.id) {
		res.statusMessage = "Unprocessable Entity";
		res.status(422).json({
			status: "error",
			message: "Cannot change game ID",
		});
		return;
	}
	const success = await useDatabase(async db => {
		const idx = db.games.findIndex(game => game.id === gameId);
		if (idx === -1) {
			res.status(404).json({
				status: "error",
				message: `Game with ID ${gameId} not found`,
			});
			return false;
		}
		db.games.splice(idx, 1, {
			...db.games[idx],
			...updatedGame,
		});
		return true;
	});
	if (success) {
		res.json({
			status: "ok",
		});
	}
});

router.get('/users', async (_, res) => {
	const users = await useDatabase(async db => {
		return db.users.map(u => {
			return { ...u, secret: undefined }
		});
	});
	res.json({
		status: "ok",
		users,
	})
});

router.post('/user/new', async (req, res) => {
	let nickname: string;
	try {
		nickname = req.body.nickname;
	}
	catch(e) {
		res.status(400).json({
			status: "error",
			message: "Invalid JSON in body",
		});
		return;
	}
	if (!NICK_REGEX.test(nickname)) {
		req.statusMessage = 'Unprocessable Entity';
		res.status(422).json({
			status: "error",
			message: "Invalid nickname; only English letters, digits, dash - and underscore _ allowed; only letters first!",
			regex: NICK_REGEX.source,
		});
		return;
	}
	if ((await loadDatabase()).users.some(user => user.nickname === nickname)) {
		res.status(409).json({
			status: "error",
			message: `Nickname ${nickname} is already used`,
		});
		return;
	}
	const newUser = {
		id: nanoid(),
		nickname,
		secret: nanoid(),
		stats: {
			local: {
				total: 0,
				won: 0,
			},
			online: {
				total: 0,
				won: 0,
			}
		},
	} as User;
	await useDatabase(async db => db.users.push(newUser));
	res.json({
		status: "ok",
		user: newUser,
	})
});

router.get('/user/:userId/code', async (req, res) => {
	const userId = req.params.userId;

	const user = await useDatabase(async db => db.users.find(u => u.id === userId));
	if (!user) {
		res.statusMessage = 'Unprocessable Entity';
		res.status(422).json({
			status: "error",
			message: "User doesn't exist",
		});
		return;
	}
	else if (user.secret !== req.secret) {
		res.statusMessage = 'Unprocessable Entity';
		res.status(422).json({
			status: "error",
			message: "Invalid secret",
		});
		return;
	}

	const code = (() => {
		const bannedExpr = [
			/666/,
		];
		for (let i = 0; i < 7; i++) {
			bannedExpr.push(new RegExp(`${i}${i + 1}${i + 2}${i + 3}`));
		}
		for (let i = 9; i > 2; i--) {
			bannedExpr.push(new RegExp(`${i}${i - 1}${i - 2}${i - 3}`));
		}
		for (let i = 0; i < 10; i++) {
			bannedExpr.push(new RegExp(`${i}${i}${i}${i}`));
		}
		while (true) {
			const attempt = Math.max(Math.min(Math.floor(Math.random() * 10000), 9999), 1);
			const attemptString = attempt.toString().padStart(4, '0');
			let rejected = false;
			for (const banned of bannedExpr) {
				if (banned.test(attemptString)) {
					rejected = true;
					break;
				}
			}
			if (!rejected && !Object.keys(ramStore.codes).includes(attemptString)) {
				return attemptString;
			}
		}
	})();

	const issueDate = new Date();
	const expirationDate = new Date(issueDate.getTime() + CODE_VALIDITY_MS);
	const intervalHandle = setInterval(() => {
		if (Date.now() - expirationDate.getTime() > 0) {
			clearInterval(intervalHandle);
			delete ramStore.codes[code];
		}
	}, 1000);

	ramStore.codes[code] = {
		intervalHandle,
		userId,
	};

	res.json({
		status: "ok",
		code,
		expirationDate: expirationDate.toISOString(),
		issueDate: issueDate.toISOString(),
		expiresInSeconds: Math.floor((expirationDate.getTime() - issueDate.getTime()) / 1000),
	});
})

router.post('/user/login/code', async (req, res) => {
	const { code }: { code?: string } = req.body;
	if (!code || code.length !== 4 || !parseInt(code)) {
		res.status(400).json({
			status: "error",
			message: "Invalid code - bad format",
		});
		return;
	}
	const userId = ramStore.codes[code]?.userId;
	const user = await useDatabase(async db => db.users.find(user => user.id === userId));
	if (!user) {
		res.statusMessage = 'Unprocessable Entity';
		res.status(422).json({
			status: "error",
			message: "Code doesn't exist",
		});
		return;
	}
	else {
		clearInterval(ramStore.codes[code]!.intervalHandle);
		delete ramStore.codes[code];
		res.json({
			status: "ok",
			user
		});
	}
});

router.get('/user/:userId', async (req, res) => {
	const userId = req.params.userId;
	const user = await useDatabase(async db => {
		return db.users.find(user => user.id === userId);
	});
	if (!user) {
		res.status(404).json({
			status: "error",
			message: `User with ID ${userId} not found`,
		})
	}
	else {
		res.json({
			status: "ok",
			user: {
				...user,
				secret: undefined,
			},
		})
	}
});
