
export const ramStore = {
	codes: {},
	sockets: {},
} as {
	codes: {
		[code: string]: {
			codeType: "valid",
			userId: string,
			expirationDate: Date,
		} | {
			codeType: "reserved",
			expirationDate: Date,
		} | undefined
	},
	sockets: {
		[userId: string]: Array<WebSocket>,
	},
};

// #region Login Code Logic

function clearLoginCode(code: string) {
	const RESERVE_TIME_MS = 5 * 1000;

	ramStore.codes[code] = {
		codeType: "reserved",
		expirationDate: new Date(Date.now() + RESERVE_TIME_MS),
	};
}

// Code clearer
setInterval(() => {
	const codes = ramStore.codes;
	for (const code in codes) {
		if (!codes[code]) {
			delete codes[code];
		}
		else if (codes[code]!.codeType === "reserved") {
			if (Date.now() - ramStore.codes[code]!.expirationDate.getTime() > 0) {
				delete codes[code];
			}
		}
		else {
			if (Date.now() - ramStore.codes[code]!.expirationDate.getTime() > 0) {
				clearLoginCode(code);
			}
		}
	}
}, 500);

export function createLoginCode(userId: string, validity: number): CodeDescription {
	const issueDate = new Date();
	const expirationDate = new Date(issueDate.getTime() + validity);

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

	ramStore.codes[code] = {
		codeType: "valid",
		expirationDate,
		userId,
	};

	return {
		code,
		issueDate,
		expirationDate,
	};
}

export function useLoginCode(code: string): string | undefined {
	const result = ramStore.codes[code];
	if (result?.codeType !== "valid") {
		return;
	}
	else {
		clearLoginCode(code);
		return result.userId;
	}
}

export interface CodeDescription {
	code: string,
	issueDate: Date,
	expirationDate: Date,
}

// #endregion

